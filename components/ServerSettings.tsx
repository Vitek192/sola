
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
    <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 h-full flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
            <span className="bg-solana-purple/10 text-solana-purple p-2.5 rounded-lg text-xl border border-solana-purple/20">☁️</span>
            <div>
                <h2 className="text-xl font-bold text-white">Cloud Sync</h2>
                <p className="text-xs text-gray-400 mt-0.5">Ubuntu Server / PostgreSQL</p>
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
                    <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-wide">Server URL</label>
                    <input
                        type="text"
                        value={localConfig.url}
                        onChange={(e) => handleChange('url', e.target.value)}
                        placeholder="http://192.168.1.100:3000"
                        className="w-full bg-gray-900/50 border border-gray-700 text-white px-3 py-2.5 rounded-lg focus:border-solana-purple outline-none font-mono text-xs transition-colors"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-wide">Secret Key</label>
                    <input
                        type="password"
                        value={localConfig.apiKey}
                        onChange={(e) => handleChange('apiKey', e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-gray-900/50 border border-gray-700 text-white px-3 py-2.5 rounded-lg focus:border-solana-purple outline-none font-mono text-xs transition-colors"
                    />
                </div>
            </div>
            
            <div className="flex items-center gap-2 px-1">
                <input
                    type="checkbox"
                    id="srv-autosave"
                    checked={localConfig.autoSave}
                    onChange={(e) => handleChange('autoSave', e.target.checked)}
                    className="w-3.5 h-3.5 accent-solana-purple rounded cursor-pointer"
                />
                <label htmlFor="srv-autosave" className="text-gray-400 text-xs cursor-pointer select-none font-medium">Auto-save data every 5 minutes</label>
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
