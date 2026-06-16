export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-gray-100 rounded-xl w-32" />
        <div className="h-6 bg-gray-100 rounded-xl w-24" />
      </div>
      <div className="h-11 bg-gray-100 rounded-xl" />
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-gray-100 rounded-lg w-36" />
              <div className="h-3 bg-gray-100 rounded-lg w-28" />
            </div>
            <div className="h-4 bg-gray-100 rounded-lg w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
