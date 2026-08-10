import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface StatusBannerProps {
  status: string;
}

export default function StatusBanner({ status }: StatusBannerProps) {
  if (status === 'lost') {
    return (
      <div className="bg-red-600 text-white rounded-xl p-6 mb-6 text-center shadow-lg animate-pulse">
        <ShieldAlert size={56} className="mx-auto mb-2" />
        <h1 className="text-4xl font-extrabold tracking-wide">THIS PET IS LOST</h1>
        <p className="text-red-100 text-base mt-2">If you know this pet, please contact the owner immediately or use the options below.</p>
      </div>
    );
  }

  if (status === 'found') {
    return (
      <div className="bg-amber-500 text-white rounded-xl p-6 mb-6 text-center shadow-lg">
        <ShieldCheck size={56} className="mx-auto mb-2" />
        <h1 className="text-4xl font-extrabold tracking-wide">PET FOUND</h1>
        <p className="text-amber-100 text-base mt-2">This pet has been reported as found. Please help reunite it with its owner.</p>
      </div>
    );
  }

  if (status === 'safe') {
    return (
      <div className="bg-green-600 text-white rounded-xl p-6 mb-6 text-center shadow-lg">
        <ShieldCheck size={56} className="mx-auto mb-2" />
        <h1 className="text-3xl font-bold">Pet Information</h1>
        <p className="text-green-100 text-base mt-1">This pet is safe and with its owner.</p>
      </div>
    );
  }

  return null;
}
