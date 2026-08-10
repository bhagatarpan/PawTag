import { Loader2 } from 'lucide-react';

export default function FinderLoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-primary-600" size={32} />
    </div>
  );
}
