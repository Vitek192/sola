

import React, { useState } from 'react';
import { JournalEntry, JournalCategoryType, Token, AIConfig, TechnicalAnalysis } from '../types';
import { generateDailyJournal, generateTechnicalAnalysis } from '../services/gemini';

interface Props {
  tokens: Token[];
  entries: JournalEntry[];
  onAddEntry: (entry: JournalEntry) => void;
  aiConfig: AIConfig;
  onNotify: (msg: string) => void; 
}

export const PatternJournal: React.FC<Props> = ({ tokens, entries, onAddEntry, aiConfig, onNotify }) => {
  const [generating, setGenerating] = useState(false);
  const [activeCohortScan, setActiveCohortScan] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(entries.length > 0 ? entries[0].id : null);
  
  // Technical Analysis State
  const [selectedTaTokenId, setSelectedTaTokenId] = useState<string>('');
  const [taResult, setTaResult] = useState<TechnicalAnalysis | null>(null);
  const [isAnalyzingTa, setIsAnalyzingTa] = useState(false);

  const selectedTaToken = tokens.find(t => t.id === selectedTaTokenId);

  const formatAge = (createdAt: number) => {
      const diffMs = Date.now() - createdAt;
      const minutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ${hours % 24}h`;
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      return `${minutes}m`;
  };

  // --- JOURNAL LOGIC ---
  const handleGenerateReport = async (targetCohort?: string) => {
    const hasActiveKeys = aiConfig.enabled && aiConfig.keys.some(k => k.enabled);
    if (!hasActiveKeys) {
        alert("⚠️ AI Мозг не подключен!\nПожалуйста, перейдите в Settings -> AI Keyring и добавьте хотя бы один активный API ключ (Gemini или OpenRouter).");
        return;
    }

    if (tokens.length === 0) {
        alert("Нет данных для анализа. Подождите, пока сканер соберет информацию о монетах.");
        return;
    }

    setGenerating(true);
    if (targetCohort) setActiveCohortScan(targetCohort);

    try {
        const report = await generateDailyJournal(tokens, aiConfig, targetCohort);
        const newEntry: JournalEntry = {
            id: Date.now().toString(),
            date: Date.now(),
            summary: targetCohort ? `[${targetCohort}] Deep Analysis: ${report.summary}` : report.summary,
            patterns: report.patterns,
            suggestedRules: report.suggestedRules
        };
        onAddEntry(newEntry);
        setExpandedId(newEntry.id);
        
        const patternSummary = report.patterns.length > 0 
            ? report.patterns.map(p => `• ${p.category}: ${p.detectedTokens.length} tokens`).join('\n') 
            : 'No distinct patterns found.';
            
        const msg = `📓 *Pattern Journal Report*\n` +
                    `Cohort: ${targetCohort || 'General Market'}\n` + 
                    `Summary: ${report.summary}\n\n` +
                    `*Findings:*\n${patternSummary}\n\n` + 
                    (report.suggestedRules && report.suggestedRules.length > 0 ? `💡 *AI suggested ${report.suggestedRules.length} new rules.*` : '');
        
        onNotify(msg);

    } catch (e: any) {
        alert("Ошибка генерации отчета: " + e.message);
    } finally {
        setGenerating(false);
        setActiveCohortScan(null);
    }
  };

  // --- TA LOGIC ---
  const handleRunTA = async () => {
      if (!selectedTaTokenId) return;
      const token = tokens.find(t => t.id === selectedTaTokenId);
      if (!token) return;

      setIsAnalyzingTa(true);
      setTaResult(null);

      try {
          const result = await generateTechnicalAnalysis(token, aiConfig);
          setTaResult(result);
          onNotify(`🕯️ *Technical Analysis: ${token.symbol}*\nPattern: ${result.candlePattern}\nTrend: ${result.trend}\nSupport: ${result.supportLevel} | Res: ${result.resistanceLevel}`);
      } catch (e: any) {
          alert("TA Error: " + e.message);
      } finally {
          setIsAnalyzingTa(false);
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

  const CohortBtn = ({ label, cohortId, bg }: { label: string, cohortId: string, bg: string }) => (
      <button 
        onClick={() => handleGenerateReport(cohortId)}
        disabled={generating}
        className={`flex-1 py-3 rounded-lg font-bold text-xs uppercase transition-all shadow-md border border-white/5 relative overflow-hidden group ${bg} hover:brightness-110 disabled:opacity-50 disabled:grayscale`}
      >
          {activeCohortScan === cohortId && (
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
          )}
          {label}
      </button>
  );

  // Filter recommendations for TA selector
  const recommendedForTa = tokens.filter(t => t.aiAnalysis?.action === 'BUY' || t.status === 'BUY_SIGNAL').sort((a,b) => (b.aiAnalysis?.confidence || 0) - (a.aiAnalysis?.confidence || 0));
  const otherTokens = tokens.filter(t => !recommendedForTa.includes(t)).slice(0, 50); // Limit list

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* 1. TECHNICAL ANALYSIS LAB (NEW) */}
      <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 shadow-lg">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
               <span className="bg-blue-500/10 text-blue-400 p-2 rounded-lg text-2xl border border-blue-500/20">🕯️</span>
               <div>
                   <h2 className="text-xl font-bold text-white">Лаборатория Технического Анализа (TA Lab)</h2>
                   <p className="text-gray-400 text-xs">AI-driven Candlestick & Trend Analysis for selected assets.</p>
               </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* SELECTOR */}
              <div className="md:col-span-1 space-y-4">
                  <div>
                      <label className="text-xs uppercase font-bold text-gray-500 mb-2 block">Выберите монету</label>
                      <select 
                          value={selectedTaTokenId}
                          onChange={(e) => { setSelectedTaTokenId(e.target.value); setTaResult(null); }}
                          className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-lg focus:border-blue-500 outline-none"
                      >
                          <option value="">-- Select Asset --</option>
                          {recommendedForTa.length > 0 && (
                              <optgroup label="🔥 Recommended (Buy Signals)">
                                  {recommendedForTa.map(t => (
                                      <option key={t.id} value={t.id}>
                                          {t.symbol} | Age: {formatAge(t.createdAt)} | Conf: {t.aiAnalysis?.confidence}%
                                      </option>
                                  ))}
                              </optgroup>
                          )}
                          <optgroup label="Other Assets">
                              {otherTokens.map(t => (
                                  <option key={t.id} value={t.id}>
                                      {t.symbol} | Age: {formatAge(t.createdAt)}
                                  </option>
                              ))}
                          </optgroup>
                      </select>
                  </div>
                  
                  <button 
                      onClick={handleRunTA}
                      disabled={!selectedTaTokenId || isAnalyzingTa}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                      {isAnalyzingTa ? <span className="animate-spin">⏳</span> : '📊'}
                      {isAnalyzingTa ? 'Analyzing Patterns...' : 'Run Technical Analysis'}
                  </button>

                  {selectedTaTokenId && (
                      <div className="text-center text-xs text-gray-500 mt-2">
                          Analyzes last 50 data points for Candles, RSI, and SR Levels.
                      </div>
                  )}
              </div>

              {/* RESULT DISPLAY */}
              <div className="md:col-span-2 bg-gray-900/50 rounded-xl border border-gray-800 p-6 relative min-h-[250px] flex items-center justify-center">
                  {!taResult && !isAnalyzingTa && (
                      <div className="text-gray-600 text-sm italic">
                          Select a token and click Run to see Candlestick patterns.
                      </div>
                  )}
                  {isAnalyzingTa && (
                      <div className="flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-blue-400 text-xs font-mono animate-pulse">Reading Candles...</span>
                      </div>
                  )}
                  {taResult && (
                      <div className="w-full h-full flex flex-col gap-4">
                           {/* HEADER WITH TREND */}
                           <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                               <h3 className="text-lg font-bold text-white">Technical Analysis Results</h3>
                               <div className={`px-4 py-2 rounded-lg font-bold border ${taResult.trend === 'BULLISH' ? 'bg-green-900/20 border-green-500 text-green-400' : taResult.trend === 'BEARISH' ? 'bg-red-900/20 border-red-500 text-red-400' : 'bg-gray-800 border-gray-600 text-gray-300'}`}>
                                   {taResult.trend}
                               </div>
                           </div>

                           {/* SEPARATE PATTERN FIELD */}
                           <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-inner mt-1">
                                <span className="text-xs text-gray-400 uppercase font-bold block mb-1">⚡ Detected Patterns (Паттерны)</span>
                                <div className="text-xl font-mono text-yellow-400 font-bold tracking-wide">
                                    {taResult.candlePattern || "No significant pattern detected"}
                                </div>
                           </div>

                           {/* STATS GRID */}
                           <div className="grid grid-cols-3 gap-4 text-center mt-2">
                               <div className="bg-gray-800 p-3 rounded border border-gray-700">
                                   <div className="text-xs text-gray-500 mb-1">Support</div>
                                   <div className="text-green-400 font-mono font-bold">${taResult.supportLevel}</div>
                               </div>
                               <div className="bg-gray-800 p-3 rounded border border-gray-700">
                                   <div className="text-xs text-gray-500 mb-1">Resistance</div>
                                   <div className="text-red-400 font-mono font-bold">${taResult.resistanceLevel}</div>
                               </div>
                               <div className="bg-gray-800 p-3 rounded border border-gray-700">
                                   <div className="text-xs text-gray-500 mb-1">RSI Status</div>
                                   <div className={`font-bold ${taResult.rsiStatus === 'OVERSOLD' ? 'text-green-400' : taResult.rsiStatus === 'OVERBOUGHT' ? 'text-red-400' : 'text-gray-300'}`}>
                                       {taResult.rsiStatus}
                                   </div>
                               </div>
                           </div>

                           <div className="bg-blue-900/10 border border-blue-900/30 p-3 rounded text-sm text-blue-200 leading-relaxed mt-2">
                               {taResult.summary}
                           </div>

                           {/* GECKO BUTTON */}
                           {selectedTaToken && (
                               <a 
                                    href={`https://www.geckoterminal.com/solana/pools/${selectedTaToken.address}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg font-bold text-sm transition-colors border border-gray-600 flex items-center justify-center gap-2 mt-auto shadow-md hover:shadow-lg"
                               >
                                    <span>🦎</span> View Chart on GeckoTerminal
                               </a>
                           )}
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* 2. GRADIENT ANALYTICS (EXISTING) */}
      <div className="bg-gray-850 p-6 rounded-xl border border-gray-750">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    📓 Gradient Analytics <span className="text-solana-purple">Pro</span>
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                    Deep Cohort Analysis. Identify survival patterns for precise timeframes.
                </p>
            </div>
            
            <button 
                onClick={() => handleGenerateReport()}
                disabled={generating}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold text-sm border border-gray-600 shadow transition-all"
            >
                Full Market Overview (Общий)
            </button>
        </div>

        <div className="space-y-4">
            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Intraday (Hours) - Launch Stage</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    <CohortBtn label="0-1h (Launch)" cohortId="0h-1h" bg="bg-indigo-900/50 text-indigo-200" />
                    <CohortBtn label="1-6h (Early)" cohortId="1h-6h" bg="bg-blue-900/50 text-blue-200" />
                    <CohortBtn label="6-12h (Mid)" cohortId="6h-12h" bg="bg-cyan-900/50 text-cyan-200" />
                    <CohortBtn label="12-18h (Late)" cohortId="12h-18h" bg="bg-teal-900/50 text-teal-200" />
                    <CohortBtn label="18-24h (Day End)" cohortId="18h-24h" bg="bg-emerald-900/50 text-emerald-200" />
                </div>
            </div>

            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Swing (Days) - Survival Stage</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    <CohortBtn label="Day 2" cohortId="Day 2 (24-48h)" bg="bg-green-800/40 text-green-200" />
                    <CohortBtn label="Day 3" cohortId="Day 3 (48-72h)" bg="bg-lime-800/40 text-lime-200" />
                    <CohortBtn label="Day 4" cohortId="Day 4 (72-96h)" bg="bg-yellow-800/40 text-yellow-200" />
                    <CohortBtn label="Day 5" cohortId="Day 5 (96-120h)" bg="bg-orange-800/40 text-orange-200" />
                    <CohortBtn label="Day 6" cohortId="Day 6 (120-144h)" bg="bg-red-800/40 text-red-200" />
                    <CohortBtn label="Day 7+" cohortId="Day 7 (144-168h)" bg="bg-purple-800/40 text-purple-200" />
                </div>
            </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/4 space-y-3">
            {entries.length === 0 && <div className="text-gray-500 text-center py-4">No analysis reports yet.</div>}
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
                    <div className="text-xs text-gray-500 mt-2 line-clamp-2">{entry.summary}</div>
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

                            {/* SUGGESTED RULES SECTION */}
                            {entry.suggestedRules && entry.suggestedRules.length > 0 && (
                                <div className="bg-indigo-900/10 border border-indigo-500/30 rounded-xl p-6 animate-pulse-once">
                                    <h3 className="text-xl font-bold text-indigo-300 mb-4 flex items-center gap-2">
                                        🤖 AI Strategy Suggestions (Correlation Candidates)
                                        <span className="text-xs bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded border border-indigo-500/30">Actionable</span>
                                    </h3>
                                    <p className="text-sm text-gray-400 mb-4">
                                        The AI has identified the following metrics as key differentiators for profitable tokens.
                                        Add these to the <b>Correlation DB</b> in the Strategy tab.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {entry.suggestedRules.map((rule, idx) => (
                                            <div key={idx} className="bg-gray-900/50 p-4 rounded border border-indigo-500/20 hover:border-indigo-500/50 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-bold uppercase text-gray-500 bg-gray-800 px-2 py-1 rounded">{rule.cohort}</span>
                                                    <span className="text-xs text-indigo-400 font-mono">Metric: {rule.metric}</span>
                                                </div>
                                                <div className="font-bold text-white text-lg mb-1">{rule.ruleName}</div>
                                                <div className="text-sm font-mono text-green-400 bg-black/30 p-2 rounded mb-2 border border-gray-800">
                                                    IF {rule.metric} {rule.condition === 'GT' ? '>' : rule.condition === 'LT' ? '<' : '='} {rule.value}
                                                </div>
                                                <p className="text-xs text-gray-400 italic">{rule.explanation}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

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
