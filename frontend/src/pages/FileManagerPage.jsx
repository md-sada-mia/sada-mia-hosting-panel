import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { toast } from 'sonner';
import {
  Folder, FolderOpen, File, FileText, FileCode, FileImage, FileVideo, FileAudio,
  FileArchive, ChevronRight, Home, Upload, Plus, Trash2, Edit, Copy, Download,
  Search, RefreshCw, X, Check, Lock, Archive, PackageOpen, HardDrive,
  ArrowLeft, MoreVertical, Eye, Save, ChevronDown, Info, FolderPlus, FilePlus,
  MoveRight, Shield, Grid3X3, List
} from 'lucide-react';

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(item, size = 'h-4 w-4') {
  if (item.type === 'directory') return <Folder className={`${size} text-amber-400`} />;
  const ext = (item.extension || '').toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'php', 'py', 'rb', 'go', 'java', 'c', 'cpp', 'cs', 'html', 'css', 'json', 'yaml', 'yml', 'sh', 'xml', 'sql'].includes(ext))
    return <FileCode className={`${size} text-blue-400`} />;
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext))
    return <FileImage className={`${size} text-purple-400`} />;
  if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext))
    return <FileVideo className={`${size} text-pink-400`} />;
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext))
    return <FileAudio className={`${size} text-green-400`} />;
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext))
    return <FileArchive className={`${size} text-orange-400`} />;
  if (['txt', 'md', 'log', 'csv'].includes(ext))
    return <FileText className={`${size} text-slate-400`} />;
  return <File className={`${size} text-slate-400`} />;
}

function isTextFile(ext) {
  const textExts = ['txt', 'md', 'js', 'jsx', 'ts', 'tsx', 'php', 'py', 'rb', 'go', 'java', 'c',
    'cpp', 'cs', 'html', 'htm', 'css', 'json', 'yaml', 'yml', 'sh', 'bash', 'xml', 'sql', 'env',
    'gitignore', 'htaccess', 'log', 'csv', 'conf', 'ini', 'toml', 'vue', 'svelte', 'rs', 'lock'];
  return textExts.includes((ext || '').toLowerCase()) || !ext;
}

function getLanguage(ext) {
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    php: 'php', py: 'python', rb: 'ruby', go: 'go', java: 'java',
    c: 'c', cpp: 'cpp', cs: 'csharp', html: 'html', htm: 'html',
    css: 'css', json: 'json', yaml: 'yaml', yml: 'yaml', sh: 'bash',
    bash: 'bash', xml: 'xml', sql: 'sql', md: 'markdown', rs: 'rust',
    vue: 'vue', svelte: 'svelte',
  };
  return map[(ext || '').toLowerCase()] || 'text';
}

