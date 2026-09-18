export default function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 animate-pulse">
      {/* Left 70% - Cart Items skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-32 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 py-4 border-b border-gray-100">
              <div className="w-24 h-24 bg-gray-200 rounded-lg" />
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="flex justify-between">
                  <div className="h-8 bg-gray-100 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right 30% - Summary skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-32 mb-6" />
        <div className="space-y-3">
          <div className="flex justify-between">
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded w-16" />
          </div>
          <div className="flex justify-between">
            <div className="h-4 bg-gray-100 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-12" />
          </div>
          <div className="border-t border-gray-200 pt-3 mt-3">
            <div className="flex justify-between">
              <div className="h-5 bg-gray-200 rounded w-28" />
              <div className="h-5 bg-gray-300 rounded w-20" />
            </div>
          </div>
        </div>
        <div className="h-12 bg-gray-200 rounded-lg mt-6" />
      </div>
    </div>
  );
}
