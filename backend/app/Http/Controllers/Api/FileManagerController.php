<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FileManagerService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FileManagerController extends Controller
{
    protected string $root;

    public function __construct(protected FileManagerService $fileManager)
    {
        // Sandbox the file manager strictly to the apps directory
        $this->root = config('hosting.apps_base_path', '/var/www/hosting-apps');
    }

    /**
     * List directory contents.
     * GET /api/files?path=/some/dir
     */
    public function index(Request $request)
    {
        $request->validate(['path' => 'nullable|string']);
        $path = $request->input('path', '/');
        $resolved = $this->fileManager->resolvePath($path, $this->root);

        // Ensure the root apps directory exists if we are querying it and it hasn't been created yet
        if ($resolved === $this->root && !is_dir($this->root)) {
            @mkdir($this->root, 0755, true);
        }

        $items = $this->fileManager->listDirectory($resolved);

        // Strip the root path so the frontend always gets a relative path
        $relativePath = str_replace($this->root, '', $resolved);
        if ($relativePath === '') {
            $relativePath = '/';
        }

        return response()->json([
            'path'  => $relativePath,
            'items' => $items,
        ]);
    }

    /**
     * Read file content.
     * GET /api/files/content?path=/some/file
     */
    public function show(Request $request)
    {
        $request->validate(['path' => 'required|string']);
        $path     = $request->input('path');
        $resolved = $this->fileManager->resolvePath($path, $this->root);

        $data = $this->fileManager->readFile($resolved);

        return response()->json($data);
    }

    /**
     * Create a new file or directory.
     * POST /api/files
     * body: { path, type: 'file'|'directory' }
     */
    public function store(Request $request)
    {
        $request->validate([
            'path' => 'required|string',
            'type' => 'required|in:file,directory',
        ]);

        $resolved = $this->fileManager->resolvePath($request->path, $this->root);

        if ($request->type === 'directory') {
            $this->fileManager->createDirectory($resolved);
        } else {
            $this->fileManager->createFile($resolved);
        }

        return response()->json(['message' => ucfirst($request->type) . ' created successfully.'], 201);
    }

    /**
     * Save file contents.
     * PUT /api/files
     * body: { path, content }
     */
    public function update(Request $request)
    {
        $request->validate([
            'path'    => 'required|string',
            'content' => 'required|string',
        ]);

        $resolved = $this->fileManager->resolvePath($request->path, $this->root);
        $this->fileManager->writeFile($resolved, $request->content);

        return response()->json(['message' => 'File saved successfully.']);
    }

    /**
     * Delete a file or directory.
     * DELETE /api/files?path=/some/path
     */
    public function destroy(Request $request)
    {
        $request->validate(['path' => 'required|string']);
        $resolved = $this->fileManager->resolvePath($request->input('path'), $this->root);
        $this->fileManager->delete($resolved);

        return response()->json(['message' => 'Deleted successfully.']);
    }

    /**
     * Rename or move a path.
     * POST /api/files/rename
     * body: { from, to }
     */
    public function rename(Request $request)
    {
        $request->validate([
            'from' => 'required|string',
            'to'   => 'required|string',
        ]);

        $from = $this->fileManager->resolvePath($request->from, $this->root);
        $to   = $this->fileManager->resolvePath($request->to, $this->root);
        $this->fileManager->rename($from, $to);

        return response()->json(['message' => 'Renamed successfully.']);
    }

    /**
     * Copy a file or directory.
     * POST /api/files/copy
     * body: { from, to }
     */
    public function copy(Request $request)
    {
        $request->validate([
            'from' => 'required|string',
            'to'   => 'required|string',
        ]);

        $from = $this->fileManager->resolvePath($request->from, $this->root);
        $to   = $this->fileManager->resolvePath($request->to, $this->root);
        $this->fileManager->copy($from, $to);

        return response()->json(['message' => 'Copied successfully.']);
    }

    /**
     * Upload file(s).
     * POST /api/files/upload
     * body: multipart, files[], path
     */
    public function upload(Request $request)
    {
        $request->validate([
            'path'    => 'required|string',
            'files'   => 'required|array',
            'files.*' => 'required|file|max:102400', // 100MB max per file
        ]);

        $dir = $this->fileManager->resolvePath($request->input('path'), $this->root);

        if (!is_dir($dir)) {
            abort(404, 'Target directory not found.');
        }

        $uploaded = [];
        foreach ($request->file('files') as $file) {
            $name = $file->getClientOriginalName();
            $file->move($dir, $name);
            $uploaded[] = $name;
        }

        return response()->json([
            'message' => count($uploaded) . ' file(s) uploaded successfully.',
            'files'   => $uploaded,
        ]);
    }

    /**
     * Download a file.
     * GET /api/files/download?path=/some/file
     */
    public function download(Request $request)
    {
        $request->validate(['path' => 'required|string']);
        $resolved = $this->fileManager->resolvePath($request->input('path'), $this->root);

        if (!is_file($resolved)) {
            abort(404, 'File not found.');
        }

        return response()->download($resolved);
    }

    /**
     * Change file permissions.
     * POST /api/files/chmod
     * body: { path, mode (octal string e.g. "0755") }
     */
    public function chmod(Request $request)
    {
        $request->validate([
            'path' => 'required|string',
            'mode' => ['required', 'regex:/^0?[0-7]{3,4}$/'],
        ]);

        $resolved = $this->fileManager->resolvePath($request->path, $this->root);
        $mode     = octdec($request->mode);
        $this->fileManager->chmod($resolved, $mode);

        return response()->json(['message' => 'Permissions updated.']);
    }

    /**
     * Search files.
     * GET /api/files/search?path=/some/dir&q=filename
     */
    public function search(Request $request)
    {
        $request->validate([
            'path' => 'nullable|string',
            'q'    => 'required|string|min:1',
        ]);

        $dir      = $this->fileManager->resolvePath($request->input('path', '/'), $this->root);
        $results  = $this->fileManager->search($dir, $request->input('q'));

        // Strip the root path from each search result
        foreach ($results as &$result) {
            $relativePath = str_replace($this->root, '', $result['path']);
            $result['path'] = $relativePath === '' ? '/' : $relativePath;
        }

        return response()->json(['results' => $results]);
    }

    /**
     * Compress files into zip.
     * POST /api/files/compress
     * body: { paths: [], output }
     */
    public function compress(Request $request)
    {
        $request->validate([
            'paths'  => 'required|array',
            'paths.*' => 'required|string',
            'output' => 'required|string',
        ]);

        $sources = array_map(fn($p) => $this->fileManager->resolvePath($p, $this->root), $request->paths);
        $output  = $this->fileManager->resolvePath($request->output, $this->root);
        $this->fileManager->compress($output, $sources);

        return response()->json(['message' => 'Archive created successfully.']);
    }

    /**
     * Extract zip archive.
     * POST /api/files/extract
     * body: { path, dest }
     */
    public function extract(Request $request)
    {
        $request->validate([
            'path' => 'required|string',
            'dest' => 'required|string',
        ]);

        $archive = $this->fileManager->resolvePath($request->path, $this->root);
        $dest    = $this->fileManager->resolvePath($request->dest, $this->root);
        $this->fileManager->extract($archive, $dest);

        return response()->json(['message' => 'Archive extracted successfully.']);
    }
}
