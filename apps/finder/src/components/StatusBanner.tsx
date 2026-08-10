import { ShieldAlert, ShieldCheck, Heart } from 'lucide-react';

interface StatusBannerProps {
  status: string;
}

export default function StatusBanner({ status }: StatusBannerProps) {
  if (status === 'lost') {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-red-600 via-red-500 to-red-700 text-white rounded-2xl p-5 mb-4 shadow-xl shadow-red-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%221%22%20cy%3D%221%22%20r%3D%221%22%20fill%3D%22rgba(255%2C255%2C255%2C0.1)%22%2F%3E%3C%2Fsvg%3E')] opacity-50" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center animate-pulse">
            <ShieldAlert size={28} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight">LOST PET</h1>
            <p className="text-red-100 text-sm mt-0.5">Contact owner immediately or use options below</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'found') {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-amber-400 to-amber-500 text-white rounded-2xl p-5 mb-4 shadow-xl shadow-amber-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%221%22%20cy%3D%221%22%20r%3D%221%22%20fill%3D%22rgba(255%2C255%2C255%2C0.1)%22%2F%3E%3C%2Fsvg%3E')] opacity-50" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <ShieldCheck size={28} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight">PET FOUND</h1>
            <p className="text-amber-100 text-sm mt-0.5">Help reunite this pet with its owner</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'safe') {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-400 to-emerald-500 text-white rounded-2xl p-5 mb-4 shadow-xl shadow-emerald-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%221%22%20cy%3D%221%22%20r%3D%221%22%20fill%3D%22rgba(255%2C255%2C255%2C0.1)%22%2F%3E%3C%2Fsvg%3E')] opacity-50" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Heart size={28} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold tracking-tight">SAFE & SOUND</h1>
            <p className="text-emerald-100 text-sm mt-0.5">This pet is safe with its owner</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