// ──────────────────────────────────────────────────
// Context menu component
// ──────────────────────────────────────────────────
function ContextMenu({ x, y, item, onClose, onOpen, onEdit, onRename, onCopy, onCut, onDelete, onDownload, onChmod, onCompress, onExtract }) {
  const ref = useRef();
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const menuItems = [
    item.type === 'directory' && { icon: <FolderOpen className="h-3.5 w-3.5" />, label: 'Open', action: () => { onOpen(item); onClose(); } },
    item.type === 'file' && isTextFile(item.extension) && { icon: <Eye className="h-3.5 w-3.5" />, label: 'View / Edit', action: () => { onEdit(item); onClose(); } },
    item.type === 'file' && { icon: <Download className="h-3.5 w-3.5" />, label: 'Download', action: () => { onDownload(item); onClose(); } },
    { icon: <Edit className="h-3.5 w-3.5" />, label: 'Rename', action: () => { onRename(item); onClose(); } },
    { icon: <Copy className="h-3.5 w-3.5" />, label: 'Copy', action: () => { onCopy(item); onClose(); } },
    { icon: <MoveRight className="h-3.5 w-3.5" />, label: 'Cut', action: () => { onCut(item); onClose(); } },
    item.type === 'file' && ['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes((item.extension || '').toLowerCase()) && { icon: <PackageOpen className="h-3.5 w-3.5" />, label: 'Extract Here', action: () => { onExtract(item); onClose(); } },
    { icon: <Archive className="h-3.5 w-3.5" />, label: 'Compress (Zip)', action: () => { onCompress(item); onClose(); } },
    { icon: <Shield className="h-3.5 w-3.5" />, label: 'Permissions', action: () => { onChmod(item); onClose(); } },
    { type: 'separator' },
    { icon: <Trash2 className="h-3.5 w-3.5 text-rose-400" />, label: 'Delete', action: () => { onDelete(item); onClose(); }, danger: true },
  ].filter(Boolean);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-lg border border-border/60 bg-card shadow-2xl py-1 backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, idx) =>
        item.type === 'separator'
          ? <div key={idx} className="my-1 border-t border-border/40" />
          : (
            <button
              key={idx}
              onClick={item.action}
              className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors ${item.danger ? 'text-rose-400 hover:bg-rose-500/10' : 'text-foreground hover:bg-accent'}`}
            >
              {item.icon}
              {item.label}
            </button>
          )
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Code Editor Modal
// ──────────────────────────────────────────────────
function FileEditorModal({ open, file, filePath, onClose, onSave }) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const textareaRef = useRef();

  useEffect(() => {
    if (file) {
      setContent(file.content || '');
      setDirty(false);
    }
  }, [file]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/files', { path: filePath, content });
      setDirty(false);
      toast.success('File saved.');
      onSave?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save file.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      setContent(val.slice(0, start) + '  ' + val.slice(end));
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
    }
  };

  const fileName = filePath ? filePath.split('/').pop() : 'File';

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[85vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-blue-400" />
            <DialogTitle className="text-sm font-mono font-medium">{fileName}</DialogTitle>
            {dirty && <Badge variant="outline" className="text-amber-400 border-amber-400/30 text-[10px] h-4">unsaved</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">{getLanguage(fileName.split('.').pop())}</span>
            <Button size="sm" className="h-7 gap-1.5" onClick={handleSave} disabled={saving || !dirty}>
              <Save className="h-3 w-3" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <kbd className="hidden sm:flex h-7 items-center gap-1 rounded border bg-muted px-2 text-[10px] text-muted-foreground">Ctrl+S</kbd>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-muted/30 border-r border-border/20 flex flex-col items-end pr-2 pt-3 pointer-events-none z-10">
            {(content.split('\n')).map((_, i) => (
              <span key={i} className="text-[10px] text-muted-foreground/40 font-mono leading-6 select-none">{i + 1}</span>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => { setContent(e.target.value); setDirty(true); }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="w-full h-full min-h-[60vh] bg-background font-mono text-sm leading-6 resize-none outline-none p-3 pl-14 text-foreground"
            style={{ tabSize: 2 }}
          />
        </div>

        <div className="px-4 py-2 border-t flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>{content.split('\n').length} lines</span>
          <span>{content.length} chars</span>
          {file?.size && <span>{formatBytes(file.size)}</span>}
          {file?.modified && <span>Modified: {formatDate(file.modified)}</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────
// Upload Area
// ──────────────────────────────────────────────────
function UploadZone({ currentPath, onSuccess }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const uploadFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    const form = new FormData();
    form.append('path', currentPath);
    Array.from(files).forEach(f => form.append('files[]', f));
    try {
      await api.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`${files.length} file(s) uploaded.`);
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border/40 hover:border-border hover:bg-accent/30'}`}
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={e => uploadFiles(e.target.files)} />
      <Upload className={`h-8 w-8 ${dragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} />
      <div className="text-center">
        <p className="text-sm font-medium">{uploading ? 'Uploading…' : 'Drop files here or click to upload'}</p>
        <p className="text-xs text-muted-foreground mt-1">Max 100MB per file</p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────
export default function FileManagerPage() {
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState(null);

  // Clipboard
  const [clipboard, setClipboard] = useState(null); // { items, action: 'copy'|'cut' }

  // Modals
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFile, setEditorFile] = useState(null);
  const [editorPath, setEditorPath] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);

  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemType, setNewItemType] = useState('file');
  const [newItemName, setNewItemName] = useState('');
  const [newItemLoading, setNewItemLoading] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameName, setRenameName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [chmodOpen, setChmodOpen] = useState(false);
  const [chmodTarget, setChmodTarget] = useState(null);
  const [chmodValue, setChmodValue] = useState('0755');
  const [chmodLoading, setChmodLoading] = useState(false);

  const [pasteLoading, setPasteLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const [compressTarget, setCompressTarget] = useState(null);
  const [compressName, setCompressName] = useState('');
  const [compressLoading, setCompressLoading] = useState(false);
  const [compressOpen, setCompressOpen] = useState(false);

  // ── Fetch directory ───────────────────────────────
  const fetchDirectory = useCallback(async (path) => {
    setLoading(true);
    setSelected(new Set());
    setSearchResults(null);
    setSearchQuery('');
    try {
      const { data } = await api.get('/files', { params: { path } });
      setCurrentPath(data.path);
      setItems(data.items);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load directory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDirectory('/'); }, [fetchDirectory]);

  // ── Breadcrumbs ──────────────────────────────────
  const breadcrumbs = useCallback(() => {
    const parts = currentPath.replace(/^\//, '').split('/').filter(Boolean);
    return [
      { label: 'Root', path: '/' },
      ...parts.map((p, i) => ({ label: p, path: '/' + parts.slice(0, i + 1).join('/') })),
    ];
  }, [currentPath]);

  // ── Navigate ─────────────────────────────────────
  const navigate = (item) => {
    if (item.type === 'directory') {
      fetchDirectory(currentPath.replace(/\/$/, '') + '/' + item.name);
    } else if (isTextFile(item.extension)) {
      openEditor(item);
    }
  };

  const goUp = () => {
    const parent = currentPath.replace(/\/[^/]+$/, '') || '/';
    fetchDirectory(parent);
  };

  // ── Open editor ──────────────────────────────────
  const openEditor = async (item) => {
    const filePath = currentPath.replace(/\/$/, '') + '/' + item.name;
    setEditorPath(filePath);
    setEditorLoading(true);
    setEditorOpen(true);
    try {
      const { data } = await api.get('/files/content', { params: { path: filePath } });
      setEditorFile(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to read file.');
      setEditorOpen(false);
    } finally {
      setEditorLoading(false);
    }
  };

  // ── Context Menu ─────────────────────────────────
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, item });
  };

  // ── Download ─────────────────────────────────────
  const handleDownload = async (item) => {
    const filePath = currentPath.replace(/\/$/, '') + '/' + item.name;
    const token = localStorage.getItem('panel_token');
    const url = `/api/files/download?path=${encodeURIComponent(filePath)}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    // Use fetch for proper download with auth
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      link.href = blobUrl;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('Download started.');
    } catch {
      toast.error('Download failed.');
    }
  };

  // ── Create new item ──────────────────────────────
  const handleCreate = async () => {
    if (!newItemName.trim()) return;
    setNewItemLoading(true);
    const path = currentPath.replace(/\/$/, '') + '/' + newItemName.trim();
    try {
      await api.post('/files', { path, type: newItemType });
      toast.success(`${newItemType === 'directory' ? 'Folder' : 'File'} created.`);
      setNewItemOpen(false);
      setNewItemName('');
      fetchDirectory(currentPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create.');
    } finally {
      setNewItemLoading(false);
    }
  };

  // ── Rename ───────────────────────────────────────
  const openRename = (item) => {
    setRenameTarget(item);
    setRenameName(item.name);
    setRenameOpen(true);
  };

  const handleRename = async () => {
    if (!renameName.trim() || renameName === renameTarget.name) return;
    setRenameLoading(true);
    const from = currentPath.replace(/\/$/, '') + '/' + renameTarget.name;
    const to   = currentPath.replace(/\/$/, '') + '/' + renameName.trim();
    try {
      await api.post('/files/rename', { from, to });
      toast.success('Renamed successfully.');
      setRenameOpen(false);
      fetchDirectory(currentPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rename.');
    } finally {
      setRenameLoading(false);
    }
  };

  // ── Delete ───────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const path = currentPath.replace(/\/$/, '') + '/' + deleteTarget.name;
    try {
      await api.delete('/files', { params: { path } });
      toast.success('Deleted successfully.');
      setDeleteTarget(null);
      fetchDirectory(currentPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Clipboard ────────────────────────────────────
  const handleCopy = (item) => {
    const path = currentPath.replace(/\/$/, '') + '/' + item.name;
    setClipboard({ items: [{ ...item, path }], action: 'copy' });
    toast.info(`Copied "${item.name}" to clipboard.`);
  };

  const handleCut = (item) => {
    const path = currentPath.replace(/\/$/, '') + '/' + item.name;
    setClipboard({ items: [{ ...item, path }], action: 'cut' });
    toast.info(`Cut "${item.name}" — ready to paste.`);
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    setPasteLoading(true);
    try {
      for (const item of clipboard.items) {
        const to = currentPath.replace(/\/$/, '') + '/' + item.name;
        if (clipboard.action === 'copy') {
          await api.post('/files/copy', { from: item.path, to });
        } else {
          await api.post('/files/rename', { from: item.path, to });
        }
      }
      toast.success(`Pasted ${clipboard.items.length} item(s).`);
      if (clipboard.action === 'cut') setClipboard(null);
      fetchDirectory(currentPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to paste.');
    } finally {
      setPasteLoading(false);
    }
  };

  // ── Chmod ────────────────────────────────────────
  const openChmod = (item) => {
    setChmodTarget(item);
    setChmodValue(item.permissions || '0755');
    setChmodOpen(true);
  };

  const handleChmod = async () => {
    setChmodLoading(true);
    const path = currentPath.replace(/\/$/, '') + '/' + chmodTarget.name;
    try {
      await api.post('/files/chmod', { path, mode: chmodValue });
      toast.success('Permissions updated.');
      setChmodOpen(false);
      fetchDirectory(currentPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update permissions.');
    } finally {
      setChmodLoading(false);
    }
  };

  // ── Compress ─────────────────────────────────────
  const openCompress = (item) => {
    setCompressTarget(item);
    setCompressName(item.name + '.zip');
    setCompressOpen(true);
  };

  const handleCompress = async () => {
    setCompressLoading(true);
    const path = currentPath.replace(/\/$/, '') + '/' + compressTarget.name;
    const output = currentPath.replace(/\/$/, '') + '/' + compressName;
    try {
      await api.post('/files/compress', { paths: [path], output });
      toast.success('Archive created.');
      setCompressOpen(false);
      fetchDirectory(currentPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to compress.');
    } finally {
      setCompressLoading(false);
    }
  };

  // ── Extract ──────────────────────────────────────
  const handleExtract = async (item) => {
    const path = currentPath.replace(/\/$/, '') + '/' + item.name;
    const dest = currentPath;
    try {
      await api.post('/files/extract', { path, dest });
      toast.success('Extracted successfully.');
      fetchDirectory(currentPath);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to extract.');
    }
  };

  // ── Search ───────────────────────────────────────
  const handleSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setSearching(true);
      try {
        const { data } = await api.get('/files/search', { params: { path: currentPath, q: searchQuery } });
        setSearchResults(data.results);
      } catch (err) {
        toast.error('Search failed.');
      } finally {
        setSearching(false);
      }
    }
  };

  // ── Displayed items ──────────────────────────────
  const displayItems = searchResults !== null ? searchResults : items;

  // ── Selection ────────────────────────────────────
  const toggleSelect = (name, e) => {
    e.stopPropagation();
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.name)));
  };

  return (
    <div className="flex flex-col h-full space-y-0 -m-6 md:-m-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card/50 backdrop-blur flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-primary" />
            File Manager
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Browse, edit and manage server files</p>
        </div>
        <div className="flex items-center gap-2">
          {clipboard && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePaste} disabled={pasteLoading}>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              {pasteLoading ? 'Pasting…' : `Paste "${clipboard.items[0]?.name}"`}
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => fetchDirectory(currentPath)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowUpload(v => !v)}>
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setNewItemType('directory'); setNewItemOpen(true); }}>
            <FolderPlus className="h-3.5 w-3.5" />
            New Folder
          </Button>
          <Button size="sm" variant="secondary" className="gap-1.5 text-xs" onClick={() => { setNewItemType('file'); setNewItemOpen(true); }}>
            <FilePlus className="h-3.5 w-3.5" />
            New File
          </Button>
          <div className="flex rounded-md border overflow-hidden">
            <button onClick={() => setViewMode('list')} className={`px-2 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
              <List className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setViewMode('grid')} className={`px-2 py-1.5 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Upload Zone ── */}
      {showUpload && (
        <div className="px-6 pt-4 flex-shrink-0">
          <UploadZone currentPath={currentPath} onSuccess={() => { fetchDirectory(currentPath); }} />
        </div>
      )}

      {/* ── Breadcrumb + Search ── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b bg-muted/20 flex-shrink-0 flex-wrap">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none">
          <button onClick={goUp} disabled={currentPath === '/'} className="p-1 rounded hover:bg-accent disabled:opacity-30 flex-shrink-0">
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          {breadcrumbs().map((crumb, i, arr) => (
            <span key={crumb.path} className="flex items-center gap-1 flex-shrink-0">
              {i === 0 ? (
                <button onClick={() => fetchDirectory('/')} className="flex items-center gap-1 text-xs font-medium hover:text-primary transition-colors">
                  <Home className="h-3 w-3" /> Root
                </button>
              ) : (
                <button
                  onClick={() => fetchDirectory(crumb.path)}
                  className={`text-xs transition-colors ${i === arr.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {crumb.label}
                </button>
              )}
              {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            </span>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search files… (Enter)"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
            onKeyDown={handleSearch}
            className="pl-8 h-8 text-xs w-56"
          />
          {searchResults !== null && (
            <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Stats */}
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {searching ? 'Searching…' : searchResults !== null ? `${searchResults.length} results` : `${items.filter(i => i.type === 'directory').length} folders, ${items.filter(i => i.type === 'file').length} files`}
        </span>
      </div>

      {/* ── File listing ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3" onClick={() => { setSelected(new Set()); setCtxMenu(null); }}>
        {loading ? (
          <div className="flex items-center justify-center p-20">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-sm text-muted-foreground">Loading directory…</p>
            </div>
          </div>
        ) : displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 gap-3">
            <Folder className="h-16 w-16 text-muted-foreground/20" />
            <p className="text-sm font-medium">{searchResults !== null ? 'No files match your search.' : 'This directory is empty.'}</p>
            <p className="text-xs text-muted-foreground">
              {searchResults !== null ? 'Try a different query.' : 'Create or upload files to get started.'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="rounded-xl border border-border/40 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[auto_1fr_120px_150px_100px_80px] gap-4 px-4 py-2 bg-muted/30 border-b text-[11px] text-muted-foreground font-medium sticky top-0">
              <div className="flex items-center">
                <input type="checkbox" className="rounded" checked={selected.size === items.length && items.length > 0} onChange={selectAll} onClick={e => e.stopPropagation()} />
              </div>
              <span>Name</span>
              <span className="text-right">Size</span>
              <span>Modified</span>
              <span>Permissions</span>
              <span className="text-right">Actions</span>
            </div>
            {/* Rows */}
            {displayItems.map(item => (
              <div
                key={item.name}
                onDoubleClick={() => navigate(item)}
                onContextMenu={e => handleContextMenu(e, item)}
                className={`grid grid-cols-[auto_1fr_120px_150px_100px_80px] gap-4 px-4 py-2.5 border-b last:border-0 items-center text-sm cursor-pointer transition-colors hover:bg-accent/40 group ${selected.has(item.name) ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center" onClick={e => toggleSelect(item.name, e)}>
                  <input type="checkbox" className="rounded" checked={selected.has(item.name)} readOnly />
                </div>
                <div className="flex items-center gap-2.5 min-w-0" onDoubleClick={() => navigate(item)}>
                  {getFileIcon(item)}
                  <span className="truncate text-xs font-medium">{item.name}</span>
                  {!item.readable && <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                </div>
                <div className="text-right text-[11px] text-muted-foreground">
                  {item.type === 'file' ? formatBytes(item.size) : '—'}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{formatDate(item.modified)}</div>
                <div>
                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{item.permissions}</code>
                </div>
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.type === 'file' && (
                    <button onClick={() => handleDownload(item)} className="p-1 rounded hover:bg-accent" title="Download">
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                  <button onClick={() => openRename(item)} className="p-1 rounded hover:bg-accent" title="Rename">
                    <Edit className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button onClick={() => setDeleteTarget(item)} className="p-1 rounded hover:bg-destructive/10" title="Delete">
                    <Trash2 className="h-3 w-3 text-rose-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Grid view */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {displayItems.map(item => (
              <div
                key={item.name}
                onDoubleClick={() => navigate(item)}
                onContextMenu={e => handleContextMenu(e, item)}
                onClick={e => { e.stopPropagation(); toggleSelect(item.name, e); }}
                className={`group relative flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${selected.has(item.name) ? 'bg-primary/5 border-primary/40 shadow-sm' : 'bg-card border-border/40 hover:bg-accent/30'}`}
              >
                {selected.has(item.name) && (
                  <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                )}
                {getFileIcon(item, 'h-10 w-10')}
                <span className="text-[11px] font-medium text-center break-all line-clamp-2 leading-tight">{item.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {item.type === 'file' ? formatBytes(item.size) : 'Folder'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-6 py-2.5 border-t bg-primary/5 flex-shrink-0">
          <span className="text-xs text-primary font-medium">{selected.size} item(s) selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => {
              const paths = Array.from(selected).map(n => ({ name: n, path: currentPath.replace(/\/$/, '') + '/' + n }));
              setClipboard({ items: paths, action: 'copy' });
              toast.info(`${paths.length} item(s) copied to clipboard.`);
            }}>
              <Copy className="h-3 w-3" /> Copy
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => {
              const paths = Array.from(selected).map(n => ({ name: n, path: currentPath.replace(/\/$/, '') + '/' + n }));
              setClipboard({ items: paths, action: 'cut' });
              toast.info(`${paths.length} item(s) cut to clipboard.`);
            }}>
              <MoveRight className="h-3 w-3" /> Cut
            </Button>
            <Button size="sm" variant="destructive" className="h-7 gap-1.5 text-xs" onClick={() => {
              if (selected.size === 1) {
                setDeleteTarget(items.find(i => i.name === [...selected][0]));
              }
            }}>
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* ── Context Menu ── */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y} item={ctxMenu.item}
          onClose={() => setCtxMenu(null)}
          onOpen={(item) => fetchDirectory(currentPath.replace(/\/$/, '') + '/' + item.name)}
          onEdit={openEditor}
          onRename={openRename}
          onCopy={handleCopy}
          onCut={handleCut}
          onDelete={(item) => setDeleteTarget(item)}
          onDownload={handleDownload}
          onChmod={openChmod}
          onCompress={openCompress}
          onExtract={handleExtract}
        />
      )}

      {/* ── File Editor ── */}
      <FileEditorModal
        open={editorOpen}
        file={editorLoading ? null : editorFile}
        filePath={editorPath}
        onClose={() => setEditorOpen(false)}
        onSave={() => fetchDirectory(currentPath)}
      />

      {/* ── New Item Dialog ── */}
      <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {newItemType === 'directory' ? <FolderPlus className="h-4 w-4 text-amber-400" /> : <FilePlus className="h-4 w-4 text-blue-400" />}
              New {newItemType === 'directory' ? 'Folder' : 'File'}
            </DialogTitle>
            <DialogDescription>Create a new {newItemType} in <code className="text-xs">{currentPath}</code></DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="flex rounded-md border overflow-hidden text-xs">
              {['file', 'directory'].map(t => (
                <button key={t} onClick={() => setNewItemType(t)} className={`flex-1 py-2 font-medium transition-colors ${newItemType === t ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}>
                  {t === 'file' ? '📄 File' : '📁 Folder'}
                </button>
              ))}
            </div>
            <Input
              placeholder={newItemType === 'directory' ? 'my-folder' : 'filename.txt'}
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewItemOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={newItemLoading || !newItemName.trim()}>
              {newItemLoading ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rename Dialog ── */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-4 w-4" /> Rename
            </DialogTitle>
            <DialogDescription>Rename <strong>{renameTarget?.name}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Input
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renameLoading || !renameName.trim()}>
              {renameLoading ? 'Renaming…' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Permissions Dialog ── */}
      <Dialog open={chmodOpen} onOpenChange={setChmodOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-400" /> File Permissions
            </DialogTitle>
            <DialogDescription>Change permissions for <strong>{chmodTarget?.name}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <Input
              value={chmodValue}
              onChange={e => setChmodValue(e.target.value)}
              placeholder="0755"
              className="font-mono"
            />
            <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
              {[['0755', 'rwxr-xr-x (dirs)'], ['0644', 'rw-r--r-- (files)'], ['0777', 'rwxrwxrwx'], ['0700', 'rwx------ (private)'], ['0600', 'rw------- (private)'], ['0440', 'r--r----- (readonly)']].map(([val, label]) => (
                <button key={val} onClick={() => setChmodValue(val)} className={`px-2 py-1.5 rounded border text-left transition-colors ${chmodValue === val ? 'border-primary bg-primary/5 text-primary' : 'border-border/40 hover:bg-accent'}`}>
                  <div className="font-mono font-bold">{val}</div>
                  <div className="text-muted-foreground truncate">{label}</div>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChmodOpen(false)}>Cancel</Button>
            <Button onClick={handleChmod} disabled={chmodLoading}>{chmodLoading ? 'Updating…' : 'Apply'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Compress Dialog ── */}
      <Dialog open={compressOpen} onOpenChange={setCompressOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-orange-400" /> Compress to Zip
            </DialogTitle>
            <DialogDescription>Archive <strong>{compressTarget?.name}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Input
              value={compressName}
              onChange={e => setCompressName(e.target.value)}
              placeholder="archive.zip"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompressOpen(false)}>Cancel</Button>
            <Button onClick={handleCompress} disabled={compressLoading}>{compressLoading ? 'Compressing…' : 'Compress'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Item"
        description={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
