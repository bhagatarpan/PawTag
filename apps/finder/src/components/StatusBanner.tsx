import { ShieldCheck, ShieldAlert, PawPrint } from 'lucide-react';

interface StatusBannerProps {
  status: string;
  tagId: string;
  tagStatus?: string;
}

const statusConfig: Record<string, { bg: string; label: string; subtitle: string; badge: string; badgeBg: string }> = {
  lost: {
    bg: 'bg-red-600',
    label: 'THIS PET IS LOST',
    subtitle: 'If you know this pet, please contact the owner immediately.',
    badge: 'LOST',
    badgeBg: 'bg-red-800 text-red-100',
  },
  found: {
    bg: 'bg-amber-500',
    label: 'PET FOUND',
    subtitle: 'This pet has been reported as found. Please help reunite it with its owner.',
    badge: 'FOUND',
    badgeBg: 'bg-amber-700 text-amber-100',
  },
  safe: {
    bg: 'bg-green-600',
    label: 'Pet Information',
    subtitle: 'This pet is safe and with its owner.',
    badge: 'ACTIVE',
    badgeBg: 'bg-white/20 text-white',
  },
};

export default function StatusBanner({ status, tagId, tagStatus }: StatusBannerProps) {
  const config = statusConfig[status];
  if (!config) return null;

  const ShieldIcon = status === 'lost' ? ShieldAlert : ShieldCheck;

  return (
    <div className={`${config.bg} text-white rounded-xl p-4 mb-6 shadow-lg flex items-center justify-between gap-4`}>
      <div className="flex items-center gap-3">
        <ShieldIcon size={40} className="shrink-0" />
        <div>
          <h1 className="text-xl font-bold leading-tight">{config.label}</h1>
          <p className="text-white/80 text-sm">{config.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <PawPrint size={22} className="text-white/70 shrink-0" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-white/70">Tag:</span>
          <span className="font-mono font-semibold text-sm">{tagId}</span>
        </div>
        {tagStatus && (
          <span className={`ml-1 px-2.5 py-1 text-xs font-bold rounded-full uppercase ${config.badgeBg}`}>
            {tagStatus}
          </span>
        )}
      </div>
    </div>
  );
}
