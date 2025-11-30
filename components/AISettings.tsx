
import React, { useState, useRef, useEffect } from 'react';
import { AIConfig, AIProvider, AIKey } from '../types';
import { testKeyConnectivity, fetchModels, ModelInfo } from '../services/gemini';

interface Props {
  config: AIConfig;
  onSave: (config: AIConfig) => void;
}

const PROVIDERS: { key: AIProvider; label: string; defaultModel: string; placeholder: string }[] = [
    { key: 'GEMINI', label: 'Google Gemini (Fast/Free)', defaultModel: 'gemini-2.5-flash', placeholder: 'AIza...' },
    { key: 'OPENROUTER', label: 'OpenRouter (Multi-Model)', defaultModel: 'meta-llama/llama-3-8b-instruct:free', placeholder: 'sk-or-...' },
    { key: 'OPENAI', label: 'OpenAI (GPT-4)', defaultModel: 'gpt-4-turbo', placeholder: 'sk-...' },
    { key: 'DEEPSEEK', label: 'DeepSeek', defaultModel: 'deepseek-chat', placeholder: 'sk-...' }
];

export const AISettings: React.FC<Props> = ({ config, onSave }) => {
  const [newKeyProvider, setNewKeyProvider] = useState<AIProvider>('GEMINI');
  const [newKeyVal, setNewKeyVal] = useState('');
  const [newKeyModel, setNewKeyModel] = useState('gemini-2.5-flash');
  const [newKeyName, setNewKeyName] = useState('My Key');
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  
  // Custom Dropdown State
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelFilterType, setModelFilterType] = useState<'ALL' | 'FREE' | 'PAID'>('ALL'); // NEW FILTER STATE
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Track test status per key ID
  const [testStatus, setTestStatus] = useState<Record<string, { status: 'IDLE'|'LOADING'|'SUCCESS'|'ERROR', msg?: string }>>({});

  // Close dropdown on click outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setShowModelDropdown(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleGlobal = (e: React.ChangeEvent<HTMLInputElement>) => {
      onSave({ ...config, enabled: e.target.checked });
  };

  const handleAddKey = () => {
      if (!newKeyVal) return;
      
      const newKey: AIKey = {
          id: Date.now().toString(),
          provider: newKeyProvider,
          apiKey: newKeyVal,
          modelId: newKeyModel,
          name: newKeyName,
          enabled: true
      };

      onSave({
          ...config,
          keys: [...config.keys, newKey]
      });

      setNewKeyVal('');
      setNewKeyName('New Key');
  };

  const handleDeleteKey = (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const updatedKeys = config.keys.filter(k => k.id !== id);
      onSave({
          ...config,
          keys: updatedKeys
      });
  };

  const handleToggleKey = (id: string) => {
      onSave({
          ...config,
          keys: config.keys.map(k => k.id === id ? { ...k, enabled: !k.enabled } : k)
      });
  };

  const handleTestKey = async (key: AIKey) => {
      setTestStatus(prev => ({ ...prev, [key.id]: { status: 'LOADING' } }));
      const result = await testKeyConnectivity(key);
      setTestStatus(prev => ({ 
          ...prev, 
          [key.id]: { 
              status: result.success ? 'SUCCESS' : 'ERROR', 
              msg: result.message 
          } 
      }));
  };

  const loadModels = async () => {
      if (!newKeyVal && newKeyProvider === 'OPENROUTER') {
          alert("Введите API Key перед загрузкой списка.");
          return;
      }
      setLoadingModels(true);
      const models = await fetchModels(newKeyProvider, newKeyVal);
      if (models.length > 0) {
          setAvailableModels(models);
          // Do not aggressive autofill
          setShowModelDropdown(true); // Open list immediately on load
      } else {
          alert(`Failed to fetch models from ${newKeyProvider}. Check Key or Connection.`);
      }
      setLoadingModels(false);
  };

  const activeProviderDef = PROVIDERS.find(p => p.key === newKeyProvider) || PROVIDERS[0];

  // Filter models logic
  const filteredModels = availableModels.filter(m => {
      const matchText = m.id.toLowerCase().includes(newKeyModel.toLowerCase()) || 
                        m.name.toLowerCase().includes(newKeyModel.toLowerCase());
      
      if (!matchText) return false;

      if (modelFilterType === 'FREE') return m.isFree;
      if (modelFilterType === 'PAID') return !m.isFree;
      return true;
  });

  return (
    <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 h-full flex flex-col shadow-lg">
        
        {/* HEADER */}
        <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
            <span className="bg-purple-500/10 text-purple-400 p-2.5 rounded-lg text-xl border border-purple-500/20">🧠</span>
            <div>
                <h2 className="text-xl font-bold text-white">AI Keyring (Связка Ключей)</h2>
                <p className="text-xs text-gray-400 mt-0.5">Failover: Авто-переключение при ошибках.</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
                <input
                    type="checkbox"
                    id="ai-global-enable"
                    checked={config.enabled}
                    onChange={handleToggleGlobal}
                    className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                />
                <label htmlFor="ai-global-enable" className="text-white cursor-pointer select-none font-bold text-sm">Вкл. AI</label>
            </div>
        </div>

        {/* KEY LIST */}
        <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 bg-gray-900/30 rounded-lg p-2 border border-gray-800 min-h-[150px]">
            {config.keys.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                    Нет активных ключей. Добавьте ниже.
                </div>
            )}
            {config.keys.map((key, index) => {
                const status = testStatus[key.id];
                return (
                    <div key={key.id} className={`p-3 mb-2 rounded border flex flex-col gap-2 transition-all ${key.enabled ? 'bg-gray-800 border-gray-700' : 'bg-gray-900/50 border-gray-800 opacity-60'}`}>
                        <div className="flex items-center gap-3">
                            <div className="bg-gray-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                                {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-bold text-sm truncate">{key.name}</span>
                                    <span className="text-[10px] bg-purple-900/30 text-purple-300 px-1.5 rounded border border-purple-900/50">{key.provider}</span>
                                </div>
                                <div className="text-xs text-gray-500 font-mono truncate" title={key.modelId}>
                                    {key.modelId}
                                </div>
                            </div>
                            
                            {/* TEST BUTTON */}
                            <button 
                                onClick={() => handleTestKey(key)}
                                disabled={status?.status === 'LOADING'}
                                className="text-[10px] bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                title="Check connection"
                            >
                                {status?.status === 'LOADING' ? (
                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : status?.status === 'SUCCESS' ? (
                                    <span className="text-green-400">✅ OK</span>
                                ) : status?.status === 'ERROR' ? (
                                    <span className="text-red-400">❌ Err</span>
                                ) : (
                                    '⚡ Тест'
                                )}
                            </button>

                            <button onClick={() => handleToggleKey(key.id)} className={`text-xs px-2 py-1 rounded border min-w-[35px] ${key.enabled ? 'bg-green-900/20 text-green-400 border-green-900' : 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                                {key.enabled ? 'ON' : 'OFF'}
                            </button>
                            <button onClick={(e) => handleDeleteKey(key.id, e)} className="text-gray-500 hover:text-red-400 p-1">
                                🗑️
                            </button>
                        </div>
                        {/* Error Message Display */}
                        {status?.status === 'ERROR' && (
                            <div className="text-[10px] text-red-400 bg-red-900/10 p-1.5 rounded border border-red-900/20 break-all">
                                {status.msg}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* ADD NEW KEY FORM */}
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                ➕ Добавить Ключ
            </h3>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
                <input 
                    type="text" 
                    placeholder="Название (Backup Key)" 
                    value={newKeyName} 
                    onChange={e => setNewKeyName(e.target.value)}
                    className="bg-gray-950 border border-gray-700 text-white text-xs p-2 rounded"
                />
                <select
                    value={newKeyProvider}
                    onChange={(e) => {
                        const prov = e.target.value as AIProvider;
                        setNewKeyProvider(prov);
                        setNewKeyModel(PROVIDERS.find(p => p.key === prov)?.defaultModel || '');
                        setAvailableModels([]); // Reset models when provider changes
                        setShowModelDropdown(false);
                    }}
                    className="bg-gray-950 border border-gray-700 text-white text-xs p-2 rounded"
                >
                    {PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
            </div>

            <input 
                type="password" 
                placeholder={`API Key (${activeProviderDef.placeholder})`}
                value={newKeyVal}
                onChange={e => setNewKeyVal(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 text-white text-xs p-2 rounded font-mono mb-3"
            />

            <div className="flex gap-2 mb-3 items-start relative">
                <div className="flex-1 relative" ref={dropdownRef}>
                    <div className="flex relative">
                        <input 
                            type="text" 
                            placeholder="Model ID (e.g. gpt-4)"
                            value={newKeyModel}
                            onChange={e => { setNewKeyModel(e.target.value); setShowModelDropdown(true); }}
                            onFocus={() => setShowModelDropdown(true)}
                            className="w-full bg-gray-950 border border-r-0 border-gray-700 text-white text-xs p-2 pr-8 rounded-l font-mono z-10 relative focus:z-20"
                        />
                        {/* CLEAR BUTTON (X) */}
                        {newKeyModel && (
                            <button 
                                onClick={() => { setNewKeyModel(''); setShowModelDropdown(true); }}
                                className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white z-30 p-1"
                                title="Очистить"
                            >
                                ✕
                            </button>
                        )}
                        <button 
                            onClick={() => setShowModelDropdown(!showModelDropdown)}
                            className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-400 px-2 rounded-r text-xs z-20"
                        >
                            ▼
                        </button>
                    </div>

                    {/* CUSTOM DROPDOWN */}
                    {showModelDropdown && (
                        <div className="absolute top-full left-0 w-full bg-gray-950 border border-gray-700 rounded-b shadow-2xl z-50 max-h-72 overflow-hidden mt-1 ring-1 ring-black ring-opacity-5 flex flex-col">
                            
                            {/* FILTER HEADER */}
                            <div className="flex bg-gray-900 border-b border-gray-800 p-1 gap-1 sticky top-0 z-10">
                                <button 
                                    onClick={() => setModelFilterType('ALL')} 
                                    className={`flex-1 py-1 text-[10px] font-bold uppercase rounded ${modelFilterType === 'ALL' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800'}`}
                                >
                                    All
                                </button>
                                <button 
                                    onClick={() => setModelFilterType('FREE')} 
                                    className={`flex-1 py-1 text-[10px] font-bold uppercase rounded ${modelFilterType === 'FREE' ? 'bg-green-900/30 text-green-400' : 'text-gray-500 hover:bg-gray-800'}`}
                                >
                                    Free
                                </button>
                                <button 
                                    onClick={() => setModelFilterType('PAID')} 
                                    className={`flex-1 py-1 text-[10px] font-bold uppercase rounded ${modelFilterType === 'PAID' ? 'bg-yellow-900/30 text-yellow-400' : 'text-gray-500 hover:bg-gray-800'}`}
                                >
                                    Paid
                                </button>
                            </div>

                            <div className="overflow-y-auto custom-scrollbar flex-1">
                                {filteredModels.length === 0 && availableModels.length === 0 && (
                                    <div className="p-3 text-xs text-gray-500 italic text-center">Load models first ➔</div>
                                )}
                                {filteredModels.length === 0 && availableModels.length > 0 && (
                                    <div className="p-3 text-xs text-gray-500 italic text-center">
                                        No {modelFilterType !== 'ALL' ? modelFilterType.toLowerCase() : ''} models match "{newKeyModel}".
                                    </div>
                                )}
                                {filteredModels.map(m => (
                                    <div 
                                        key={m.id}
                                        onClick={() => { setNewKeyModel(m.id); setShowModelDropdown(false); }}
                                        className="p-2 hover:bg-gray-800 cursor-pointer border-b border-gray-800 last:border-0 flex justify-between items-center group"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs text-white font-bold truncate">
                                                {m.isFree ? <span className="text-green-400 mr-1">✨</span> : <span className="text-yellow-500 mr-1">$</span>}
                                                {m.name}
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-mono truncate">{m.id}</div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {m.isFree ? (
                                                <span className="text-[9px] bg-green-900/30 text-green-400 px-1 rounded border border-green-900/50">FREE</span>
                                            ) : (
                                                <span className="text-[9px] bg-yellow-900/20 text-yellow-500 px-1 rounded border border-yellow-900/40">PAID</span>
                                            )}
                                            {m.contextLength && (
                                                <div className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700">
                                                    {m.contextLength}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {newKeyProvider === 'OPENROUTER' && (
                    <button 
                        onClick={loadModels}
                        disabled={loadingModels}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 rounded text-xs border border-gray-700 transition-colors h-[34px] whitespace-nowrap flex items-center gap-1"
                        title="Load model list from OpenRouter"
                    >
                        {loadingModels ? (
                            <>
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>Загрузка...</span>
                            </>
                        ) : (
                            '📋 Список'
                        )}
                    </button>
                )}
            </div>

            <button 
                onClick={handleAddKey}
                disabled={!newKeyVal}
                className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded text-xs transition-colors shadow-md"
            >
                + Добавить в Связку
            </button>
        </div>
    </div>
  );
};
