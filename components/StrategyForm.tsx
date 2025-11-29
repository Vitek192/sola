

import React, { useState, useEffect } from 'react';
import { StrategyConfig, LifecycleStage } from '../types';

interface Props {
  config: StrategyConfig;
  setConfig: (c: StrategyConfig) => void;
}

// Helper component for the tooltip
const FilterLabel: React.FC<{ label: string; ruLabel: string; description: string }> = ({ label, ruLabel, description }) => (
  <div className="flex items-center gap-2 mb-2 group relative">
    <span className="text-sm text-gray-400 font-medium">
      {label} <span className="text-gray-500 font-normal">({ruLabel})</span>
    </span>
    <div className="cursor-help text-gray-500 hover:text-solana-purple transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    
    {/* Tooltip Popup */}
    <div className="absolute left-0 bottom-6 w-72 bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
      <div className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-900 border-b border-r border-gray-700 transform rotate-45"></div>
      {description}
    </div>
  </div>
);

export const StrategyForm: React.FC<Props> = ({ config, setConfig }) => {
  // Use local state to buffer changes before saving
  const [localConfig, setLocalConfig] = useState<StrategyConfig>(config);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state if parent config changes externally (unlikely but good practice)
  useEffect(() => {
    setLocalConfig(config);
    setHasChanges(false);
  }, [config]);

  const handleGlobalChange = (key: keyof StrategyConfig, value: number) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    
    const isDifferent = JSON.stringify(newConfig) !== JSON.stringify(config);
    setHasChanges(isDifferent);
  };

  const handleStageChange = (key: keyof LifecycleStage, value: number) => {
    if (localConfig.stages.length === 0) return;
    const newStages = [...localConfig.stages];
    newStages[0] = { ...newStages[0], [key]: value };
    const newConfig = { ...localConfig, stages: newStages };
    setLocalConfig(newConfig);

    const isDifferent = JSON.stringify(newConfig) !== JSON.stringify(config);
    setHasChanges(isDifferent);
  };

  const handleSave = () => {
    setConfig(localConfig);
    setHasChanges(false);
  };

  const stage = localConfig.stages[0] || {} as Partial<LifecycleStage>;

  return (
    <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 mb-8 shadow-lg">
      <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
          <h2 className="text-xl font-bold text-solana-green flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Filter Strategy (Стратегия Отсева) - First Stage
          </h2>
          {hasChanges && (
              <span className="text-xs text-yellow-500 font-bold animate-pulse">
                  ⚠️ Unsaved Changes
              </span>
          )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-6">
        
        {/* Liquidity Interval */}
        <div>
          <FilterLabel 
            label="Liquidity Range" 
            ruLabel="Интервал Ликвидности" 
            description="Определяет безопасный диапазон ликвидности. Слишком мало = риск Rug Pull. Слишком много (>$1M на старте) = подозрение на Honey Pot или накрутку. Монеты вне диапазона удаляются."
          />
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
                <span className="absolute left-2 top-2 text-gray-600 text-xs">Min</span>
                <input
                type="number"
                value={stage.minLiquidity ?? 0}
                onChange={(e) => handleStageChange('minLiquidity', parseFloat(e.target.value))}
                className="w-full bg-gray-950 border border-gray-700 text-white pl-8 pr-2 py-2 rounded focus:border-solana-green outline-none transition font-mono text-sm"
                />
            </div>
            <span className="text-gray-500">-</span>
            <div className="relative flex-1">
                <span className="absolute left-2 top-2 text-gray-600 text-xs">Max</span>
                <input
                type="number"
                value={stage.maxLiquidity ?? 0}
                onChange={(e) => handleStageChange('maxLiquidity', parseFloat(e.target.value))}
                className="w-full bg-gray-950 border border-gray-700 text-white pl-8 pr-2 py-2 rounded focus:border-solana-green outline-none transition font-mono text-sm"
                />
            </div>
          </div>
        </div>

        {/* Market Cap Interval (NEW) */}
        <div>
          <FilterLabel 
            label="Market Cap Range" 
            ruLabel="Интервал Капитализации" 
            description="Фильтр по рыночной капитализации (FDV). Min: отсеивает 'мертвые' монеты. Max: помогает найти монеты с потенциалом роста (Low Cap). Если MCAP > Max, монета считается переоцененной для входа."
          />
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
                <span className="absolute left-2 top-2 text-gray-600 text-xs">Min</span>
                <input
                type="number"
                value={stage.minMcap ?? 0}
                onChange={(e) => handleStageChange('minMcap', parseFloat(e.target.value))}
                className="w-full bg-gray-950 border border-gray-700 text-white pl-8 pr-2 py-2 rounded focus:border-solana-green outline-none transition font-mono text-sm"
                />
            </div>
            <span className="text-gray-500">-</span>
            <div className="relative flex-1">
                <span className="absolute left-2 top-2 text-gray-600 text-xs">Max</span>
                <input
                type="number"
                value={stage.maxMcap ?? 0}
                onChange={(e) => handleStageChange('maxMcap', parseFloat(e.target.value))}
                className="w-full bg-gray-950 border border-gray-700 text-white pl-8 pr-2 py-2 rounded focus:border-solana-green outline-none transition font-mono text-sm"
                />
            </div>
          </div>
        </div>

        {/* Holders Interval */}
        <div>
          <FilterLabel 
            label="Holders Range" 
            ruLabel="Интервал Держателей" 
            description="Баланс децентрализации. Min: отсеивает монеты, которые держит 1 человек. Max: отсеивает бот-атаки (Sybil), когда монету искусственно рассылают на 10,000 кошельков за минуту."
          />
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
                <span className="absolute left-2 top-2 text-gray-600 text-xs">Min</span>
                <input
                type="number"
                value={stage.minHolders ?? 0}
                onChange={(e) => handleStageChange('minHolders', parseFloat(e.target.value))}
                className="w-full bg-gray-950 border border-gray-700 text-white pl-8 pr-2 py-2 rounded focus:border-solana-green outline-none transition font-mono text-sm"
                />
            </div>
            <span className="text-gray-500">-</span>
            <div className="relative flex-1">
                <span className="absolute left-2 top-2 text-gray-600 text-xs">Max</span>
                <input
                type="number"
                value={stage.maxHolders ?? 0}
                onChange={(e) => handleStageChange('maxHolders', parseFloat(e.target.value))}
                className="w-full bg-gray-950 border border-gray-700 text-white pl-8 pr-2 py-2 rounded focus:border-solana-green outline-none transition font-mono text-sm"
                />
            </div>
          </div>
        </div>

        {/* Max Top 10 Holding */}
        <div>
          <FilterLabel 
            label="Max Top 10" 
            ruLabel="Макс. % у Китов" 
            description="Защита от сброса цены (Dump). Если топ-10 кошельков владеют больше, чем этот % от всего объема (например, >90%), риск того, что они обрушат цену в ноль одной продажей, слишком высок. Такие монеты помечаются как опасные."
          />
          <div className="relative">
            <input
              type="number"
              value={stage.maxTop10Holding ?? 0}
              onChange={(e) => handleStageChange('maxTop10Holding', parseFloat(e.target.value))}
              className="w-full bg-gray-950 border border-gray-700 text-white px-3 py-2 rounded focus:border-solana-green outline-none transition font-mono mt-1"
            />
            <span className="absolute right-3 top-2 text-gray-500">%</span>
          </div>
        </div>

        {/* Tracking Duration (Granular) */}
        <div>
          <FilterLabel 
            label="Tracking Limit" 
            ruLabel="Время Отслеживания" 
            description="Максимальное время жизни монеты, которое мы отслеживаем. Если монета живет дольше этого срока, она удаляется из списка 'Live Feed' (Отправляется в архив)."
          />
          <div className="flex items-center gap-2 mt-1">
            <div className="relative flex-1">
                <input
                  type="number"
                  value={localConfig.trackingDays}
                  onChange={(e) => handleGlobalChange('trackingDays', parseFloat(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 text-white pl-3 pr-8 py-2 rounded focus:border-solana-green outline-none transition font-mono"
                />
                <span className="absolute right-2 top-2 text-gray-500 text-xs">d</span>
            </div>
            <div className="relative flex-1">
                <input
                  type="number"
                  value={localConfig.trackingHours}
                  onChange={(e) => handleGlobalChange('trackingHours', parseFloat(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 text-white pl-3 pr-8 py-2 rounded focus:border-solana-green outline-none transition font-mono"
                />
                <span className="absolute right-2 top-2 text-gray-500 text-xs">h</span>
            </div>
          </div>
        </div>

        {/* AI Confidence Threshold */}
        <div>
          <FilterLabel 
            label="AI Confidence" 
            ruLabel="Уверенность ИИ" 
            description="Минимальный порог уверенности (в %), при котором сигнал считается рекомендацией к покупке в разделе 'Signals'. Чем выше, тем меньше сигналов, но они надежнее."
          />
          <div className="relative">
             <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={localConfig.minAIConfidence}
                onChange={(e) => handleGlobalChange('minAIConfidence', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-solana-purple mt-2"
             />
             <div className="flex justify-between text-xs mt-1 text-gray-500 font-mono">
                 <span>50%</span>
                 <span className="text-solana-purple font-bold text-sm">{localConfig.minAIConfidence}%</span>
                 <span>100%</span>
             </div>
          </div>
        </div>

      </div>

      {/* Save Button */}
      <div className="flex justify-end border-t border-gray-800 pt-4">
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`
                px-6 py-3 rounded-lg font-bold shadow-md transition-all flex items-center gap-2
                ${hasChanges 
                    ? 'bg-gradient-to-r from-solana-green to-emerald-600 hover:scale-105 text-gray-900 cursor-pointer' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }
            `}
          >
            {hasChanges ? (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Apply & Save Strategy (Применить)
                </>
            ) : (
                <>
                    <span>Saved</span>
                </>
            )}
          </button>
      </div>
    </div>
  );
};
