import React, { useState, useEffect } from 'react';
import { RpcConfig } from '../types';
import { testRpcConnection } from '../services/solanaApi';

interface Props {
  config: RpcConfig;
  onSave: (config: RpcConfig) => void;
}

export const RpcSettings: React.FC<Props> = ({ config, onSave }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [testStatus, setTestStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (key: keyof RpcConfig, value: string | boolean) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setTestStatus('IDLE');
  };

  const handleSave = () => {
    onSave(localConfig);
  };

  const handleTest = async () => {
    if (!localConfig.rpcUrl) return;
    setTestStatus('TESTING');
    const success = await testRpcConnection(localConfig.rpcUrl);
    setTestStatus(success ? 'SUCCESS' : 'ERROR');
  };

  return (
    <div className="bg-gray-850 p-6 rounded-xl border border-orange-900/50 shadow-[0_0_15px_rgba(234,88,12,0.1)] h-full flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

      <div>
        <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4 relative z-10">
            <span className="bg-orange-500/10 text-orange-400 p-2.5 rounded-lg text-xl border border-orange-500/20 shadow-sm">⚡</span>
            <div>
                <h2 className="text-xl font-bold text-white">Custom RPC</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                    Direct Blockchain Access (Helius, QuickNode, Alchemy)
                </p>
            </div>
        </div>

        <div className="space-y-5 relative z-10">
            <div className="flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800 hover:border-orange-900/30 transition-colors">
                <input
                    type="checkbox"
                    id="rpc-enable"
                    checked={localConfig.enabled}
                    onChange={(e) => handleChange('enabled', e.target.checked)}
                    className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                />
                <label htmlFor="rpc-enable" className="text-gray-300 text-sm cursor-pointer select-none font-medium">Enable Custom RPC</label>
            </div>

            <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-wide">RPC Endpoint URL</label>
                <input
                    type="text"
                    value={localConfig.rpcUrl}
                    onChange={(e) => handleChange('rpcUrl', e.target.value)}
                    placeholder="https://mainnet.helius-rpc.com/?api-key=..."
                    className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2.5 rounded-lg focus:border-orange-500 outline-none font-mono text-xs transition-colors shadow-inner"
                />
                <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                    Paste your Helius or QuickNode free tier URL.
                    <br/>Required for robust holder counting via <span className="font-mono text-orange-400">getProgramAccounts</span>.
                </p>
            </div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-gray-800 flex gap-3 relative z-10">
        <button 
            onClick={handleSave}
            className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 rounded-lg transition-all text-sm shadow-lg shadow-orange-900/20"
        >
            Save RPC
        </button>
        <button 
            onClick={handleTest}
            disabled={testStatus === 'TESTING' || !localConfig.rpcUrl}
            className={`px-4 py-2.5 rounded-lg font-bold text-sm border transition-all min-w-[100px] flex items-center justify-center
                ${testStatus === 'TESTING' ? 'bg-gray-800 text-gray-400 border-gray-700' : 
                  testStatus === 'SUCCESS' ? 'bg-green-900/20 text-green-400 border-green-900' :
                  testStatus === 'ERROR' ? 'bg-red-900/20 text-red-400 border-red-900' :
                  'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-600'}
            `}
        >
            {testStatus === 'TESTING' ? '...' : testStatus === 'SUCCESS' ? '✅ OK' : testStatus === 'ERROR' ? '❌ Fail' : '⚡ Test'}
        </button>
      </div>
    </div>
  );
};