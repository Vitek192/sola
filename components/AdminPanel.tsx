
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getUsers, adminCreateUser, adminDeleteUser, adminResetPassword } from '../services/auth';

export const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '' });
  const [msg, setMsg] = useState('');

  const refreshUsers = () => setUsers(getUsers());

  useEffect(() => {
    refreshUsers();
  }, []);

  const handleCreate = (e: React.FormEvent) => {
      e.preventDefault();
      try {
          adminCreateUser(newUser.username, newUser.password, newUser.email);
          setMsg('User created successfully');
          setNewUser({ username: '', email: '', password: '' });
          refreshUsers();
      } catch (e: any) {
          setMsg('Error: ' + e.message);
      }
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Delete this user? Their data will be lost.")) {
          adminDeleteUser(id);
          refreshUsers();
      }
  };

  const handleReset = (id: string) => {
      const newPass = prompt("Enter new password for user:");
      if (newPass) {
          adminResetPassword(id, newPass);
          alert("Password updated");
          refreshUsers();
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-8 rounded-xl border border-purple-700 shadow-xl">
            <h1 className="text-3xl font-bold text-white mb-2">🛡️ Super Admin Panel</h1>
            <p className="text-purple-200">Manage access and user credentials.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* User List */}
            <div className="bg-gray-850 p-6 rounded-xl border border-gray-750">
                <h2 className="text-xl font-bold text-white mb-4">Registered Users</h2>
                <div className="space-y-3">
                    {users.map(u => (
                        <div key={u.id} className="bg-gray-900 p-4 rounded border border-gray-800 flex justify-between items-center">
                            <div>
                                <div className="font-bold text-white flex items-center gap-2">
                                    {u.username}
                                    {u.role === 'ADMIN' && <span className="bg-purple-500 text-[10px] px-1 rounded text-white">ADMIN</span>}
                                </div>
                                <div className="text-xs text-gray-500">{u.email}</div>
                            </div>
                            {u.role !== 'ADMIN' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleReset(u.id)} className="text-xs bg-gray-800 hover:bg-gray-700 text-blue-400 px-2 py-1 rounded">Reset PW</button>
                                    <button onClick={() => handleDelete(u.id)} className="text-xs bg-red-900/20 hover:bg-red-900/40 text-red-400 px-2 py-1 rounded">Delete</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Create User */}
            <div className="bg-gray-850 p-6 rounded-xl border border-gray-750">
                <h2 className="text-xl font-bold text-white mb-4">Add New User</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                    <input 
                        type="text" placeholder="Username" required
                        value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})}
                        className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-white"
                    />
                    <input 
                        type="email" placeholder="Email" required
                        value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                        className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-white"
                    />
                    <input 
                        type="password" placeholder="Password" required
                        value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
                        className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-white"
                    />
                    <button type="submit" className="w-full bg-solana-green hover:bg-emerald-500 text-gray-900 font-bold py-2 rounded">Create User</button>
                    {msg && <p className="text-center text-sm text-yellow-400">{msg}</p>}
                </form>
            </div>
        </div>
    </div>
  );
};
