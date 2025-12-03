
import React, { useState, useEffect } from 'react';
import { ServerConfig } from '../types';
import { testServerConnection } from '../services/persistence';

interface Props {
  config: ServerConfig;
  onSave: (config: ServerConfig) => void;
  onForceLoad: () => void;
  onForceSave: () => void;
}

export const ServerSettings: React.FC<Props> = ({ config, onSave, onForceLoad, onForceSave }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [testStatus, setTestStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [testMessage, setTestMessage] = useState('');
  const [connMode, setConnMode] = useState<'DIRECT' | 'PROXY'>('DIRECT');

  // Sync state when props change
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (key: keyof ServerConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    // Reset test status on change
    if (testStatus !== 'IDLE') {
        setTestStatus('IDLE');
        setTestMessage('');
    }
  };

  const handleTest = async () => {
      setTestStatus('TESTING');
      setTestMessage('');
      
      const result = await testServerConnection(localConfig);
      
      if (result.success) {
          setTestStatus('SUCCESS');
          setTestMessage(result.message);
          if (result.mode) setConnMode(result.mode);
      } else {
          setTestStatus('ERROR');
          setTestMessage(result.message);
      }
  };

  return (
    <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 h-full flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
            <span className="bg-solana-purple/10 text-solana-purple p-2.5 rounded-lg text-xl border border-solana-purple/20">☁️</span>
            <div>
                <h2 className="text-xl font-bold text-white">Cloud Sync</h2>
                <p className="text-xs text-gray-400 mt-0.5">Ubuntu Server / PostgreSQL (Admin Only)</p>
            </div>
        </div>

        <div className="space-y-5">
            <div className="flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                <input
                    type="checkbox"
                    id="srv-enable"
                    checked={localConfig.enabled}
                    onChange={(e) => handleChange('enabled', e.target.checked)}
                    className="w-4 h-4 accent-solana-purple rounded cursor-pointer"
                />
                <label htmlFor="srv-enable" className="text-white cursor-pointer select-none font-bold text-sm">Enable Cloud Sync</label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-wide">Server URL (IP)</label>
                    <input
                        type="text"
                        value={localConfig.url}
                        onChange={(e) => handleChange('url', e.target.value)}
                        placeholder="http://155.212.217.21:3002"
                        className="w-full bg-gray-900/50 border border-gray-700 text-white px-3 py-2.5 rounded-lg focus:border-solana-purple outline-none font-mono text-xs transition-colors"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-wide">Secret Key</label>
                    <input
                        type="password"
                        value={localConfig.apiKey}
                        onChange={(e) => handleChange('apiKey', e.target.value)}
                        placeholder="solana-sniper-secret-..."
                        className="w-full bg-gray-900/50 border border-gray-700 text-white px-3 py-2.5 rounded-lg focus:border-solana-purple outline-none font-mono text-xs transition-colors"
                    />
                </div>
            </div>
            
            {/* TEST CONNECTION BUTTON WITH IMPROVED UI */}
            <div className="flex flex-col gap-3">
                 <button 
                    onClick={handleTest}
                    disabled={testStatus === 'TESTING' || !localConfig.url}
                    className={`
                        w-full px-4 py-3 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2
                        ${testStatus === 'TESTING' ? 'bg-gray-800 text-gray-400 border-gray-700' : 
                          testStatus === 'SUCCESS' ? 'bg-green-900/20 text-green-400 border-green-500/50' :
                          testStatus === 'ERROR' ? 'bg-red-900/20 text-red-400 border-red-500/50' :
                          'bg-gray-800 hover:bg-gray-700 text-white border-gray-600'}
                    `}
                 >
                     {testStatus === 'TESTING' ? (
                        <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Connecting to Server...
                        </>
                     ) : testStatus === 'SUCCESS' ? (
                        `✅ ${testMessage}`
                     ) : testStatus === 'ERROR' ? (
                        `❌ ${testMessage}`
                     ) : (
                        '⚡ Test Connection to 155.212.217.21'
                     )}
                 </button>
                 
                 {testStatus === 'SUCCESS' && connMode === 'PROXY' && (
                     <div className="bg-blue-900/20 border border-blue-800 p-2 rounded text-[10px] text-blue-400 flex items-center gap-2 animate-fade-in">
                         <span>🛡️</span>
                         <span>Connection routed via <b>Secure Proxy</b> (HTTPS Support enabled).</span>
                     </div>
                 )}

                 {testStatus === 'ERROR' && testMessage.includes('500') && (
                     <div className="bg-yellow-900/20 border border-yellow-800 p-2 rounded text-[10px] text-yellow-400 flex items-start gap-2 animate-fade-in">
                         <span className="text-lg">💡</span>
                         <div>
                             <b>Tip: Error 500 = Database Error</b>
                             <ul className="list-disc list-inside mt-1 ml-1 text-yellow-500/80">
                                <li>Check .env DB_PASS matches Postgres user</li>
                                <li>Ensure table "app_state" exists (Run migration)</li>
                             </ul>
                         </div>
                     </div>
                 )}
            </div>

            <div className="flex items-center gap-2 px-1 pt-2">
                <input
                    type="checkbox"
                    id="srv-autosave"
                    checked={localConfig.autoSave}
                    onChange={(e) => handleChange('autoSave', e.target.checked)}
                    className="w-3.5 h-3.5 accent-solana-purple rounded cursor-pointer"
                />
                <label htmlFor="srv-autosave" className="text-gray-400 text-xs cursor-pointer select-none font-medium">Auto-save data every 2 minutes</label>
            </div>
        </div>
      </div>

      <div className="space-y-3 mt-8 pt-4 border-t border-gray-800">
        <button 
            onClick={() => onSave(localConfig)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2.5 rounded-lg transition-all text-sm shadow-md border border-gray-600"
        >
            Save Connection Settings
        </button>

        {localConfig.enabled && (
             <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={onForceSave}
                    className="bg-green-900/20 border border-green-800 text-green-400 hover:bg-green-900/40 py-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-xs"
                >
                    <span>⬆️</span> Upload to Server
                </button>
                <button 
                    onClick={onForceLoad}
                    className="bg-blue-900/20 border border-blue-800 text-blue-400 hover:bg-blue-900/40 py-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-xs"
                >
                    <span>⬇️</span> Download from Server
                </button>
             </div>
        )}
      </div>
    </div>
  );
};
