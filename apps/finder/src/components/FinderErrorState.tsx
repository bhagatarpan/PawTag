import { PawPrint } from 'lucide-react';

interface FinderErrorStateProps {
  message: string;
}

export default function FinderErrorState({ message }: FinderErrorStateProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-md p-8 max-w-md text-center">
        <PawPrint size={48} className="text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Tag Not Found</h1>
        <p className="text-gray-500">{message}</p>
      </div>
    </div>
  );
}
