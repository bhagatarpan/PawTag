import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import type { FoundTimerData } from '../types';

interface FoundTimerProps {
  timer: FoundTimerData;
}

export default function FoundTimer({ timer }: FoundTimerProps) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!timer.active || !timer.foundAt) return;
    const update = () => {
      const elapsed = Date.now() - new Date(timer.foundAt!).getTime();
      const hours = Math.floor(elapsed / (1000 * 60 * 60));
      const mins = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((elapsed % (1000 * 60)) / 1000);
      setDisplay(`${hours}h ${mins}m ${secs}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  if (!timer.active) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
      <div className="flex items-center justify-center gap-2 text-blue-700 mb-1">
        <Clock size={18} />
        <span className="font-semibold">Pet Found — Waiting for Owner</span>
      </div>
      <p className="text-2xl font-mono font-bold text-blue-800">{display}</p>
      <p className="text-xs text-blue-600 mt-1">since notification was sent</p>
      {timer.finderName && (
        <p className="text-xs text-blue-500 mt-2">Finder: {timer.finderName}</p>
      )}
    </div>
  );
}
