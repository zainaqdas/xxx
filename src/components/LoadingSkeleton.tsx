export function VideoGridSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-video bg-gray-800 rounded-xl" />
          <div className="mt-2 space-y-2">
            <div className="h-3 bg-gray-800 rounded w-full" />
            <div className="h-3 bg-gray-800 rounded w-2/3" />
            <div className="h-2 bg-gray-800 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {children}
    </div>
  );
}
