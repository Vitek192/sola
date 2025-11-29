
import React, { useEffect, useRef } from 'react';
import { SystemLog } from '../types';

interface Props {
  logs: SystemLog[];
}

export const SystemLogs: React.FC<Props> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getColor = (type: SystemLog['type']) => {
    switch(type) {
        case 'INFO': return 'text-blue-400';
        case 'SUCCESS': return 'text-green-400';
        case 'WARNING': return 'text-yellow-400';
        case 'ERROR': return 'text-red-400';
        default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-850 rounded-xl border border-gray-750 p-6 h-[80vh] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🖥️ System Event Log
        </h2>
        <span className="text-xs text-gray-500">Real-time system operations</span>
      </div>

      <div className="flex-1 bg-black/40 rounded-lg p-4 overflow-y-auto font-mono text-xs border border-gray-800 space-y-1 custom-scrollbar">
        {logs.length === 0 && <div className="text-gray-600 italic">System initialized. Waiting for events...</div>}
        
        {logs.map((log) => (
            <div key={log.id} className="flex gap-3 hover:bg-white/5 p-1 rounded">
                <span className="text-gray-600 min-w-[80px]">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                </span>
                <span className={`font-bold min-w-[70px] ${getColor(log.type)}`}>
                    [{log.type}]
                </span>
                <span className="text-gray-300 break-all">
                    {log.message}
                </span>
            </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
