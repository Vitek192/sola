
import React, { useState, useEffect } from 'react';
import { SolscanConfig } from '../types';
import { testSolscanConnection } from '../services/solanaApi';

interface Props {
  config: SolscanConfig;
  onSave: (config: SolscanConfig) => void;
}

export const SolscanSettings: React.FC<Props> = ({ config, onSave }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [testStatus, setTestStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');

  // CRITICAL: Sync local state when parent config updates (e.g. after loading from storage)
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (key: keyof SolscanConfig, value: string | boolean) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setTestStatus('IDLE');
  };

  const handleSave = () => {
    onSave(localConfig);
  };

  const handleTest = async () => {
    if (!localConfig.apiKey) {
        alert("Please enter a key first");
        return;
    }
    setTestStatus('TESTING');
    const success = await testSolscanConnection(localConfig.apiKey);
    setTestStatus(success ? 'SUCCESS' : 'ERROR');
  };

  return (
    <div className="bg-gray-850 p-6 rounded-xl border border-cyan-900/50 shadow-[0_0_15px_rgba(8,145,178,0.1)] h-full flex flex-col justify-between relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

      <div>
        <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4 relative z-10">
            <span className="bg-cyan-500/10 text-cyan-400 p-2.5 rounded-lg text-xl border border-cyan-500/20 shadow-sm">🔍</span>
            <div>
                <h2 className="text-xl font-bold text-white">Solscan Pro API</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                    Connect for <span className="text-cyan-400 font-bold">Real-time Holders</span> & Chain Info
                </p>
            </div>
        </div>

        <div className="space-y-5 relative z-10">
            <div className="flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800 hover:border-cyan-900/30 transition-colors">
                <input
                    type="checkbox"
                    id="solscan-enable"
                    checked={localConfig.enabled}
                    onChange={(e) => handleChange('enabled', e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
                <label htmlFor="solscan-enable" className="text-gray-300 text-sm cursor-pointer select-none font-medium">Enable Solscan Integration</label>
            </div>

            <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-wide">API Token (Key)</label>
                <div className="relative">
                    <input
                        type="password"
                        value={localConfig.apiKey}
                        onChange={(e) => handleChange('apiKey', e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1Ni..."
                        className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2.5 rounded-lg focus:border-cyan-500 outline-none font-mono text-xs transition-colors shadow-inner"
                    />
                    {localConfig.apiKey && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-500 text-[10px] font-bold">
                            KEY SET
                        </div>
                    )}
                </div>
                <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                    Paste your Pro Key from <a href="https://solscan.io/profile/api" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">solscan.io</a>.
                    <br/>Required for fetching Holder counts without rate limits.
                </p>
            </div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-gray-800 flex gap-3 relative z-10">
        <button 
            onClick={handleSave}
            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded-lg transition-all text-sm shadow-lg shadow-cyan-900/20"
        >
            Save Configuration
        </button>
        <button 
            onClick={handleTest}
            disabled={testStatus === 'TESTING' || !localConfig.apiKey}
            className={`px-4 py-2.5 rounded-lg font-bold text-sm border transition-all min-w-[100px] flex items-center justify-center
                ${testStatus === 'TESTING' ? 'bg-gray-800 text-gray-400 border-gray-700' : 
                  testStatus === 'SUCCESS' ? 'bg-green-900/20 text-green-400 border-green-900' :
                  testStatus === 'ERROR' ? 'bg-red-900/20 text-red-400 border-red-900' :
                  'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-600'}
            `}
        >
            {testStatus === 'TESTING' ? 'Testing...' : 
             testStatus === 'SUCCESS' ? '✅ OK' : 
             testStatus === 'ERROR' ? '❌ Fail' : 
             '⚡ Test'}
        </button>
      </div>
    </div>
  );
};
