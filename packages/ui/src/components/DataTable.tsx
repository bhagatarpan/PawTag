import React from 'react';
import { AlertCircle, Search } from 'lucide-react';
import type { DataTableProps } from '../types';

function SkeletonRow({ colSpan }: { colSpan: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: colSpan }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  onRetry,
  onRowClick,
  emptyMessage = 'No items found',
  emptyIcon,
  getKey,
  skeletonCount = 5,
}: DataTableProps<T>) {
  const colSpan = columns.length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider ${
                    col.hideOnSmall ? 'hidden lg:table-cell' : ''
                  } ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: skeletonCount }).map((_, i) => (
                <SkeletonRow key={i} colSpan={colSpan} />
              ))
            ) : error ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertCircle size={20} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{error}</p>
                    </div>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="text-sm text-primary-600 hover:underline"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      {emptyIcon || <Search size={20} className="text-gray-400" />}
                    </div>
                    <p className="text-sm font-medium text-gray-700">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={getKey(item)}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={`transition-colors ${
                    onRowClick ? 'hover:bg-gray-50 cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${
                        col.hideOnSmall ? 'hidden lg:table-cell' : ''
                      } ${col.className || ''}`}
                    >
                      {col.render(item, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
