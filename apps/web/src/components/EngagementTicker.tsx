import { useEffect, useState } from 'react';
import { PawPrint, Heart } from 'lucide-react';
import api from '../lib/api';

interface TickerStat {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
}

interface StatsData {
  petsProtected: number;
  tagsSold: number;
  reunions: number;
  registeredUsers: number;
}

const fallbackStats: TickerStat[] = [
  { label: 'pets protected', value: 14231 },
  { label: 'reunited today', value: 42 },
  { label: 'tags sold', value: 6840 },
];

function useAnimatedCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return count;
}

function TickerItem({ stat }: { stat: TickerStat }) {
  const count = useAnimatedCounter(stat.value);
  const formatted = count.toLocaleString();

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-white font-bold text-sm">{stat.prefix}{formatted}</span>
      <span className="text-white/70 text-sm">{stat.label}</span>
    </div>
  );
}

export default function EngagementTicker() {
  const [stats, setStats] = useState<TickerStat[]>(fallbackStats);

  useEffect(() => {
    api.get('/finder/stats')
      .then((res) => {
        const d: StatsData = res.data.data;
        setStats([
          { label: 'pets protected', value: d.petsProtected || 14231 },
          { label: 'tags sold', value: d.tagsSold || 6840 },
          { label: 'reunions', value: d.reunions || 1247 },
        ]);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-teal-700 border-y border-teal-600">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-6 md:gap-10 flex-wrap">
          <div className="flex items-center gap-2 text-teal-200">
            <PawPrint size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">Live</span>
          </div>
          {stats.map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-6 md:gap-10">
              {i > 0 && <div className="w-px h-4 bg-white/20 hidden md:block" />}
              <TickerItem stat={stat} />
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-teal-200">
            <Heart size={14} className="animate-pulse" fill="currentColor" />
            <span className="text-xs font-medium">Real-time</span>
          </div>
        </div>
      </div>
    </div>
  );
}
