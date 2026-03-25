import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { User, Plus, Trash2, Key, Database, ArrowLeft, Shield } from 'lucide-react';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function DatabaseUsersPage() {
  const [users, setUsers] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newGlobalPrivs, setNewGlobalPrivs] = useState({ CREATEDB: false, CREATEROLE: false, SUPERUSER: false });
  
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [userToChangePassword, setUserToChangePassword] = useState(null);
  const [changePasswordValue, setChangePasswordValue] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [userToManagePermissions, setUserToManagePermissions] = useState(null);
  const [selectedDbs, setSelectedDbs] = useState({});
  const [isSyncingPermissions, setIsSyncingPermissions] = useState(false);

  const [userToManageGlobalPrivs, setUserToManageGlobalPrivs] = useState(null);
  const [selectedGlobalPrivs, setSelectedGlobalPrivs] = useState({ CREATEDB: false, CREATEROLE: false, SUPERUSER: false });
  const [isSyncingGlobalPrivs, setIsSyncingGlobalPrivs] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const [usersRes, dbsRes] = await Promise.all([
        api.get('/databases/users'),
        api.get('/databases') // Needs simple list of DBs
      ]);
      setUsers(usersRes.data);
      setDatabases(dbsRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load database users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    
    setCreating(true);
    try {
      const global_privileges = Object.keys(newGlobalPrivs).filter(k => newGlobalPrivs[k]);
      await api.post('/databases/users', { 
        username: newUsername,
        password: newPassword,
        global_privileges
      });
      setNewUsername('');
      setNewPassword('');
      setNewGlobalPrivs({ CREATEDB: false, CREATEROLE: false, SUPERUSER: false });
      fetchData();
      toast.success('Database user created successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create database user');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/databases/users/${userToDelete.id}`);
      toast.success(`User "${userToDelete.username}" deleted`);
      fetchData();
      setUserToDelete(null);
    } catch (err) {
      toast.error('Failed to delete database user');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!userToChangePassword || !changePasswordValue) return;

    setIsChangingPassword(true);
    try {
      await api.post(`/databases/users/${userToChangePassword.id}/password`, { password: changePasswordValue });
      toast.success('User password updated successfully');
      setUserToChangePassword(null);
      setChangePasswordValue('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const openManagePermissions = (user) => {
    setUserToManagePermissions(user);
    const initialDbs = {};
    if (user.databases) {
      user.databases.forEach(db => {
        initialDbs[db.id] = db.pivot?.privileges || 'all';
      });
    }
    setSelectedDbs(initialDbs);
  };

  const toggleDbSelection = (dbId) => {
    setSelectedDbs(prev => {
      const next = { ...prev };
      if (next[dbId]) {
        delete next[dbId];
      } else {
        next[dbId] = 'all';
      }
      return next;
    });
  };

  const updatePrivilege = (dbId, newPriv) => {
    setSelectedDbs(prev => ({ ...prev, [dbId]: newPriv }));
  };

  const handleSyncPermissions = async (e) => {
    e.preventDefault();
    if (!userToManagePermissions) return;

    setIsSyncingPermissions(true);
    try {
      const databasesPayload = Object.entries(selectedDbs).map(([id, privileges]) => ({
        id: parseInt(id, 10),
        privileges
      }));
      await api.post(`/databases/users/${userToManagePermissions.id}/permissions`, { databases: databasesPayload });
      toast.success('Permissions synced successfully');
      setUserToManagePermissions(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to sync permissions');
    } finally {
      setIsSyncingPermissions(false);
    }
  };

  const openManageGlobalPrivs = (user) => {
    setUserToManageGlobalPrivs(user);
    const flags = user.global_privileges || [];
    setSelectedGlobalPrivs({
      CREATEDB: flags.includes('CREATEDB'),
      CREATEROLE: flags.includes('CREATEROLE'),
      SUPERUSER: flags.includes('SUPERUSER'),
    });
  };

  const handleSyncGlobalPrivs = async (e) => {
    e.preventDefault();
    if (!userToManageGlobalPrivs) return;

    setIsSyncingGlobalPrivs(true);
    try {
      const global_privileges = Object.keys(selectedGlobalPrivs).filter(k => selectedGlobalPrivs[k]);
      await api.post(`/databases/users/${userToManageGlobalPrivs.id}/global-privileges`, { global_privileges });
      toast.success('Global privileges updated successfully');
      setUserToManageGlobalPrivs(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to sync global privileges');
    } finally {
      setIsSyncingGlobalPrivs(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8 -ml-2 text-muted-foreground">
              <Link to="/databases">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h2 className="text-3xl font-bold tracking-tight">Database Users</h2>
          </div>
          <p className="text-muted-foreground ml-8">Manage additional users and their access to databases.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input 
            placeholder="Search users..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 h-9"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Create User Form */}
        <div className="xl:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create User</CardTitle>
              <CardDescription>Creates a new additional PostgreSQL user.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <Input 
                    placeholder="new_user" 
                    value={newUsername} 
                    onChange={e => setNewUsername(e.target.value)} 
                    pattern="[a-zA-Z0-9_]+"
                    required 
                  />
                  <p className="text-xs text-muted-foreground">Only letters, numbers, and underscores.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input 
                    type="password"
                    placeholder="At least 8 characters" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    minLength={8}
                    required 
                  />
                </div>
                <Button type="submit" className="w-full mt-4" disabled={creating || !newUsername || newPassword.length < 8}>
                  {creating ? 'Creating...' : <><Plus className="mr-2 h-4 w-4" /> Create User</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* User List */}
        <div className="xl:col-span-2 space-y-4">
          {loading ? (
             <div className="h-32 flex items-center justify-center text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <Card className="border-dashed flex flex-col items-center justify-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mb-4 opacity-20" />
              <p>No additional users created yet.</p>
            </Card>
          ) : (
            users
              .filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(user => (<Card key={user.id}>
                 <CardContent className="p-4 sm:p-6">
                   <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                     <div className="flex items-center gap-4 flex-1 min-w-0">
                       <div className="bg-primary/10 p-3 rounded-full text-primary flex-shrink-0">
                         <User className="h-6 w-6" />
                       </div>
                       <div className="min-w-0">
                         <h3 className="font-semibold text-lg truncate">{user.username}</h3>
                         <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-1 items-center">
                           <Database className="h-3 w-3 inline" /> 
                           {user.databases?.length ? (
                             <span>Access to {user.databases.length} database{user.databases.length === 1 ? '' : 's'}</span>
                           ) : (
                             <span className="text-destructive/80">No database access</span>
                           )}
                         </div>
                       </div>
                     </div>
                     <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                       <Badge variant={user.status === 'active' ? 'success' : 'destructive'}>{user.status}</Badge>
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="border-primary/20 hover:bg-primary/5"
                         onClick={() => openManagePermissions(user)}
                       >
                         <Shield className="mr-2 h-4 w-4" /> Permissions
                       </Button>
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="border-primary/20 hover:bg-primary/5"
                         onClick={() => openManageGlobalPrivs(user)}
                       >
                         <Shield className="mr-2 h-4 w-4" /> Global Privileges
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="text-muted-foreground hover:text-primary hover:bg-primary/10" 
                         onClick={() => setUserToChangePassword(user)}
                         title="Change Password"
                       >
                         <Key className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setUserToDelete(user)}>
                         <Trash2 className="h-5 w-5" />
                       </Button>
                     </div>
                   </div>
                   {((user.databases?.length > 0) || (user.global_privileges?.length > 0)) && (
                     <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
                       {user.global_privileges?.map(priv => (
                         <div key={priv} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-mono text-xs font-semibold">
                           {priv}
                         </div>
                       ))}
                       {user.databases?.map(db => (
                         <div key={db.id} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground font-mono text-xs">
                           <span>{db.db_name}</span>
                           <span className="opacity-50 text-[10px] uppercase border-l pl-1.5 ml-0.5 border-secondary-foreground/20">{db.pivot?.privileges || 'read'}</span>
                         </div>
                       ))}
                     </div>
                   )}
                 </CardContent>
               </Card>
            ))
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
        title="Delete User"
        description={`WARNING: This will permanently delete the user "${userToDelete?.username}". This could break any applications relying on these credentials. This action cannot be undone.`}
        confirmText="Delete User"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />

      <Dialog open={!!userToChangePassword} onOpenChange={(open) => !open && setUserToChangePassword(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handlePasswordChange}>
            <DialogHeader>
              <DialogTitle>Change User Password</DialogTitle>
              <DialogDescription>
                Enter a new password for user <span className="font-semibold">{userToChangePassword?.username}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  value={changePasswordValue}
                  onChange={(e) => setChangePasswordValue(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUserToChangePassword(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isChangingPassword || changePasswordValue.length < 8}>
                {isChangingPassword ? 'Changing...' : 'Change Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToManageGlobalPrivs} onOpenChange={(open) => !open && setUserToManageGlobalPrivs(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSyncGlobalPrivs}>
            <DialogHeader>
              <DialogTitle>Mange Global Privileges</DialogTitle>
              <DialogDescription>
                Select Postgres-level privileges for <span className="font-semibold">{userToManageGlobalPrivs?.username}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {['CREATEDB', 'CREATEROLE', 'SUPERUSER'].map(priv => (
                <label key={priv} className="flex items-start gap-3 p-3 rounded border hover:bg-accent cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={selectedGlobalPrivs[priv]}
                    onChange={(e) => setSelectedGlobalPrivs({...selectedGlobalPrivs, [priv]: e.target.checked})}
                  />
                  <div className="flex-1">
                    <div className="font-medium font-mono text-sm">{priv}</div>
                    <div className="text-xs text-muted-foreground">
                      {priv === 'CREATEDB' && 'Allows user to create new databases.'}
                      {priv === 'CREATEROLE' && 'Allows user to create and manage other roles.'}
                      {priv === 'SUPERUSER' && 'WARNING: Bypasses all permission checks in PostgreSQL.'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUserToManageGlobalPrivs(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSyncingGlobalPrivs}>
                {isSyncingGlobalPrivs ? 'Saving...' : 'Save Privileges'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!userToManagePermissions} onOpenChange={(open) => !open && setUserToManagePermissions(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSyncPermissions}>
            <DialogHeader>
              <DialogTitle>Manage Permissions</DialogTitle>
              <DialogDescription>
                Select which databases user <span className="font-semibold">{userToManagePermissions?.username}</span> has access to.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="border rounded-md max-h-[300px] overflow-y-auto p-2">
                {databases.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">No databases exist.</div>
                ) : (
                  <div className="space-y-1">
                    {databases.map(db => {
                      const isSelected = !!selectedDbs[db.id];
                      return (
                      <div key={db.id} className="flex flex-col gap-2 p-3 border-b last:border-0 hover:bg-accent/50 transition-colors rounded">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={isSelected}
                            onChange={() => toggleDbSelection(db.id)}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{db.db_name}</div>
                            <div className="text-xs text-muted-foreground">Owner: {db.db_user}</div>
                          </div>
                        </label>
                        {isSelected && (
                          <div className="ml-7 flex items-center flex-wrap gap-4 text-sm mt-1">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input 
                                type="radio" 
                                name={`priv_${db.id}`} 
                                checked={selectedDbs[db.id] === 'read'} 
                                onChange={() => updatePrivilege(db.id, 'read')}
                                className="h-3.5 w-3.5 text-primary focus:ring-primary border-gray-300" 
                              />
                              <span className="text-muted-foreground hover:text-foreground">Read-only</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input 
                                type="radio" 
                                name={`priv_${db.id}`} 
                                checked={selectedDbs[db.id] === 'write'} 
                                onChange={() => updatePrivilege(db.id, 'write')}
                                className="h-3.5 w-3.5 text-primary focus:ring-primary border-gray-300" 
                              />
                              <span className="text-muted-foreground hover:text-foreground">Read/Write</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input 
                                type="radio" 
                                name={`priv_${db.id}`} 
                                checked={selectedDbs[db.id] === 'all'} 
                                onChange={() => updatePrivilege(db.id, 'all')}
                                className="h-3.5 w-3.5 text-primary focus:ring-primary border-gray-300" 
                              />
                              <span className="text-muted-foreground hover:text-foreground">All Privileges</span>
                            </label>
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUserToManagePermissions(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSyncingPermissions}>
                {isSyncingPermissions ? 'Saving...' : 'Save Permissions'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
