export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 bg-gray-100 rounded-xl w-40" />
      <div className="h-3 bg-gray-100 rounded-lg w-full" />
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="w-5 h-5 rounded-full bg-gray-100 shrink-0" />
            <div className="h-3.5 bg-gray-100 rounded-lg flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}
