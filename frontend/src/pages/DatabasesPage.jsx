import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Database, Plus, Trash2, Copy, CheckCircle2, ExternalLink } from 'lucide-react';

export default function DatabasesPage() {
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [newCredentials, setNewCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchDatabases = async () => {
    try {
      const { data } = await api.get('/databases');
      setDatabases(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newDbName) return;
    
    setCreating(true);
    setNewCredentials(null);
    try {
      const { data } = await api.post('/databases', { db_name: newDbName });
      setNewCredentials(data);
      setNewDbName('');
      fetchDatabases();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create database');
    } finally {
      setCreating(false);
    }
  };

  const handleManage = async (dbId) => {
    try {
      const { data } = await api.get(`/databases/${dbId}/credentials`);
      
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/adminer/';
      form.target = '_blank';

      const fields = {
        'auth[driver]': 'pgsql',
        'auth[server]': '127.0.0.1',
        'auth[username]': data.db_user,
        'auth[password]': data.db_password,
        'auth[db]': data.db_name,
      };

      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch (err) {
      alert('Failed to retrieve credentials for autologin');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`WARNING: This will permanently delete the database "${name}" and all its data. Continue?`)) return;
    try {
      await api.delete(`/databases/${id}`);
      fetchDatabases();
      if (newCredentials?.id === id) setNewCredentials(null);
    } catch (err) {
      alert('Failed to delete database');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(`DB_CONNECTION=pgsql\nDB_HOST=127.0.0.1\nDB_PORT=5432\nDB_DATABASE=${text.db_name}\nDB_USERNAME=${text.db_user}\nDB_PASSWORD=${text.db_password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">PostgreSQL Databases</h2>
          <p className="text-muted-foreground mt-1">Manage local PostgreSQL databases and users.</p>
        </div>
        <Button variant="outline" onClick={() => window.open('/adminer', '_blank')}>
          <ExternalLink className="mr-2 h-4 w-4" /> Open Adminer
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Create DB Form */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Database</CardTitle>
              <CardDescription>Creates a new database and a dedicated user.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Database Name</label>
                  <Input 
                    placeholder="my_app_db" 
                    value={newDbName} 
                    onChange={e => setNewDbName(e.target.value)} 
                    pattern="[a-zA-Z0-9_]+"
                    required 
                  />
                  <p className="text-xs text-muted-foreground">Only letters, numbers, and underscores.</p>
                </div>
                <Button type="submit" className="w-full" disabled={creating || !newDbName}>
                  {creating ? 'Creating...' : <><Plus className="mr-2 h-4 w-4" /> Create Database</>}
                </Button>
              </form>
            </CardContent>
          </Card>

          {newCredentials && (
            <Card className="border-success/50 bg-success/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-success flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5" /> Database Created
                </CardTitle>
                <CardDescription>
                  Please copy these credentials now. The password will not be shown again!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 font-mono text-sm">
                <div><span className="text-muted-foreground block text-xs">Host:</span> 127.0.0.1</div>
                <div><span className="text-muted-foreground block text-xs">Port:</span> 5432</div>
                <div><span className="text-muted-foreground block text-xs">Database:</span> {newCredentials.db_name}</div>
                <div><span className="text-muted-foreground block text-xs">Username:</span> {newCredentials.db_user}</div>
                <div>
                  <span className="text-muted-foreground block text-xs">Password:</span> 
                  <span className="text-foreground bg-black px-2 py-1 rounded">{newCredentials.db_password}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4" 
                  onClick={() => copyToClipboard(newCredentials)}
                >
                  {copied ? 'Copied .env format!' : <><Copy className="mr-2 h-4 w-4" /> Copy .env format</>}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* DB List */}
        <div className="md:col-span-2 space-y-4">
          {loading ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">Loading databases...</div>
          ) : databases.length === 0 ? (
            <Card className="border-dashed flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Database className="h-12 w-12 mb-4 opacity-20" />
              <p>No databases provisioned yet.</p>
            </Card>
          ) : (
            databases.map(db => (
               <Card key={db.id}>
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-full text-primary">
                      <Database className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{db.db_name}</h3>
                      <div className="text-sm text-muted-foreground mt-1">
                        User: <span className="font-mono">{db.db_user}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={db.status === 'active' ? 'success' : 'destructive'}>{db.status}</Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-primary border-primary/20 hover:bg-primary/5"
                      onClick={() => handleManage(db.id)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" /> Manage
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(db.id, db.db_name)}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
