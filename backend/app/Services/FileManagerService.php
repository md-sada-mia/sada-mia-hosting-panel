<?php

namespace App\Services;

use Illuminate\Support\Str;
use App\Services\ShellService;
use ZipArchive;

class FileManagerService
{
    public function __construct(protected ShellService $shell) {}
    /**
     * Resolve and validate a path is within the allowed root.
     */
    public function resolvePath(string $path, string $root = '/'): string
    {
        // Normalize and prevent traversal
        $resolved = realpath($root . DIRECTORY_SEPARATOR . ltrim($path, '/'));

        if ($resolved === false) {
            // Path doesn't exist yet (e.g. new file), resolve without realpath
            $resolved = rtrim($root, '/') . '/' . ltrim($path, '/');
            $resolved = $this->normalizePath($resolved);
        }

        // Security: ensure path stays within root
        if (!str_starts_with($resolved, rtrim($root, '/'))) {
            abort(403, 'Access denied: path traversal detected.');
        }

        return $resolved;
    }

    private function normalizePath(string $path): string
    {
        $parts = explode('/', $path);
        $stack = [];
        foreach ($parts as $part) {
            if ($part === '' || $part === '.') continue;
            if ($part === '..') {
                array_pop($stack);
            } else {
                $stack[] = $part;
            }
        }
        return '/' . implode('/', $stack);
    }

    /**
     * List directory contents.
     */
    public function listDirectory(string $path): array
    {
        if (!is_dir($path)) {
            abort(404, 'Directory not found.');
        }

        $items = [];
        $entries = array_diff(scandir($path), ['.', '..']);

        foreach ($entries as $entry) {
            $fullPath = $path . '/' . $entry;
            $stat = @stat($fullPath);
            $items[] = [
                'name'         => $entry,
                'type'         => is_dir($fullPath) ? 'directory' : 'file',
                'size'         => is_file($fullPath) ? ($stat['size'] ?? 0) : null,
                'modified'     => $stat ? date('Y-m-d H:i:s', $stat['mtime']) : null,
                'permissions'  => $stat ? substr(sprintf('%o', $stat['mode']), -4) : null,
                'owner'        => $stat ? (function_exists('posix_getpwuid') ? (posix_getpwuid($stat['uid'])['name'] ?? $stat['uid']) : $stat['uid']) : null,
                'extension'    => is_file($fullPath) ? pathinfo($entry, PATHINFO_EXTENSION) : null,
                'readable'     => is_readable($fullPath),
                'writable'     => is_writable($fullPath),
            ];
        }

        // Sort: directories first, then files, both alphabetically
        usort($items, function ($a, $b) {
            if ($a['type'] !== $b['type']) {
                return $a['type'] === 'directory' ? -1 : 1;
            }
            return strcasecmp($a['name'], $b['name']);
        });

        return $items;
    }

    /**
     * Read file content.
     */
    public function readFile(string $path): array
    {
        if (!is_file($path)) {
            abort(404, 'File not found.');
        }

        if (!is_readable($path)) {
            abort(403, 'File is not readable.');
        }

        $size = filesize($path);
        $maxSize = 5 * 1024 * 1024; // 5MB limit for editor

        if ($size > $maxSize) {
            abort(413, 'File too large to edit (max 5MB).');
        }

        $content = file_get_contents($path);
        $stat = stat($path);

        return [
            'content'     => $content,
            'size'        => $size,
            'modified'    => date('Y-m-d H:i:s', $stat['mtime']),
            'permissions' => substr(sprintf('%o', $stat['mode']), -4),
            'mime'        => mime_content_type($path) ?: 'text/plain',
        ];
    }

    /**
     * Write file content.
     */
    public function writeFile(string $path, string $content): bool
    {
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        return file_put_contents($path, $content) !== false;
    }

    /**
     * Create a new empty file.
     */
    public function createFile(string $path): bool
    {
        if (file_exists($path)) {
            abort(409, 'File already exists.');
        }

        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        return touch($path);
    }

    /**
     * Create a directory.
     */
    public function createDirectory(string $path): bool
    {
        if (file_exists($path)) {
            abort(409, 'Directory already exists.');
        }

        return mkdir($path, 0755, true);
    }

    /**
     * Rename/move a file or directory.
     */
    public function rename(string $from, string $to): bool
    {
        if (!file_exists($from)) {
            abort(404, 'Source not found.');
        }

        if (file_exists($to)) {
            abort(409, 'Destination already exists.');
        }

        return rename($from, $to);
    }

    /**
     * Delete file or directory recursively.
     */
    public function delete(string $path): bool
    {
        if (!file_exists($path) && !is_link($path)) {
            abort(404, 'Path not found.');
        }

        // If it's a symbolic link, always use unlink regardless of whether it points to a directory
        if (is_link($path)) {
            if (@unlink($path)) {
                return true;
            }
            // Fallback to sudo if unlink fails
            return $this->shell->run("sudo rm -f " . escapeshellarg($path))['exit_code'] === 0;
        }

        if (is_dir($path)) {
            return $this->deleteDirectory($path);
        }

        if (@unlink($path)) {
            return true;
        }

        // Fallback to sudo rm for regular files if PHP's unlink fails
        return $this->shell->run("sudo rm -f " . escapeshellarg($path))['exit_code'] === 0;
    }

