export function CmsPageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="animate-pulse space-y-4" role="status" aria-busy="true" aria-label="Loading page">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-4/6" />
        </div>
      </div>
    </div>
  );
}
