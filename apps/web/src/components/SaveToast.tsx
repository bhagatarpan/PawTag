import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';

export default function SaveToast({ message, onDone }: { message: string; onDone?: () => void }) {
  const [visible, setVisible] = useState(true);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setHiding(true);
      setTimeout(() => {
        setVisible(false);
        onDone?.();
      }, 300);
    }, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 ${hiding ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
      <CheckCircle size={18} />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