    private function deleteDirectory(string $path): bool
    {
        // For directories, we first try PHP's internal recursive deletion (cleaner)
        // But if we encounter any error, we fallback to sudo rm -rf (more robust)
        try {
            $entries = array_diff(scandir($path), ['.', '..']);
            foreach ($entries as $entry) {
                $sub = $path . '/' . $entry;
                if (is_link($sub)) {
                    @unlink($sub);
                } elseif (is_dir($sub)) {
                    $this->deleteDirectory($sub);
                } else {
                    @unlink($sub);
                }
            }

            if (@rmdir($path)) {
                return true;
            }
        } catch (\Throwable $e) {
            // Log or ignore, fallback handles it
        }

        // Final fallback for any directory deletion failure (permissions, non-empty, etc.)
        return $this->shell->run("sudo rm -rf " . escapeshellarg($path))['exit_code'] === 0;
    }

    /**
     * Copy a file or directory.
     */
    public function copy(string $from, string $to): bool
    {
        if (!file_exists($from)) {
            abort(404, 'Source not found.');
        }

        if (is_dir($from)) {
            return $this->copyDirectory($from, $to);
        }

        $dir = dirname($to);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        return copy($from, $to);
    }

    private function copyDirectory(string $from, string $to): bool
    {
        if (!is_dir($to)) {
            mkdir($to, 0755, true);
        }
        $entries = array_diff(scandir($from), ['.', '..']);
        foreach ($entries as $entry) {
            $src = $from . '/' . $entry;
            $dst = $to . '/' . $entry;
            if (is_dir($src)) {
                $this->copyDirectory($src, $dst);
            } else {
                copy($src, $dst);
            }
        }
        return true;
    }

    /**
     * Change file permissions.
     */
    public function chmod(string $path, int $mode): bool
    {
        if (!file_exists($path)) {
            abort(404, 'Path not found.');
        }

        return chmod($path, $mode);
    }

    /**
     * Compress files/directories into a zip archive.
     */
    public function compress(string $outputPath, array $sourcePaths): bool
    {
        if (!class_exists('ZipArchive')) {
            abort(500, 'ZipArchive extension is not available.');
        }

        $zip = new ZipArchive();
        if ($zip->open($outputPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            abort(500, 'Failed to create archive.');
        }

        foreach ($sourcePaths as $srcPath) {
            if (is_file($srcPath)) {
                $zip->addFile($srcPath, basename($srcPath));
            } elseif (is_dir($srcPath)) {
                $this->addDirToZip($zip, $srcPath, basename($srcPath));
            }
        }

        $zip->close();
        return true;
    }

    private function addDirToZip(ZipArchive $zip, string $dir, string $zipDir): void
    {
        $zip->addEmptyDir($zipDir);
        $entries = array_diff(scandir($dir), ['.', '..']);
        foreach ($entries as $entry) {
            $fullPath = $dir . '/' . $entry;
            $zipPath  = $zipDir . '/' . $entry;
            if (is_dir($fullPath)) {
                $this->addDirToZip($zip, $fullPath, $zipPath);
            } else {
                $zip->addFile($fullPath, $zipPath);
            }
        }
    }

    /**
     * Extract a zip archive.
     */
    public function extract(string $archivePath, string $destDir): bool
    {
        if (!file_exists($archivePath)) {
            abort(404, 'Archive not found.');
        }

        if (!class_exists('ZipArchive')) {
            abort(500, 'ZipArchive extension is not available.');
        }

        $zip = new ZipArchive();
        if ($zip->open($archivePath) !== true) {
            abort(500, 'Failed to open archive.');
        }

        if (!is_dir($destDir)) {
            mkdir($destDir, 0755, true);
        }

        $zip->extractTo($destDir);
        $zip->close();
        return true;
    }

    /**
     * Format bytes to human-readable size.
     */
    public function formatSize(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = 0;
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }
        return round($bytes, 2) . ' ' . $units[$i];
    }

    /**
     * Search files in a directory.
     */
    public function search(string $dir, string $query, int $limit = 100): array
    {
        $results = [];
        $this->searchRecursive($dir, $query, $results, $limit);
        return $results;
    }

    private function searchRecursive(string $dir, string $query, array &$results, int $limit): void
    {
        if (count($results) >= $limit) return;

        $entries = @scandir($dir);
        if (!$entries) return;
        $entries = array_diff($entries, ['.', '..']);

        foreach ($entries as $entry) {
            if (count($results) >= $limit) break;

            $fullPath = $dir . '/' . $entry;
            if (stripos($entry, $query) !== false) {
                $results[] = [
                    'name'     => $entry,
                    'path'     => $fullPath,
                    'type'     => is_dir($fullPath) ? 'directory' : 'file',
                    'size'     => is_file($fullPath) ? filesize($fullPath) : null,
                    'modified' => date('Y-m-d H:i:s', filemtime($fullPath)),
                ];
            }

            if (is_dir($fullPath)) {
                $this->searchRecursive($fullPath, $query, $results, $limit);
            }
        }
    }
}
