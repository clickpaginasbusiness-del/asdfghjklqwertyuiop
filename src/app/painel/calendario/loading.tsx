export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-100 rounded-xl w-40" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 w-14 bg-gray-100 rounded-xl shrink-0" />
          ))}
        </div>
        <div className="space-y-2 pt-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-11 bg-gray-50 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
