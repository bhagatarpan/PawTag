import { PawPrint } from 'lucide-react';

interface TagInfoHeaderProps {
  tagId: string;
  tagStatus?: string;
}

export default function TagInfoHeader({ tagId, tagStatus }: TagInfoHeaderProps) {
  return (
    <div className="text-center mb-4">
      <PawPrint size={28} className="text-primary-600 mx-auto mb-1" />
      <p className="text-sm text-gray-500">
        Tag: <span className="font-mono font-medium">{tagId}</span>
        {tagStatus && (
          <span className={`ml-2 inline-block px-2 py-0.5 text-xs font-bold rounded-full ${
            tagStatus === 'active' ? 'bg-green-100 text-green-700' :
            tagStatus === 'lost' ? 'bg-red-200 text-red-800' :
            'bg-gray-200 text-gray-700'
          }`}>{tagStatus.toUpperCase()}</span>
        )}
      </p>
    </div>
  );
}
