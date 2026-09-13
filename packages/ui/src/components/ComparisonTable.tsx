import { Check } from 'lucide-react';

export interface ComparisonRow {
  feature: string;
  guardian: string;
  gold: string;
}

interface ComparisonTableProps {
  heading?: string;
  subheading?: string;
  rows: ComparisonRow[];
}

export function ComparisonTable({ heading = 'Guardian vs Gold', subheading, rows }: ComparisonTableProps) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{heading}</h2>
          {subheading && <p className="text-gray-500 text-lg">{subheading}</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Feature</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Guardian</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-amber-600">Gold</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="px-6 py-4 text-sm text-gray-900">{row.feature}</td>
                  <td className="px-6 py-4 text-sm text-center text-gray-600">
                    {row.guardian === '✓' ? <Check size={16} className="text-primary-500 mx-auto" /> : row.guardian}
                  </td>
                  <td className="px-6 py-4 text-sm text-center text-amber-600 font-medium">
                    {row.gold === '✓' ? <Check size={16} className="text-amber-500 mx-auto" /> : row.gold}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
