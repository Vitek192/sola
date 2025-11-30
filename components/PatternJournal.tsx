
import React, { useState } from 'react';
import { JournalEntry, JournalCategoryType, Token, AIConfig } from '../types';
import { generateDailyJournal } from '../services/gemini';

interface Props {
  tokens: Token[];
  entries: JournalEntry[];
  onAddEntry: (entry: JournalEntry) => void;
  aiConfig: AIConfig; // New Prop
}

export const PatternJournal: React.FC<Props> = ({ tokens, entries, onAddEntry, aiConfig }) => {
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(entries.length > 0 ? entries[0].id : null);

  const handleGenerateReport = async () => {
    // 1. Check AI Keys first
    const hasActiveKeys = aiConfig.enabled && aiConfig.keys.some(k => k.enabled);
    if (!hasActiveKeys) {
        alert("⚠️ AI Мозг не подключен!\nПожалуйста, перейдите в Settings -> AI Keyring и добавьте хотя бы один активный API ключ (Gemini или OpenRouter).");
        return;
    }

    // 2. Check Tokens
    if (tokens.length === 0) {
        alert("Нет данных для анализа. Подождите, пока сканер соберет информацию о монетах.");
        return;
    }

    setGenerating(true);
    try {
        const report = await generateDailyJournal(tokens, aiConfig);
        const newEntry: JournalEntry = {
            id: Date.now().toString(),
            date: Date.now(),
            summary: report.summary,
            patterns: report.patterns
        };
        onAddEntry(newEntry);
        setExpandedId(newEntry.id);
    } catch (e: any) {
        alert("Ошибка генерации отчета: " + e.message);
    } finally {
        setGenerating(false);
    }
  };

  const getCategoryColor = (cat: JournalCategoryType) => {
    switch (cat) {
        case JournalCategoryType.TOKEN_DEATH: return 'text-red-500 bg-red-900/20 border-red-900';
        case JournalCategoryType.SCAM_MANIPULATION: return 'text-orange-500 bg-orange-900/20 border-orange-900';
        case JournalCategoryType.ORGANIC_GROWTH: return 'text-green-400 bg-green-900/20 border-green-900';
        case JournalCategoryType.ACCUMULATION: return 'text-blue-400 bg-blue-900/20 border-blue-900';
        case JournalCategoryType.PUMP_DUMP: return 'text-purple-400 bg-purple-900/20 border-purple-900';
        default: return 'text-gray-400';
    }
  };

  const formatCatName = (cat: string) => cat.replace('_', ' ');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                📓 Pattern Journal
            </h2>
            <p className="text-gray-400 text-sm mt-1">
                Daily AI analysis of market behavior. Learn from the "Graveyard" and the "Moonshots".
            </p>
        </div>
        <button 
            onClick={handleGenerateReport}
            disabled={generating}
            className={`px-6 py-3 rounded-lg font-bold shadow-lg flex items-center gap-2 transition-all ${
                generating ? 'bg-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-105 text-white'
            }`}
        >
            {generating ? (
                <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing Market...
                </>
            ) : (
                <>
                    ✨ Generate Daily Report
                </>
            )}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/4 space-y-3">
            {entries.length === 0 && <div className="text-gray-500 text-center py-4">No entries yet.</div>}
            {entries.map(entry => (
                <div 
                    key={entry.id}
                    onClick={() => setExpandedId(entry.id)}
                    className={`p-4 rounded-lg cursor-pointer border transition-all ${
                        expandedId === entry.id 
                        ? 'bg-gray-800 border-indigo-500 shadow-md' 
                        : 'bg-gray-900 border-gray-800 hover:bg-gray-800'
                    }`}
                >
                    <div className="text-sm text-gray-400">{new Date(entry.date).toLocaleDateString()}</div>
                    <div className="font-bold text-white text-lg">{new Date(entry.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} Report</div>
                    <div className="text-xs text-gray-500 mt-2 truncate">{entry.summary}</div>
                </div>
            ))}
        </div>

        <div className="flex-1">
            {expandedId && entries.find(e => e.id === expandedId) ? (
                (() => {
                    const entry = entries.find(e => e.id === expandedId)!;
                    return (
                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 space-y-8">
                            <div className="border-b border-gray-800 pb-6">
                                <h1 className="text-3xl font-bold text-white mb-2">Market Analysis Log</h1>
                                <p className="text-gray-400 italic">"{entry.summary}"</p>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                {entry.patterns.map((pattern, idx) => (
                                    <div key={idx} className={`rounded-xl border p-6 ${getCategoryColor(pattern.category)} bg-opacity-10`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-xl font-bold uppercase tracking-wider">{formatCatName(pattern.category)}</h3>
                                            <div className="flex -space-x-2">
                                                {pattern.detectedTokens.slice(0, 5).map(t => (
                                                    <div key={t} className="w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-900 flex items-center justify-center text-xs font-bold text-white" title={t}>
                                                        {t[0]}
                                                    </div>
                                                ))}
                                                {pattern.detectedTokens.length > 5 && (
                                                    <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-xs text-white">
                                                        +{pattern.detectedTokens.length - 5}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <p className="text-gray-200 mb-4 leading-relaxed">{pattern.description}</p>

                                        <div className="bg-black/20 rounded p-4">
                                            <h4 className="text-xs uppercase font-bold opacity-70 mb-2">Key Indicators Detected:</h4>
                                            <ul className="list-disc list-inside space-y-1">
                                                {pattern.keyIndicators.map((ind, i) => (
                                                    <li key={i} className="text-sm font-mono">{ind}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()
            ) : (
                <div className="h-full flex items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-xl">
                    Select a journal entry to view details
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
