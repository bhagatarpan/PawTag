import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';

export default function SaveToast({ message, onDone }: { message: string; onDone?: () => void }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setShow(false); onDone?.(); }, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!show) return null;
  return (
    <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in-right">
      <CheckCircle size={18} />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
