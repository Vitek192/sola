
import React, { useState } from 'react';
import { Token } from '../types';
import { analyzeTokenWithGemini } from '../services/gemini';

interface Props {
  tokens: Token[];
  onUpdateToken: (t: Token) => void;
  onSelectToken: (t: Token) => void;
  minConfidence: number; // New prop
}

export const SignalFeed: React.FC<Props> = ({ tokens, onUpdateToken, onSelectToken, minConfidence }) => {
  const [isAutoMining, setIsAutoMining] = useState(false);

  // 1. Filter tokens using dynamic confidence threshold
  const recommendedTokens = tokens.filter(t => 
    t.aiAnalysis?.action === 'BUY' && 
    t.aiAnalysis.confidence >= minConfidence
  );

  // 2. Logic to auto-scan tokens that look promising but haven't been checked by AI yet
  const handleAutoMine = async () => {
    setIsAutoMining(true);
    
    // Find tokens: Not owned, No AI analysis yet, Liquidity > $2k, Age > 30 mins
    const candidates = tokens.filter(t => 
        !t.isOwned && 
        !t.aiAnalysis && 
        t.history[t.history.length-1].liquidity > 2000 &&
        (Date.now() - t.createdAt) > 30 * 60 * 1000
    );

    // Sort by Volume (Highest first) and take top 5 to save API credits/time
    const topCandidates = candidates
        .sort((a, b) => b.history[b.history.length-1].volume24h - a.history[a.history.length-1].volume24h)
        .slice(0, 5);

    for (const token of topCandidates) {
        const analysis = await analyzeTokenWithGemini(token);
        const updatedToken: Token = { 
            ...token, 
            aiAnalysis: analysis, 
            status: analysis.action === 'BUY' ? 'BUY_SIGNAL' : analysis.action === 'SELL' ? 'SELL_SIGNAL' : 'TRACKING' 
        };
        onUpdateToken(updatedToken);
        // Small delay to not hit rate limits if any
        await new Promise(r => setTimeout(r, 1000));
    }
    
    setIsAutoMining(false);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-850 p-8 rounded-2xl border border-gray-750 relative overflow-hidden">
        <div className="relative z-10">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                💎 Signal Box (Рекомендации)
            </h1>
            <p className="text-gray-400 max-w-2xl mb-6">
                Здесь находятся монеты, которые прошли полный анализ нашей системы. 
                Мы рекомендуем к покупке только те активы, где ИИ видит паттерн "Накопление" или "Органический рост" 
                с уверенностью <span className="text-solana-green font-bold">&gt; {minConfidence}%</span>.
            </p>
            
            <button 
                onClick={handleAutoMine}
                disabled={isAutoMining}
                className={`px-6 py-3 rounded-lg font-bold shadow-xl flex items-center gap-2 transition-all ${
                    isAutoMining 
                    ? 'bg-gray-700 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-solana-green to-emerald-600 hover:scale-105 text-gray-900'
                }`}
            >
                {isAutoMining ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Ищем Алмазы (AI Mining)...
                    </>
                ) : (
                    <>
                        🚀 Найти новые возможности (Auto-Scan)
                    </>
                )}
            </button>
        </div>
        
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-solana-green/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recommendedTokens.length === 0 ? (
             <div className="col-span-full text-center py-20 bg-gray-850/50 rounded-xl border border-dashed border-gray-700">
                <p className="text-gray-500 text-lg">Пока нет активных сигналов выше {minConfidence}% уверенности.</p>
                <p className="text-gray-600 text-sm">Нажмите кнопку выше для анализа или понизьте порог в настройках.</p>
             </div>
        ) : (
            recommendedTokens.map(token => (
                <div key={token.id} className="bg-gray-850 rounded-xl border border-solana-green/30 shadow-lg shadow-solana-green/5 overflow-hidden flex flex-col hover:border-solana-green/60 transition-colors">
                    <div className="p-6 flex-1">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    {token.symbol}
                                    <span className="bg-green-500 text-gray-900 text-xs px-2 py-0.5 rounded font-bold">BUY</span>
                                </h3>
                                <p className="text-xs text-gray-500 font-mono">{token.address.substring(0, 6)}...{token.address.substring(38)}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-solana-green">{token.aiAnalysis?.confidence}%</div>
                                <div className="text-xs text-gray-500">Уверенность</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Паттерн</p>
                                <p className="text-white font-medium">{token.aiAnalysis?.patternDetected}</p>
                            </div>

                            <div>
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Почему покупать (Критерии):</p>
                                <p className="text-sm text-gray-300 leading-relaxed bg-green-900/10 p-3 rounded border border-green-900/30">
                                    {token.aiAnalysis?.reasoning}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-gray-800 p-2 rounded">
                                    <span className="text-gray-500 block">Liquidity</span>
                                    <span className="text-white font-mono">${token.history[token.history.length-1].liquidity.toLocaleString()}</span>
                                </div>
                                <div className="bg-gray-800 p-2 rounded">
                                    <span className="text-gray-500 block">Makers</span>
                                    <span className="text-white font-mono">{token.history[token.history.length-1].makers}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 p-4 border-t border-gray-800 flex gap-3">
                         <button 
                            onClick={() => onSelectToken(token)}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg font-medium transition-colors"
                         >
                            График
                         </button>
                         <button 
                            onClick={() => {
                                // Simulate Add to Portfolio
                                const price = token.history[token.history.length-1].price;
                                onUpdateToken({...token, isOwned: true, entryPrice: price, entryTime: Date.now()});
                            }}
                            className="flex-1 bg-solana-green hover:bg-emerald-400 text-gray-900 py-2 rounded-lg font-bold transition-colors"
                         >
                            Купить
                         </button>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};
