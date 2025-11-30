
import React, { useState } from 'react';
import { login } from '../services/auth';
import { User } from '../types';

interface Props {
  onLoginSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay for UX
    await new Promise(r => setTimeout(r, 800));

    const result = login(username, password);
    if (result.success && result.user) {
        onLoginSuccess(result.user);
    } else {
        setError(result.error || 'Ошибка входа');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-solana-purple/20 rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-solana-green/10 rounded-full blur-[100px]"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        
        {/* LANDING STUB STATE */}
        {!showForm ? (
            <div className="text-center animate-fade-in space-y-8 bg-gray-900/50 backdrop-blur-xl border border-gray-800 p-10 rounded-3xl shadow-2xl">
                <div className="bg-gradient-to-br from-solana-green to-solana-purple w-24 h-24 rounded-2xl flex items-center justify-center shadow-lg shadow-solana-green/20 mx-auto">
                    <span className="text-white font-bold text-5xl">S</span>
                </div>
                <div>
                    <h1 className="text-4xl font-bold text-white tracking-tight">SolanaSniper<span className="text-solana-purple">AI</span></h1>
                    <p className="text-gray-400 mt-3 text-lg">Professional Swing Trading Terminal</p>
                </div>
                
                <div className="flex flex-col gap-4 pt-4">
                    <button 
                        onClick={() => setShowForm(true)}
                        className="w-full py-4 rounded-xl font-bold text-lg bg-white text-gray-900 hover:bg-gray-200 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                    >
                        Войти в Терминал
                    </button>
                    <p className="text-xs text-gray-600">
                        Authorized Personnel Only. <br/> System v2.0 (Multi-User Enabled)
                    </p>
                </div>
            </div>
        ) : (
            /* LOGIN FORM STATE */
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl animate-fade-in">
                <div className="flex items-center gap-3 mb-8 cursor-pointer group" onClick={() => setShowForm(false)}>
                    <div className="bg-gray-800 p-2 rounded-lg group-hover:bg-gray-700 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <span className="text-gray-400 text-sm group-hover:text-white transition-colors">Назад</span>
                </div>

                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Авторизация</h2>
                    <p className="text-gray-500 text-sm">Введите учетные данные</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Логин / Email</label>
                        <input 
                            type="text" 
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-700 text-white p-3 rounded-lg focus:border-solana-green outline-none transition-colors"
                            placeholder="username"
                            autoFocus
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Пароль</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-700 text-white p-3 rounded-lg focus:border-solana-green outline-none transition-colors"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-900/30 border border-red-800 text-red-400 p-3 rounded text-sm text-center animate-pulse">
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className={`w-full py-3.5 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all ${
                            isLoading 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-solana-green to-emerald-600 hover:scale-105 text-gray-900'
                        }`}
                    >
                        {isLoading ? 'Проверка...' : 'Войти'}
                    </button>
                </form>
            </div>
        )}
      </div>
    </div>
  );
};
