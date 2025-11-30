
import React, { useState } from 'react';
import { TelegramConfig } from '../types';

interface Props {
  config: TelegramConfig;
  onSave: (config: TelegramConfig) => void;
}

export const TelegramSettings: React.FC<Props> = ({ config, onSave }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [testStatus, setTestStatus] = useState<'IDLE' | 'SENDING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (key: keyof TelegramConfig, value: string | boolean) => {
    setLocalConfig({ ...localConfig, [key]: value });
  };

  const handleTestMessage = async () => {
    setTestStatus('SENDING');
    setErrorMsg('');
    
    // Validate format roughly
    if (!localConfig.botToken.includes(':')) {
        setTestStatus('ERROR');
        setErrorMsg('Invalid Token Format. It should look like "123456:ABC-..."');
        return;
    }

    try {
        // We use a CORS proxy to bypass browser restrictions
        const telegramUrl = `https://api.telegram.org/bot${localConfig.botToken}/sendMessage`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(telegramUrl)}`;

        const res = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: localConfig.chatId,
                text: "✅ SolanaSniper: TEST SUCCESSFUL! \nSystem is connected and ready to send signals.",
                parse_mode: 'Markdown'
            })
        });
        
        const data = await res.json();
        
        if (data.ok) {
            setTestStatus('SUCCESS');
        } else {
            console.error("Telegram Error Response:", data);
            setTestStatus('ERROR');
            setErrorMsg(data.description || 'Unknown Telegram API Error');
        }
    } catch (e: any) {
        console.error("Network/CORS Error:", e);
        setTestStatus('ERROR');
        setErrorMsg('Network Error. Check internet or Token/ID.');
    }
  };

  return (
    <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 h-full flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
            <span className="bg-blue-500/10 text-blue-400 p-2.5 rounded-lg text-xl border border-blue-500/20">✈️</span>
            <div>
                <h2 className="text-xl font-bold text-white">Telegram Alerts</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                    Real-time notifications via <span className="text-blue-400 font-bold">@BotFather</span>
                </p>
            </div>
        </div>

        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-wide">Bot API Token</label>
                    <input
                        type="text"
                        value={localConfig.botToken}
                        onChange={(e) => handleChange('botToken', e.target.value)}
                        placeholder="123456789:AAH..."
                        className="w-full bg-gray-900/50 border border-gray-700 text-white px-3 py-2.5 rounded-lg focus:border-blue-500 outline-none font-mono text-sm transition-colors"
                    />
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-bold uppercase tracking-wide">Your Chat ID</label>
                    <input
                        type="text"
                        value={localConfig.chatId}
                        onChange={(e) => handleChange('chatId', e.target.value)}
                        placeholder="987654321"
                        className="w-full bg-gray-900/50 border border-gray-700 text-white px-3 py-2.5 rounded-lg focus:border-blue-500 outline-none font-mono text-sm transition-colors"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                <input
                    type="checkbox"
                    id="tg-enable"
                    checked={localConfig.enabled}
                    onChange={(e) => handleChange('enabled', e.target.checked)}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                />
                <label htmlFor="tg-enable" className="text-gray-300 text-sm cursor-pointer select-none font-medium">Enable Active Notifications</label>
            </div>
        </div>
      </div>

      <div className="space-y-3 mt-8 pt-4 border-t border-gray-800">
        <div className="flex gap-3">
            <button 
                onClick={() => onSave(localConfig)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg transition-all text-sm shadow-lg shadow-blue-900/20"
            >
                Save Configuration
            </button>
            <button 
                onClick={handleTestMessage}
                disabled={testStatus === 'SENDING' || !localConfig.botToken || !localConfig.chatId}
                className="px-6 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm border border-gray-600"
            >
                {testStatus === 'SENDING' ? 'Sending...' : 'Test'}
            </button>
        </div>
        
        {testStatus === 'SUCCESS' && (
            <div className="bg-green-500/10 border border-green-500/20 p-2 rounded text-green-400 text-xs text-center font-medium">
                ✅ Success! Check your Telegram.
            </div>
        )}
        {testStatus === 'ERROR' && (
            <div className="bg-red-500/10 border border-red-500/20 p-2 rounded text-red-400 text-xs text-center font-medium">
                ❌ Error: {errorMsg}
            </div>
        )}
      </div>
    </div>
  );
};
