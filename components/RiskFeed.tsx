
import React, { useState } from 'react';
import { RiskAlert, CustomAlertRule, AlertMetric } from '../types';

interface Props {
  alerts: RiskAlert[];
  onClear: () => void;
  rules: CustomAlertRule[];
  onAddRule: (rule: CustomAlertRule) => void;
  onDeleteRule: (id: string) => void;
  onToggleRule: (id: string) => void;
}

const METRIC_LABELS: Record<AlertMetric, string> = {
    'PRICE_CHANGE_5M': 'Price Change 5m (Цена 5м %)',
    'PRICE_CHANGE_1H': 'Price Change 1h (Цена 1ч %)',
    'LIQUIDITY': 'Liquidity (Ликвидность $)',
    'VOLUME_24H': 'Volume 24h (Объем $)',
    'NET_VOLUME': 'Net Volume (Чистый Объем $)',
    'VOL_LIQ_RATIO': 'Vol/Liq Ratio (Коэф. Перегрева)',
    'TX_COUNT': 'Tx Count (Кол-во Транзакций)'
};

// Tooltip Helper
const HelpTip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative inline-block ml-1">
        <span className="cursor-help text-gray-500 hover:text-white text-xs">(?)</span>
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-gray-900 border border-gray-700 text-gray-300 text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            {text}
        </div>
    </div>
);

