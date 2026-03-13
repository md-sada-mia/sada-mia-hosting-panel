import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Terminal as TerminalIcon, Play, Trash2, FolderOpen, Loader2, HardDrive, Cpu, Activity, Database, Fingerprint } from 'lucide-react';

const stripAnsi = (str) => {
  if (!str) return '';
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

const QUICK_COMMANDS = [
  { label: 'List Files', cmd: 'ls -la', icon: FolderOpen, color: 'text-blue-400' },
  { label: 'Check Disk Space', cmd: 'df -h', icon: HardDrive, color: 'text-emerald-400' },
  { label: 'Check Memory', cmd: 'free -m', icon: Cpu, color: 'text-purple-400' },
  { label: 'Running Processes', cmd: 'ps aux | head -n 10', icon: Activity, color: 'text-amber-400' },
  { label: 'Current Directory', cmd: 'pwd', icon: Database, color: 'text-sky-400' },
  { label: 'Who Am I', cmd: 'whoami', icon: Fingerprint, color: 'text-rose-400' },
];

export default function TerminalPage() {
  const [searchParams] = useSearchParams();
  const defaultPath = searchParams.get('path');

  const [cwd, setCwd] = useState('~');
  const [user, setUser] = useState('user');
  const [hostname, setHostname] = useState('host');
  const [osInfo, setOsInfo] = useState('');
  
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [outputLines, setOutputLines] = useState([
    { type: 'system', text: 'Welcome to Sada Mia Terminal.' },
    { type: 'system', text: 'Type a command and press Enter to execute.' },
    { type: 'system', text: '---' }
  ]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchInfo();
  }, [defaultPath]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [outputLines]);

  const fetchInfo = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/terminal/info', {
        params: { path: defaultPath }
      });
      setCwd(data.cwd);
      setUser(data.user);
      setHostname(data.hostname);
      setOsInfo(data.os);
    } catch (err) {
      toast.error('Failed to initialize terminal context');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const executeCommand = async (cmdToRunStr) => {
    const cmdStr = cmdToRunStr.trim();
    if (!cmdStr) return;

    // Local commands
    if (cmdStr === 'clear') {
      setOutputLines([]);
      setCommand('');
      return;
    }

    setExecuting(true);
    // Add command to history
    setHistory(prev => [...prev, cmdStr]);
    setHistoryIndex(-1);
    
    // Add echo to output
    setOutputLines(prev => [...prev, { 
      type: 'input', 
      text: `${user}@${hostname}:${cwd}$ ${cmdStr}` 
    }]);

    setCommand('');

    try {
      const { data } = await api.post('/terminal/execute', {
        command: cmdStr,
        cwd: cwd
      });

      if (data.cwd) {
        setCwd(data.cwd); // Updated path from 'cd'
      }

      if (data.output) {
        const lines = data.output.split('\n');
        // clean last empty line if ends with newline
        if (lines[lines.length-1] === '') lines.pop();
        
        const newOutputs = lines.map(line => ({
          type: data.exit_code === 0 ? 'output' : 'error',
          text: stripAnsi(line)
        }));
        
        setOutputLines(prev => [...prev, ...newOutputs]);
      } else if (data.exit_code !== 0) {
         setOutputLines(prev => [...prev, { type: 'error', text: `Command exited with code ${data.exit_code}` }]);
      }
    } catch (err) {
      const errorText = err.response?.data?.output || err.response?.data?.error || err.message;
      setOutputLines(prev => [...prev, { type: 'error', text: stripAnsi(errorText) }]);
    } finally {
      setExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      executeCommand(command);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIdx = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIdx);
        setCommand(history[history.length - 1 - newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIdx = historyIndex - 1;
        setHistoryIndex(newIdx);
        setCommand(history[history.length - 1 - newIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleAutocomplete();
    }
  };

  const handleAutocomplete = async () => {
    // Basic logic: find the last word
    const parts = command.split(' ');
    const lastPart = parts[parts.length - 1];
    
    // We only try to autocomplete if there's *something* or we want to list directory
    try {
      const { data } = await api.get('/terminal/autocomplete', {
        params: { cwd, partial: lastPart }
      });
      
      const matches = data.matches || [];
      
      if (matches.length === 1) {
        // Exact match
        let replacement = matches[0];
        // If it's a directory, we don't add a space
        const hasTrailingSlash = replacement.endsWith('/');
        parts[parts.length - 1] = replacement;
        setCommand(parts.join(' ') + (hasTrailingSlash ? '' : ' '));
      } else if (matches.length > 1) {
        // Multiple matches, show them and find common prefix
        setOutputLines(prev => [
          ...prev, 
          { type: 'input', text: `${user}@${hostname}:${cwd}$ ${command}` },
          { type: 'output', text: matches.join('  ') }
        ]);
        
        // Find longest common prefix
        let prefix = '';
        const shortest = matches.reduce((a, b) => a.length <= b.length ? a : b);
        for (let i = 0; i < shortest.length; i++) {
            const char = shortest[i];
            if (matches.every(m => m[i] === char)) {
                prefix += char;
            } else {
                break;
            }
        }
        
        if (prefix.length > lastPart.length) {
            // we have a partial common prefix we can auto-fill
            // Make sure we include any directory path we were already typing
            const dirPart = lastPart.substring(0, lastPart.lastIndexOf('/') + 1);
            parts[parts.length - 1] = dirPart + prefix;
            setCommand(parts.join(' '));
        }
      }
    } catch (err) {
      console.error('Autocomplete failed', err);
    }
  };

  const handleClear = () => {
    setOutputLines([]);
    inputRef.current?.focus();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-h-[calc(100vh-6rem)] gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Terminal Access</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-mono">{user}@{hostname}</span>
            <span className="text-xs">{osInfo}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="h-4 w-4 mr-2" /> Clear Console
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Terminal Window */}
        <Card className="flex-1 flex flex-col bg-[#0c0c0c] border-white/10 shadow-xl overflow-hidden min-h-0 relative">
          
          {/* Mac-like Header */}
          <div className="h-10 bg-white/5 border-b border-white/10 flex items-center px-4 shrink-0">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            </div>
            <div className="mx-auto flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <FolderOpen className="h-3 w-3" />
              {cwd}
            </div>
          </div>

          {/* Console Area */}
          <CardContent 
            className="flex-1 overflow-y-auto p-4 font-mono text-sm"
            onClick={() => inputRef.current?.focus()}
          >
            <div className="space-y-1 pb-4">
              {outputLines.map((line, idx) => (
                <div 
                  key={idx} 
                  className={`whitespace-pre-wrap break-all ${
                    line.type === 'system' ? 'text-blue-400 font-bold' :
                    line.type === 'input' ? 'text-white font-bold' :
                    line.type === 'error' ? 'text-rose-400' :
                    'text-emerald-400/90'
                  }`}
                >
                  {line.text}
                </div>
              ))}
              
              {/* Input Line */}
              <div className="flex items-start break-all">
                <span className="text-emerald-400 font-bold mr-2 shrink-0">
                  {user}@{hostname}:<span className="text-blue-400">{cwd === '~' ? '~' : cwd.split('/').pop() || '/'}</span>$
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={executing}
                  className="flex-1 bg-transparent border-none outline-none text-white focus:ring-0 p-0 text-sm font-mono caret-white min-w-[100px]"
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  onBlur={() => {
                    // Slight delay to allow clicks on quick commands to go through before stealing focus back
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                />
              </div>
              {executing && (
                <div className="text-muted-foreground animate-pulse text-xs mt-2 flex items-center gap-2">
                  <div className="w-1.5 h-3 bg-white/50 animate-bounce"></div> Running command...
                </div>
              )}
              <div ref={endRef} />
            </div>
          </CardContent>
        </Card>

        {/* Quick Commands Sidebar */}
        <div className="w-64 max-w-sm flex flex-col gap-3 shrink-0 overflow-y-auto pr-1">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">Quick Commands</h3>
          {QUICK_COMMANDS.map((qc, i) => (
            <button
              key={i}
              onClick={() => executeCommand(qc.cmd)}
              disabled={executing}
              className="flex items-start gap-3 p-3 text-left rounded-xl border bg-card/40 hover:bg-accent/40 transition-colors cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className={`p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors ${qc.color}`}>
                <qc.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">{qc.label}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-[140px]">{qc.cmd}</p>
              </div>
            </button>
          ))}
          
          <div className="mt-4 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
            <h4 className="text-xs font-bold text-rose-400 mb-2 uppercase tracking-wider">Security Notice</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Commands are executed as the PHP runtime user. Dangerous commands (like rm -rf /) are blocked by policy. Max execution time is 30s.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
