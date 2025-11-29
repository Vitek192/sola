
import React, { useState } from 'react';
import { ServerConfig } from '../types';

interface Props {
  config: ServerConfig;
  onSave: (config: ServerConfig) => void;
  onForceLoad: () => void;
  onForceSave: () => void;
}

export const ServerSettings: React.FC<Props> = ({ config, onSave, onForceLoad, onForceSave }) => {
  const [localConfig, setLocalConfig] = useState(config);

  const handleChange = (key: keyof ServerConfig, value: any) => {
    setLocalConfig({ ...localConfig, [key]: value });
  };

  return (
    <div className="bg-gray-850 p-8 rounded-xl border border-gray-750 max-w-2xl mx-auto mt-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="bg-solana-purple p-2 rounded-lg text-white">☁️</span>
        <div>
            <h2 className="text-2xl font-bold text-white">Ubuntu Server Connection</h2>
            <p className="text-sm text-gray-400">Sync data with your Postgres database</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-4 bg-gray-900 p-4 rounded-lg border border-gray-800">
             <input
                type="checkbox"
                id="srv-enable"
                checked={localConfig.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                className="w-5 h-5 accent-solana-purple rounded cursor-pointer"
             />
             <label htmlFor="srv-enable" className="text-white cursor-pointer select-none font-bold">Enable Cloud Sync</label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm text-gray-400 mb-2">Server URL (IP:Port)</label>
                <input
                    type="text"
                    value={localConfig.url}
                    onChange={(e) => handleChange('url', e.target.value)}
                    placeholder="http://192.168.1.100:3000"
                    className="w-full bg-gray-950 border border-gray-700 text-white px-4 py-3 rounded-lg focus:border-solana-purple outline-none font-mono text-sm"
                />
            </div>
            <div>
                <label className="block text-sm text-gray-400 mb-2">API Key (Secret)</label>
                <input
                    type="password"
                    value={localConfig.apiKey}
                    onChange={(e) => handleChange('apiKey', e.target.value)}
                    placeholder="my-secret-password"
                    className="w-full bg-gray-950 border border-gray-700 text-white px-4 py-3 rounded-lg focus:border-solana-purple outline-none font-mono text-sm"
                />
            </div>
        </div>
        
        <div className="flex items-center gap-2">
             <input
                type="checkbox"
                id="srv-autosave"
                checked={localConfig.autoSave}
                onChange={(e) => handleChange('autoSave', e.target.checked)}
                className="w-4 h-4 accent-solana-purple rounded cursor-pointer"
             />
             <label htmlFor="srv-autosave" className="text-gray-400 text-sm cursor-pointer select-none">Auto-save every 5 minutes</label>
        </div>

        <div className="flex gap-4 pt-4 border-t border-gray-800">
            <button 
                onClick={() => onSave(localConfig)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-all"
            >
                Save Config
            </button>
        </div>

        {localConfig.enabled && (
             <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                    onClick={onForceSave}
                    className="bg-green-900/40 border border-green-800 text-green-400 hover:bg-green-900/60 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                >
                    ⬆️ Upload to Server
                </button>
                <button 
                    onClick={onForceLoad}
                    className="bg-blue-900/40 border border-blue-800 text-blue-400 hover:bg-blue-900/60 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                >
                    ⬇️ Download from Server
                </button>
             </div>
        )}
      </div>
    </div>
  );
};
