export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 bg-gray-100 rounded-xl w-40" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100" />
          <div className="space-y-1.5">
            <div className="h-4 bg-gray-100 rounded-lg w-28" />
            <div className="h-3 bg-gray-100 rounded-lg w-16" />
          </div>
        </div>
        <div className="h-16 bg-gray-100 rounded-2xl" />
        <div className="space-y-2 pt-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-100 rounded-lg w-3/4" />
          ))}
        </div>
        <div className="h-10 bg-gray-100 rounded-xl w-44 pt-2" />
      </div>
    </div>
  )
}
