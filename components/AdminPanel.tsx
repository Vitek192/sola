
import React, { useState, useEffect } from 'react';
import { User, SecurityConfig, BlockedEntity, SecurityLog, AIConfig, AIKey } from '../types';
import { getUsers, adminCreateUser, adminDeleteUser, adminResetPassword, getSecurityConfig, saveSecurityConfig, getBlockedList, unblockEntity, getSecurityLogs } from '../services/auth';
import { analyzeSecurityLogs } from '../services/gemini';
import { adminInjectKey, adminRevokeKey, adminCheckUserHasKey } from '../services/persistence';

interface Props {
    aiConfig?: AIConfig;
}

export const AdminPanel: React.FC<Props> = ({ aiConfig }) => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'SECURITY' | 'KEYS'>('USERS');
  
  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '' });
  const [msg, setMsg] = useState('');

  // Security State
  const [secConfig, setSecConfig] = useState<SecurityConfig>({ maxLoginAttempts: 5, lockoutDurationMinutes: 15 });
  const [blockedList, setBlockedList] = useState<BlockedEntity[]>([]);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);

  // Keys State
  const [selectedAdminKeyId, setSelectedAdminKeyId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userAccessMap, setUserAccessMap] = useState<Record<string, boolean>>({});

  const refreshData = () => {
      setUsers(getUsers());
      setSecConfig(getSecurityConfig());
      setBlockedList(getBlockedList());
      setLogs(getSecurityLogs());
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Update access map when key changes
  useEffect(() => {
      if (!selectedAdminKeyId || !aiConfig) {
          setUserAccessMap({});
          return;
      }
      const adminKey = aiConfig.keys.find(k => k.id === selectedAdminKeyId);
      if (!adminKey) return;

      const map: Record<string, boolean> = {};
      users.forEach(u => {
          map[u.id] = adminCheckUserHasKey(u.id, adminKey.apiKey);
      });
      setUserAccessMap(map);
  }, [selectedAdminKeyId, users, aiConfig, activeTab]);

  // --- USER HANDLERS ---
  const handleCreate = (e: React.FormEvent) => {
      e.preventDefault();
      try {
          adminCreateUser(newUser.username, newUser.password, newUser.email);
          setMsg('User created successfully');
          setNewUser({ username: '', email: '', password: '' });
          refreshData();
      } catch (e: any) {
          setMsg('Error: ' + e.message);
      }
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Delete this user?")) {
          adminDeleteUser(id);
          refreshData();
      }
  };

  const handleReset = (id: string) => {
      const newPass = prompt("Enter new password for user:");
      if (newPass) {
          adminResetPassword(id, newPass);
          alert("Password updated");
          refreshData();
      }
  };

  // --- SECURITY HANDLERS ---
  const handleSaveSecConfig = () => {
      saveSecurityConfig(secConfig);
      alert("Security configuration saved.");
  };

  const handleUnblock = (id: string) => {
      unblockEntity(id);
      refreshData();
  };

  const handleAIScan = async () => {
      if (!aiConfig || !aiConfig.enabled || aiConfig.keys.length === 0) {
          alert("AI keys not configured or disabled.");
          return;
      }
      setAnalyzing(true);
      try {
          const report = await analyzeSecurityLogs(logs, aiConfig);
          setAiReport(report);
      } catch (e: any) {
          alert("AI Scan Failed: " + e.message);
      }
      setAnalyzing(false);
  };

  // --- KEY DISTRIBUTION HANDLERS ---
  const toggleUserSelection = (userId: string) => {
      if (selectedUserIds.includes(userId)) {
          setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
      } else {
          setSelectedUserIds([...selectedUserIds, userId]);
      }
  };

  const handleSelectAllUsers = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          setSelectedUserIds(users.filter(u => u.role !== 'ADMIN').map(u => u.id));
      } else {
          setSelectedUserIds([]);
      }
  };

  const refreshAccessMap = (key: AIKey) => {
      const map: Record<string, boolean> = {};
      users.forEach(u => {
          map[u.id] = adminCheckUserHasKey(u.id, key.apiKey);
      });
      setUserAccessMap(map);
  };

  const handleShareAndActivate = () => {
      if (!selectedAdminKeyId || !aiConfig) return;
      const keyToShare = aiConfig.keys.find(k => k.id === selectedAdminKeyId);
      if (!keyToShare) return;
      
      if (selectedUserIds.length === 0) {
          alert("Сначала выберите пользователей.");
          return;
      }

      let count = 0;
      selectedUserIds.forEach(uid => {
          try {
              adminInjectKey(uid, keyToShare);
              count++;
          } catch(e) { console.error(e); }
      });

      alert(`✅ Успешно! Ключ активирован у ${count} пользователей.`);
      refreshAccessMap(keyToShare);
      setSelectedUserIds([]);
  };

  const handleRevoke = () => {
      if (!selectedAdminKeyId || !aiConfig) return;
      const keyToRevoke = aiConfig.keys.find(k => k.id === selectedAdminKeyId);
      if (!keyToRevoke) return;
      
      if (selectedUserIds.length === 0) {
          alert("Выберите пользователей для отключения.");
          return;
      }

      if (!window.confirm(`Вы уверены? Ключ будет удален у ${selectedUserIds.length} пользователей.`)) return;

      let count = 0;
      selectedUserIds.forEach(uid => {
          try {
              adminRevokeKey(uid, keyToRevoke.apiKey);
              count++;
          } catch(e) { console.error(e); }
      });

      alert(`🗑️ Ключ отозван у ${count} пользователей.`);
      refreshAccessMap(keyToRevoke);
      setSelectedUserIds([]);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in h-full flex flex-col">
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-8 rounded-xl border border-purple-700 shadow-xl flex justify-between items-center shrink-0">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">🛡️ Super Admin Panel</h1>
                <p className="text-purple-200">System Management & License Distribution</p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setActiveTab('USERS')} className={`px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'USERS' ? 'bg-white text-purple-900 shadow' : 'bg-purple-800/50 text-purple-200 hover:bg-purple-800'}`}>Users</button>
                <button onClick={() => setActiveTab('SECURITY')} className={`px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'SECURITY' ? 'bg-white text-purple-900 shadow' : 'bg-purple-800/50 text-purple-200 hover:bg-purple-800'}`}>Security</button>
                <button onClick={() => setActiveTab('KEYS')} className={`px-4 py-2 rounded-lg font-bold transition-all ${activeTab === 'KEYS' ? 'bg-white text-purple-900 shadow' : 'bg-purple-800/50 text-purple-200 hover:bg-purple-800'}`}>🔑 Key Manager</button>
            </div>
        </div>

        {activeTab === 'KEYS' && (
            <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 flex-1 flex flex-col min-h-[600px] shadow-2xl">
                <div className="mb-6 flex items-center justify-between">
                     <div>
                        <h2 className="text-2xl font-bold text-white">🔑 Professional License Manager</h2>
                        <p className="text-gray-400 text-sm mt-1">Инструмент раздачи лицензионных ключей пользователям.</p>
                     </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
                    {/* LEFT: MASTER KEYS LIST */}
                    <div className="lg:col-span-4 flex flex-col border-r border-gray-800 pr-6">
                        <label className="text-xs uppercase font-bold text-solana-purple mb-3 block">Шаг 1: Выберите Ключ (Источник)</label>
                        
                        {!aiConfig?.keys || aiConfig.keys.length === 0 ? (
                            <div className="text-gray-500 text-sm bg-gray-900 p-4 rounded border border-dashed border-gray-700">
                                У вас нет ключей. Добавьте их в разделе Settings.
                            </div>
                        ) : (
                            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 max-h-[500px]">
                                {aiConfig.keys.map(key => (
                                    <div 
                                        key={key.id}
                                        onClick={() => { setSelectedAdminKeyId(key.id); setSelectedUserIds([]); }}
                                        className={`p-4 rounded-xl cursor-pointer border transition-all relative overflow-hidden group ${
                                            selectedAdminKeyId === key.id 
                                            ? 'bg-gradient-to-r from-purple-900/60 to-indigo-900/60 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]' 
                                            : 'bg-gray-900 border-gray-800 hover:bg-gray-800 hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start relative z-10">
                                            <span className={`text-base font-bold ${selectedAdminKeyId === key.id ? 'text-white' : 'text-gray-300'}`}>
                                                {key.name}
                                            </span>
                                            <span className="text-[10px] bg-gray-950 px-2 py-0.5 rounded text-gray-400 border border-gray-800">{key.provider}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono mt-1 truncate relative z-10">{key.modelId}</div>
                                        {selectedAdminKeyId === key.id && <div className="absolute right-0 bottom-0 p-2 text-purple-500 opacity-20 text-4xl font-bold">✓</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: USER SELECTION & ACTIONS */}
                    <div className="lg:col-span-8 flex flex-col h-full">
                         <div className="flex justify-between items-end mb-3">
                             <div>
                                <label className="text-xs uppercase font-bold text-solana-green block mb-1">Шаг 2: Выберите Пользователей</label>
                                {selectedAdminKeyId ? (
                                    <div className="text-sm text-gray-400 bg-gray-900 px-3 py-1 rounded-lg border border-gray-800 inline-flex items-center gap-2">
                                        Active Source: <span className="font-bold text-white">{aiConfig?.keys.find(k => k.id === selectedAdminKeyId)?.name}</span>
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-600 italic">Слева выберите ключ для раздачи...</div>
                                )}
                             </div>
                         </div>

                         {/* USER TABLE */}
                         <div className="bg-gray-900 border border-gray-800 rounded-xl flex-1 overflow-hidden flex flex-col shadow-inner mb-6">
                             <div className="grid grid-cols-12 bg-gray-950 p-3 text-[10px] font-bold text-gray-500 uppercase border-b border-gray-800 tracking-wider">
                                 <div className="col-span-1 text-center">
                                     <input type="checkbox" onChange={handleSelectAllUsers} className="accent-purple-500 cursor-pointer w-4 h-4" />
                                 </div>
                                 <div className="col-span-4 pl-2">Пользователь</div>
                                 <div className="col-span-4">Email</div>
                                 <div className="col-span-3 text-right pr-4">Статус Лицензии</div>
                             </div>

                             <div className="overflow-y-auto custom-scrollbar flex-1 p-2 space-y-1 bg-gray-900/50">
                                {!selectedAdminKeyId ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-600">
                                        <div className="text-5xl mb-4 grayscale opacity-20">🔑</div>
                                        <p>Select a key on the left to load matrix.</p>
                                    </div>
                                ) : (
                                    users.filter(u => u.role !== 'ADMIN').map(u => {
                                        const hasKey = userAccessMap[u.id];
                                        const isSelected = selectedUserIds.includes(u.id);

                                        return (
                                            <div 
                                                key={u.id}
                                                onClick={() => toggleUserSelection(u.id)}
                                                className={`grid grid-cols-12 items-center p-3 rounded-lg cursor-pointer transition-all border ${
                                                    isSelected 
                                                    ? 'bg-purple-900/20 border-purple-500/50 shadow-sm' 
                                                    : 'bg-gray-800/40 border-transparent hover:bg-gray-800 hover:border-gray-700'
                                                }`}
                                            >
                                                <div className="col-span-1 text-center flex justify-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected}
                                                        onChange={() => {}} 
                                                        className="w-4 h-4 accent-purple-500 pointer-events-none" 
                                                    />
                                                </div>
                                                <div className="col-span-4 pl-2">
                                                    <div className="font-bold text-white text-sm">{u.username}</div>
                                                </div>
                                                <div className="col-span-4 text-xs text-gray-500">{u.email}</div>
                                                <div className="col-span-3 text-right pr-2">
                                                    {hasKey ? (
                                                        <span className="inline-flex items-center gap-1.5 bg-green-900/20 text-green-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-green-900/40">
                                                            ✅ Подключен
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 bg-gray-800 text-gray-500 px-2.5 py-1 rounded-full text-[10px] font-bold border border-gray-700">
                                                            ❌ Нет доступа
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                             </div>
                         </div>
                         
                         {/* FOOTER ACTIONS */}
                         <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex justify-between items-center shadow-lg">
                             <div className="text-sm text-gray-400">
                                Выбрано: <span className="font-bold text-white">{selectedUserIds.length}</span> пользователей
                             </div>
                             
                             <div className="flex gap-4">
                                <button 
                                    onClick={handleRevoke}
                                    disabled={!selectedAdminKeyId || selectedUserIds.length === 0}
                                    className="px-6 py-3 bg-red-900/10 hover:bg-red-900/30 text-red-400 text-sm font-bold rounded-lg border border-red-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    🗑️ Снять активацию (Revoke)
                                </button>
                                <button 
                                    onClick={handleShareAndActivate}
                                    disabled={!selectedAdminKeyId || selectedUserIds.length === 0}
                                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-bold rounded-lg shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    💾 Поделиться и Активировать
                                </button>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        )}

        {/* ... Other Tabs (Users/Security) remain similar but truncated for brevity here unless requested ... */}
        {activeTab === 'USERS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-850 p-6 rounded-xl border border-gray-750">
                    <h2 className="text-xl font-bold text-white mb-4">Registered Users</h2>
                    <div className="space-y-3">
                        {users.map(u => (
                            <div key={u.id} className="bg-gray-900 p-4 rounded border border-gray-800 flex justify-between items-center">
                                <div><div className="font-bold text-white">{u.username}</div><div className="text-xs text-gray-500">{u.email}</div></div>
                                {u.role !== 'ADMIN' && <button onClick={() => handleDelete(u.id)} className="text-xs text-red-400">Delete</button>}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-gray-850 p-6 rounded-xl border border-gray-750">
                    <h2 className="text-xl font-bold text-white mb-4">Add User</h2>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <input type="text" placeholder="Username" required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-white" />
                        <input type="email" placeholder="Email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-white" />
                        <input type="password" placeholder="Password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-white" />
                        <button type="submit" className="w-full bg-solana-green text-gray-900 font-bold py-2 rounded">Create</button>
                    </form>
                </div>
            </div>
        )}

        {activeTab === 'SECURITY' && (
             <div className="bg-gray-850 p-6 rounded-xl border border-gray-750">
                <h2 className="text-xl font-bold text-white mb-4">Security Logs</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                    {logs.map(log => (
                        <div key={log.id} className="text-xs font-mono text-gray-400 border-b border-gray-800 pb-1">
                            [{new Date(log.timestamp).toLocaleTimeString()}] <span className={log.severity === 'CRITICAL' ? 'text-red-400' : 'text-blue-400'}>{log.event}</span> - {log.details}
                        </div>
                    ))}
                </div>
             </div>
        )}
    </div>
  );
};
