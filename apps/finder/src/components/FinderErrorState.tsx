import { PawPrint, RefreshCw, WifiOff } from 'lucide-react';

interface FinderErrorStateProps {
  message: string;
  isNetworkError?: boolean;
  onRetry?: () => void;
}

export default function FinderErrorState({ message, isNetworkError = false, onRetry }: FinderErrorStateProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-md p-8 max-w-md text-center">
        {isNetworkError ? (
          <WifiOff size={48} className="text-amber-400 mx-auto mb-4" />
        ) : (
          <PawPrint size={48} className="text-gray-300 mx-auto mb-4" />
        )}
        <h1 className="text-xl font-bold mb-2">
          {isNetworkError ? 'Connection Problem' : 'Tag Not Found'}
        </h1>
        <p className="text-gray-500 mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            <RefreshCw size={18} />
            Try Again
          </button>
        )}
        {!isNetworkError && !onRetry && (
          <p className="text-sm text-gray-400 mt-4">
            If you found a pet wearing this tag, please contact the owner directly if possible.
          </p>
        )}
      </div>
    </div>
  );
}