export const RiskFeed: React.FC<Props> = ({ alerts, onClear, rules, onAddRule, onDeleteRule, onToggleRule }) => {
  // Form State
  const [metric, setMetric] = useState<AlertMetric>('PRICE_CHANGE_5M');
  const [condition, setCondition] = useState<'GT' | 'LT'>('GT');
  const [value, setValue] = useState<number>(10);
  const [name, setName] = useState<string>('');

  const handleAdd = () => {
      if (!name) return;
      const newRule: CustomAlertRule = {
          id: Date.now().toString(),
          name,
          metric,
          condition,
          value,
          enabled: true
      };
      onAddRule(newRule);
      setName('');
      setValue(0);
  };

  return (
    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      
      {/* LEFT COLUMN: RULES ENGINE */}
      <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-850 p-6 rounded-xl border border-gray-750">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                🛠️ Rule Constructor <span className="text-sm text-gray-500">(Конструктор)</span>
            </h2>
            <p className="text-gray-400 text-xs mb-4">
                Parallel Logic (Параллельная Логика): All active rules are checked simultaneously.
            </p>

            <div className="space-y-4">
                <div>
                    <label className="text-xs text-gray-500 uppercase font-bold">
                        Rule Name (Название)
                        <HelpTip text="Give your rule a unique name (e.g., 'Huge Pump')." />
                    </label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Mega Pump 5m"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white mt-1"
                    />
                </div>

                <div>
                    <label className="text-xs text-gray-500 uppercase font-bold">
                        Metric (Параметр)
                        <HelpTip text="Choose which data point to monitor." />
                    </label>
                    <select 
                        value={metric}
                        onChange={e => setMetric(e.target.value as AlertMetric)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white mt-1"
                    >
                        {Object.entries(METRIC_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-2">
                    <div className="w-1/3">
                        <label className="text-xs text-gray-500 uppercase font-bold">
                            Cond (Условие)
                        </label>
                        <select 
                            value={condition}
                            onChange={e => setCondition(e.target.value as 'GT' | 'LT')}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white mt-1 font-mono text-center"
                        >
                            <option value="GT">&gt; (More/Больше)</option>
                            <option value="LT">&lt; (Less/Меньше)</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-xs text-gray-500 uppercase font-bold">
                            Value (Значение)
                        </label>
                        <input 
                            type="number" 
                            value={value}
                            onChange={e => setValue(parseFloat(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white mt-1"
                        />
                    </div>
                </div>

                <button 
                    onClick={handleAdd}
                    disabled={!name}
                    className="w-full bg-solana-purple hover:bg-purple-600 text-white font-bold py-3 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    💾 Save Rule (Сохранить)
                </button>
            </div>
          </div>

          <div className="bg-gray-850 p-6 rounded-xl border border-gray-750">
             <h3 className="text-sm font-bold text-gray-300 uppercase mb-4 flex justify-between">
                 <span>Active Rules (Активные)</span>
                 <span className="text-white bg-gray-700 px-2 rounded-full text-xs">{rules.length}</span>
             </h3>
             <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar">
                {rules.length === 0 && <p className="text-gray-500 text-xs italic text-center py-4">No custom rules defined.</p>}
                {rules.map(rule => (
                    <div key={rule.id} className={`p-3 rounded border flex flex-col gap-2 transition-all ${rule.enabled ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-900/20 border-gray-800 opacity-60'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-bold text-sm text-white flex items-center gap-2">
                                    {rule.name}
                                    {!rule.enabled && <span className="text-[9px] bg-yellow-900/50 text-yellow-500 px-1 rounded uppercase">Paused</span>}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    {METRIC_LABELS[rule.metric]} {rule.condition === 'GT' ? '>' : '<'} <span className="text-solana-green">{rule.value}</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* CONTROLS */}
                        <div className="flex gap-2 mt-1 border-t border-gray-800 pt-2">
                            <button 
                                onClick={() => onToggleRule(rule.id)} 
                                className={`flex-1 text-[10px] font-bold py-1 rounded flex items-center justify-center gap-1 ${rule.enabled ? 'bg-yellow-900/20 text-yellow-500 hover:bg-yellow-900/40' : 'bg-green-900/20 text-green-500 hover:bg-green-900/40'}`}
                            >
                                {rule.enabled ? '⏸️ Pause' : '▶️ Resume'}
                            </button>
                            <button 
                                onClick={() => onDeleteRule(rule.id)} 
                                className="flex-1 text-[10px] font-bold py-1 rounded bg-red-900/20 text-red-400 hover:bg-red-900/40 flex items-center justify-center gap-1"
                            >
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                ))}
             </div>
          </div>
      </div>

      {/* RIGHT COLUMN: ALERT FEED */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-gray-850 p-6 rounded-xl border border-gray-750 flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    🔔 Alert Feed <span className="text-sm text-gray-500">(Лента Уведомлений)</span>
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                    Live stream of triggered events. Deleted tokens do not repeat alerts.
                </p>
            </div>
            <button 
                onClick={onClear}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors border border-gray-700"
            >
                Clear History (Очистить)
            </button>
        </div>

        <div className="grid grid-cols-1 gap-4 overflow-y-auto custom-scrollbar h-[600px]">
            {alerts.length === 0 ? (
                <div className="text-center py-20 bg-gray-900/50 rounded-xl border border-dashed border-gray-800">
                    <div className="text-5xl mb-4 grayscale opacity-50">✅</div>
                    <p className="text-gray-500 text-lg">No alerts detected (Все спокойно).</p>
                </div>
            ) : (
                alerts.map((alert) => (
                    <div 
                        key={alert.id} 
                        className={`
                            relative p-4 rounded-lg border-l-4 shadow-lg flex items-start gap-4 transition-all hover:bg-gray-800/50
                            ${alert.type === 'CUSTOM_RULE' 
                                ? 'bg-purple-900/10 border-l-purple-500 border-y border-r border-purple-900/30'
                                : alert.severity === 'CRITICAL' 
                                    ? 'bg-red-900/10 border-l-red-500 border-y border-r border-red-900/30' 
                                    : 'bg-yellow-900/10 border-l-yellow-500 border-y border-r border-yellow-900/30'}
                        `}
                    >
                        {/* Icon */}
                        <div className="mt-1">
                            {alert.type === 'LOW_LIQUIDITY' && <span className="text-2xl">⚠️</span>}
                            {alert.type === 'RUG_PULL' && <span className="text-2xl">🚨</span>}
                            {alert.type === 'SCAM_RISK' && <span className="text-2xl">💀</span>}
                            {alert.type === 'HIGH_VOLATILITY' && <span className="text-2xl">⚡</span>}
                            {alert.type === 'CUSTOM_RULE' && <span className="text-2xl">⚙️</span>}
                            {alert.type === 'STAGE_FAIL' && <span className="text-2xl">⛔</span>}
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <h3 className={`font-bold text-lg ${
                                    alert.type === 'CUSTOM_RULE' ? 'text-purple-300' :
                                    alert.severity === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'
                                }`}>
                                    {alert.type === 'LOW_LIQUIDITY' ? 'Low Liquidity Pool' : 
                                    alert.type === 'RUG_PULL' ? 'Rug Pull Detected' :
                                    alert.type === 'SCAM_RISK' ? 'Scam Risk Alert' : 
                                    alert.type === 'CUSTOM_RULE' ? 'Custom Rule Trigger' :
                                    alert.type === 'STAGE_FAIL' ? 'Strategy Stage Failed' :
                                    'Volatility Warning'}
                                </h3>
                                <span className="text-xs text-gray-500 font-mono">
                                    {new Date(alert.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            
                            <div className="mt-1 mb-2">
                                <span className="font-bold text-white mr-2">{alert.tokenSymbol}</span>
                                <span className="text-xs text-gray-500 font-mono bg-gray-900 px-1 py-0.5 rounded select-all">{alert.tokenAddress}</span>
                            </div>

                            <p className="text-sm text-gray-300 mb-2">
                                {alert.message}
                            </p>

                            <div className="flex items-center gap-4 text-xs font-mono opacity-80">
                                <span className="bg-black/30 px-2 py-1 rounded">
                                    Val: <span className="text-white font-bold">{alert.value}</span>
                                </span>
                                <a 
                                    href={`https://www.geckoterminal.com/solana/pools/${alert.tokenAddress}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-blue-400 hover:text-blue-300 underline"
                                >
                                    View GeckoTerminal
                                </a>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};
