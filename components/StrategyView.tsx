

import React, { useState, useEffect } from 'react';
import { StrategyConfig, LifecycleStage, CorrelationRule, AlertMetric } from '../types';

interface Props {
  config: StrategyConfig;
  setConfig: (c: StrategyConfig) => void;
}

// Helper Component for Label + Russian + Tooltip
const HelpLabel: React.FC<{ label: string; ru: string; tip: string }> = ({ label, ru, tip }) => (
  <div className="flex items-center gap-2 mb-1 group relative w-fit">
    <span className="text-xs text-gray-400 font-bold uppercase">
      {label} <span className="text-gray-500 font-normal normal-case">({ru})</span>
    </span>
    <div className="cursor-help text-gray-600 hover:text-solana-purple transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    {/* Tooltip */}
    <div className="absolute left-0 bottom-5 w-64 bg-gray-900 border border-gray-700 p-3 rounded shadow-xl text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
      {tip}
    </div>
  </div>
);

// Smart Input Component that handles typing correctly without locking up
const SmartInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  className?: string;
  step?: string;
  placeholder?: string;
  disabled?: boolean;
}> = ({ value, onChange, className, step = "1", placeholder, disabled }) => {
  const [text, setText] = useState<string>(value?.toString() ?? '');

  // Sync with parent ONLY if the numeric value actually changed differently from our current text
  useEffect(() => {
    const parsed = parseFloat(text);
    if (text === '' && (value === 0 || value === undefined)) return;
    if (parsed === value) return;
    setText(value?.toString() ?? '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    
    if (val === '') {
        onChange(0);
    } else {
        const num = parseFloat(val);
        if (!isNaN(num)) onChange(num);
    }
  };

  return (
    <input 
      type="number" 
      step={step}
      value={text} 
      onChange={handleChange} 
      className={className}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
};

export const StrategyView: React.FC<Props> = ({ config, setConfig }) => {
  const [activeTab, setActiveTab] = useState<'STAGES' | 'CORRELATIONS'>('STAGES');
  const [localConfig, setLocalConfig] = useState<StrategyConfig>(JSON.parse(JSON.stringify(config)));
  const [activeStageIndex, setActiveStageIndex] = useState<number>(0);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!hasChanges) {
        setLocalConfig(JSON.parse(JSON.stringify(config)));
    }
  }, [config]);

  const handleGlobalChange = (key: keyof StrategyConfig, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = () => {
    const sortedConfig = {
        ...localConfig,
        stages: localConfig.stages.sort((a, b) => a.startAgeMinutes - b.startAgeMinutes)
    };
    setConfig(sortedConfig);
    setHasChanges(false);
  };

  // --- STAGE LOGIC ---
  const handleStageChange = (field: keyof LifecycleStage, value: any) => {
    const newStages = [...localConfig.stages];
    if (!newStages[activeStageIndex]) return;
    newStages[activeStageIndex] = { ...newStages[activeStageIndex], [field]: value };
    setLocalConfig({ ...localConfig, stages: newStages });
    setHasChanges(true);
  };

  const handleAddStage = () => {
      const lastStage = localConfig.stages[localConfig.stages.length - 1];
      const newStage: LifecycleStage = {
          ...lastStage,
          id: Date.now().toString(),
          enabled: true,
          name: `New Stage ${localConfig.stages.length + 1}`,
          startAgeMinutes: lastStage ? lastStage.startAgeMinutes + 60 : 0,
          description: "New filtration phase."
      };
      setLocalConfig({ ...localConfig, stages: [...localConfig.stages, newStage] });
      setActiveStageIndex(localConfig.stages.length); 
      setHasChanges(true);
  };

  const handleDeleteStage = () => {
      const currentStages = localConfig.stages;
      const indexToDelete = activeStageIndex;
      if (currentStages.length <= 1) {
          alert("Cannot delete the last remaining stage.");
          return;
      }
      if (!window.confirm("Delete this stage?")) return;

      const newStages = currentStages.filter((_, i) => i !== indexToDelete);
      let newIndex = indexToDelete;
      if (newIndex >= newStages.length) {
          newIndex = Math.max(0, newStages.length - 1);
      }
      setActiveStageIndex(newIndex);
      setLocalConfig(prev => ({ ...prev, stages: newStages }));
      setHasChanges(true);
  };

  // --- CORRELATION LOGIC ---
  const handleAddCorrelation = () => {
      const newRule: CorrelationRule = {
          id: Date.now().toString(),
          enabled: true,
          name: 'New Pattern',
          description: 'Detects zombie coins',
          metric: 'PRICE_CHANGE_5M',
          condition: 'LT',
          value: 0,
          minAgeMinutes: 30
      };
      setLocalConfig(prev => ({
          ...prev,
          correlations: [...(prev.correlations || []), newRule]
      }));
      setHasChanges(true);
  };

  const updateCorrelation = (id: string, field: keyof CorrelationRule, value: any) => {
      const newRules = (localConfig.correlations || []).map(r => 
          r.id === id ? { ...r, [field]: value } : r
      );
      setLocalConfig(prev => ({ ...prev, correlations: newRules }));
      setHasChanges(true);
  };

  const deleteCorrelation = (id: string) => {
      setLocalConfig(prev => ({
          ...prev,
          correlations: (prev.correlations || []).filter(r => r.id !== id)
      }));
      setHasChanges(true);
  };

  const activeStage = localConfig.stages[activeStageIndex];

  return (
    <div className="animate-fade-in pb-20 h-[85vh] flex flex-col">
      {/* HEADER TABS */}
      <div className="flex gap-4 border-b border-gray-800 mb-6 bg-gray-900 px-4 pt-2 rounded-t-xl sticky top-0 z-30">
          <button 
             onClick={() => setActiveTab('STAGES')}
             className={`px-6 py-3 border-b-2 font-bold transition-all ${activeTab === 'STAGES' ? 'border-solana-green text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
             🚦 Lifecycle Stages <span className="text-xs font-normal opacity-70">(Этапы)</span>
          </button>
          <button 
             onClick={() => setActiveTab('CORRELATIONS')}
             className={`px-6 py-3 border-b-2 font-bold transition-all ${activeTab === 'CORRELATIONS' ? 'border-solana-purple text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
             🎯 Correlations DB <span className="text-xs font-normal opacity-70">(База Корреляций)</span>
          </button>
          <div className="flex-1 flex justify-end items-center pb-2 pr-2">
              <button 
                onClick={handleSave}
                disabled={!hasChanges} 
                className={`
                    px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 transition-all
                    ${hasChanges 
                        ? 'bg-solana-green hover:bg-emerald-400 text-gray-900 animate-pulse cursor-pointer' 
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'}
                `}
              >
                  💾 Apply Changes (Применить)
              </button>
          </div>
      </div>

      {activeTab === 'STAGES' && activeStage && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
            {/* TIMELINE */}
            <div className="lg:col-span-1 bg-gray-900 border-r border-gray-800 p-4 flex flex-col overflow-y-auto custom-scrollbar rounded-bl-xl">
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-white">Timeline</h2>
                    <p className="text-xs text-gray-500">Sequential filtration logic.</p>
                </div>
                <div className="relative space-y-0">
                    <div className="absolute left-[1.65rem] top-4 bottom-4 w-0.5 bg-gray-800 z-0"></div>
                    {localConfig.stages.map((stage, idx) => (
                        <div key={stage.id} className="relative z-10">
                            {idx > 0 && <div className="ml-5 h-6 border-l-2 border-dashed border-gray-700"></div>}
                            <div 
                                onClick={() => setActiveStageIndex(idx)}
                                className={`pl-10 pr-4 py-3 rounded-xl border-l-4 cursor-pointer transition-all group ${idx === activeStageIndex ? 'bg-gray-800 border-solana-green shadow-lg' : 'bg-transparent border-gray-700 hover:bg-gray-800/50'} ${stage.enabled === false ? 'opacity-50 grayscale' : ''}`}
                            >
                                <div className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center ${idx === activeStageIndex ? 'bg-solana-green border-solana-green' : 'bg-gray-900 border-gray-600'}`}>
                                    <span className="text-[8px] font-bold text-gray-900">{idx + 1}</span>
                                </div>
                                <h3 className={`font-bold text-sm ${idx === activeStageIndex ? 'text-white' : 'text-gray-400'}`}>{stage.name}</h3>
                                <div className="text-[10px] text-gray-500">{stage.description}</div>
                                <div className="text-xs font-mono text-solana-purple mt-1">Age: {stage.startAgeMinutes}m+</div>
                            </div>
                        </div>
                    ))}
                    <button onClick={handleAddStage} className="ml-8 mt-6 w-[calc(100%-2rem)] py-3 bg-gray-800 border border-dashed border-gray-600 rounded text-xs text-gray-400 hover:text-white">➕ Add Stage</button>
                </div>
            </div>

            {/* STAGE EDITOR */}
            <div key={activeStage.id} className="lg:col-span-3 bg-gray-850 p-8 rounded-xl border border-gray-750 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                    <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={activeStage.enabled !== false} onChange={(e) => handleStageChange('enabled', e.target.checked)} className="sr-only peer" />
                            <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:bg-solana-green peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                        </label>
                        <span className="font-bold text-white">{activeStage.name}</span>
                    </div>
                    <button onClick={handleDeleteStage} className="text-red-400 text-sm hover:underline">Delete Stage</button>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${activeStage.enabled === false ? 'opacity-50 pointer-events-none' : ''}`}>
                    {/* Meta */}
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 col-span-2 grid grid-cols-2 gap-4">
                        <div>
                            <HelpLabel label="Stage Name" ru="Название" tip="Name of this phase" />
                            <input type="text" value={activeStage.name} onChange={e => handleStageChange('name', e.target.value)} className="w-full bg-gray-800 border-gray-700 text-white p-2 rounded text-sm" />
                        </div>
                        <div>
                            <HelpLabel label="Start Age (Min)" ru="Старт (мин)" tip="When does this stage begin?" />
                            <SmartInput value={activeStage.startAgeMinutes} onChange={v => handleStageChange('startAgeMinutes', v)} className="w-full bg-gray-800 border-gray-700 text-white p-2 rounded text-sm font-mono" />
                        </div>
                    </div>

                    {/* Liquidity */}
                    <div className="border border-blue-900/30 bg-blue-900/5 p-4 rounded-xl">
                        <h3 className="text-blue-400 font-bold mb-3">💧 Liquidity</h3>
                        <div className="space-y-3">
                            <div><HelpLabel label="Min ($)" ru="Мин" tip="Min Liquidity" /><SmartInput value={activeStage.minLiquidity} onChange={v => handleStageChange('minLiquidity', v)} className="w-full bg-gray-900 border-gray-700 text-white p-2 rounded text-sm font-mono" /></div>
                            <div><HelpLabel label="Max ($)" ru="Макс" tip="Max Liquidity" /><SmartInput value={activeStage.maxLiquidity} onChange={v => handleStageChange('maxLiquidity', v)} className="w-full bg-gray-900 border-gray-700 text-white p-2 rounded text-sm font-mono" /></div>
                        </div>
                    </div>

                    {/* MCAP */}
                    <div className="border border-purple-900/30 bg-purple-900/5 p-4 rounded-xl">
                        <h3 className="text-purple-400 font-bold mb-3">📊 Market Cap</h3>
                        <div className="space-y-3">
                            <div><HelpLabel label="Min ($)" ru="Мин" tip="Min MCAP" /><SmartInput value={activeStage.minMcap} onChange={v => handleStageChange('minMcap', v)} className="w-full bg-gray-900 border-gray-700 text-white p-2 rounded text-sm font-mono" /></div>
                            <div><HelpLabel label="Max ($)" ru="Макс" tip="Max MCAP" /><SmartInput value={activeStage.maxMcap} onChange={v => handleStageChange('maxMcap', v)} className="w-full bg-gray-900 border-gray-700 text-white p-2 rounded text-sm font-mono" /></div>
                        </div>
                    </div>

                    {/* Holders */}
                    <div className="border border-red-900/30 bg-red-900/5 p-4 rounded-xl col-span-2 grid grid-cols-3 gap-4">
                         <div className="col-span-3"><h3 className="text-red-400 font-bold">👥 Holders</h3></div>
                         <div><HelpLabel label="Min Count" ru="Мин" tip="Min Holders" /><SmartInput value={activeStage.minHolders} onChange={v => handleStageChange('minHolders', v)} className="w-full bg-gray-900 border-gray-700 text-white p-2 rounded text-sm font-mono" /></div>
                         <div><HelpLabel label="Max Count" ru="Макс" tip="Max Holders" /><SmartInput value={activeStage.maxHolders} onChange={v => handleStageChange('maxHolders', v)} className="w-full bg-gray-900 border-gray-700 text-white p-2 rounded text-sm font-mono" /></div>
                         <div><HelpLabel label="Max Top 10 %" ru="Топ-10" tip="Max concentration" /><SmartInput value={activeStage.maxTop10Holding} onChange={v => handleStageChange('maxTop10Holding', v)} className="w-full bg-gray-900 border-gray-700 text-white p-2 rounded text-sm font-mono" /></div>
                    </div>
                    
                     {/* Global Limits */}
                     <div className="col-span-2 border-t border-gray-800 pt-4 mt-2">
                        <HelpLabel label="Tracking Limit" ru="Лимит Времени" tip="Max age to track" />
                        <div className="flex gap-4">
                            <div className="relative flex-1"><SmartInput value={localConfig.trackingDays} onChange={v => handleGlobalChange('trackingDays', v)} className="w-full bg-gray-900 border-gray-700 text-white p-2 rounded text-sm font-mono" /><span className="absolute right-2 top-2 text-xs text-gray-500">Days</span></div>
                            <div className="relative flex-1"><SmartInput value={localConfig.trackingHours} onChange={v => handleGlobalChange('trackingHours', v)} className="w-full bg-gray-900 border-gray-700 text-white p-2 rounded text-sm font-mono" /><span className="absolute right-2 top-2 text-xs text-gray-500">Hours</span></div>
                        </div>
                     </div>
                </div>
            </div>
          </div>
      )}

      {activeTab === 'CORRELATIONS' && (
          <div className="flex-1 bg-gray-850 p-8 rounded-b-xl border border-gray-750 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start mb-6">
                  <div>
                      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                          🎯 Correlation Database <span className="text-gray-500 text-lg">(База Корреляций)</span>
                      </h2>
                      <p className="text-gray-400 text-sm mt-1">
                          Define patterns that signal a "Zombie Coin" or "Slow Death". If triggered, the user gets a warning.
                      </p>
                  </div>
                  <button onClick={handleAddCorrelation} className="px-6 py-2 bg-solana-purple hover:bg-purple-600 text-white rounded-lg font-bold shadow-lg transition-colors">
                      + Add Pattern
                  </button>
              </div>

              <div className="space-y-4">
                  {(localConfig.correlations || []).length === 0 && (
                      <div className="text-center py-12 text-gray-500 bg-gray-900/30 rounded border border-dashed border-gray-700">
                          No correlation patterns defined. Create one to detect "Zombie" tokens.
                      </div>
                  )}
                  {(localConfig.correlations || []).map(rule => (
                      <div key={rule.id} className={`p-4 rounded-xl border transition-all ${rule.enabled ? 'bg-gray-900 border-gray-700' : 'bg-gray-900/50 border-gray-800 opacity-60'}`}>
                          <div className="flex justify-between items-start gap-4">
                              {/* Left Controls */}
                              <div className="flex items-center gap-3 pt-1">
                                  <input type="checkbox" checked={rule.enabled} onChange={e => updateCorrelation(rule.id, 'enabled', e.target.checked)} className="w-5 h-5 accent-solana-purple rounded cursor-pointer" />
                                  <div className="flex-1">
                                      <input 
                                        type="text" 
                                        value={rule.name} 
                                        onChange={e => updateCorrelation(rule.id, 'name', e.target.value)}
                                        className="bg-transparent text-white font-bold text-lg border-b border-transparent hover:border-gray-600 focus:border-solana-purple outline-none w-full"
                                        placeholder="Pattern Name"
                                      />
                                      <input 
                                        type="text" 
                                        value={rule.description} 
                                        onChange={e => updateCorrelation(rule.id, 'description', e.target.value)}
                                        className="bg-transparent text-gray-500 text-xs w-full border-b border-transparent hover:border-gray-600 focus:border-solana-purple outline-none mt-1"
                                        placeholder="Description"
                                      />
                                  </div>
                              </div>

                              {/* Logic */}
                              <div className="flex items-center gap-2 bg-black/20 p-2 rounded border border-gray-800">
                                  <span className="text-xs text-gray-400 font-bold">IF</span>
                                  <select 
                                    value={rule.metric} 
                                    onChange={e => updateCorrelation(rule.id, 'metric', e.target.value)}
                                    className="bg-gray-800 text-white text-xs p-1 rounded border border-gray-700 outline-none"
                                  >
                                      <option value="PRICE_CHANGE_5M">Price 5m %</option>
                                      <option value="TX_COUNT">Tx Count</option>
                                      <option value="VOLUME_24H">Volume ($)</option>
                                      <option value="NET_VOLUME">Net Volume ($)</option>
                                  </select>
                                  <select 
                                    value={rule.condition} 
                                    onChange={e => updateCorrelation(rule.id, 'condition', e.target.value)}
                                    className="bg-gray-800 text-white text-xs p-1 rounded border border-gray-700 outline-none font-mono"
                                  >
                                      <option value="GT">&gt;</option>
                                      <option value="LT">&lt;</option>
                                      <option value="EQ">=</option>
                                  </select>
                                  <SmartInput 
                                    value={rule.value} 
                                    onChange={v => updateCorrelation(rule.id, 'value', v)} 
                                    className="w-20 bg-gray-800 text-white text-xs p-1 rounded border border-gray-700 outline-none font-mono"
                                  />
                              </div>

                              {/* Time Condition */}
                              <div className="flex items-center gap-2 bg-black/20 p-2 rounded border border-gray-800">
                                  <span className="text-xs text-gray-400 font-bold">WHEN AGE &gt;</span>
                                  <SmartInput 
                                    value={rule.minAgeMinutes} 
                                    onChange={v => updateCorrelation(rule.id, 'minAgeMinutes', v)} 
                                    className="w-16 bg-gray-800 text-white text-xs p-1 rounded border border-gray-700 outline-none font-mono"
                                  />
                                  <span className="text-xs text-gray-500">min</span>
                              </div>

                              <button onClick={() => deleteCorrelation(rule.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                                  🗑️
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};
