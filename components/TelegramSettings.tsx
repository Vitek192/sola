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
    <div className="bg-gray-850 p-8 rounded-xl border border-gray-750 max-w-2xl mx-auto mt-10">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <span className="bg-blue-500 p-2 rounded-lg">✈️</span>
        Telegram Notification Setup
      </h2>
      
      <p className="text-gray-400 mb-6 text-sm">
        Configure your bot to receive real-time alerts. 
        <br/>
        <span className="text-green-400">Fixed:</span> Now using a secure Proxy to bypass browser CORS errors.
      </p>

      <div className="space-y-6">
        <div>
            <label className="block text-sm text-gray-400 mb-2">Bot API Token</label>
            <input
                type="text"
                value={localConfig.botToken}
                onChange={(e) => handleChange('botToken', e.target.value)}
                placeholder="123456789:AAH..."
                className="w-full bg-gray-950 border border-gray-700 text-white px-4 py-3 rounded-lg focus:border-blue-500 outline-none font-mono"
            />
        </div>

        <div>
            <label className="block text-sm text-gray-400 mb-2">Your Chat ID</label>
            <input
                type="text"
                value={localConfig.chatId}
                onChange={(e) => handleChange('chatId', e.target.value)}
                placeholder="987654321"
                className="w-full bg-gray-950 border border-gray-700 text-white px-4 py-3 rounded-lg focus:border-blue-500 outline-none font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Get this from @userinfobot if you don't know it.</p>
        </div>

        <div className="flex items-center gap-4 bg-gray-900 p-4 rounded-lg border border-gray-800">
             <input
                type="checkbox"
                id="tg-enable"
                checked={localConfig.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                className="w-5 h-5 accent-blue-500 rounded cursor-pointer"
             />
             <label htmlFor="tg-enable" className="text-white cursor-pointer select-none">Enable Notifications</label>
        </div>

        <div className="flex gap-4 pt-4">
            <button 
                onClick={() => onSave(localConfig)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 rounded-lg transition-all"
            >
                Save Configuration
            </button>
            <button 
                onClick={handleTestMessage}
                disabled={testStatus === 'SENDING' || !localConfig.botToken || !localConfig.chatId}
                className="px-6 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {testStatus === 'SENDING' ? 'Sending...' : 'Test'}
            </button>
        </div>
        
        {testStatus === 'SUCCESS' && (
            <div className="bg-green-900/30 border border-green-800 p-3 rounded-lg text-green-400 text-sm text-center">
                ✅ Test message sent successfully! Check your Telegram.
            </div>
        )}
        {testStatus === 'ERROR' && (
            <div className="bg-red-900/30 border border-red-800 p-3 rounded-lg text-red-400 text-sm text-center">
                ❌ Failed: {errorMsg}
            </div>
        )}
      </div>
    </div>
  );
};