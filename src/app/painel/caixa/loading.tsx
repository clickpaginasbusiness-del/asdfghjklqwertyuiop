export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 bg-gray-100 rounded-xl w-32" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
        <div className="h-4 bg-gray-100 rounded-lg w-24" />
        <div className="h-9 bg-gray-100 rounded-xl w-40" />
        <div className="h-10 bg-gray-100 rounded-xl w-36" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 bg-gray-100 rounded-2xl" />
        <div className="h-24 bg-gray-100 rounded-2xl" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 p-4">
            <div className="space-y-2">
              <div className="h-3.5 bg-gray-100 rounded-lg w-28" />
              <div className="h-3 bg-gray-100 rounded-lg w-20" />
            </div>
            <div className="h-4 bg-gray-100 rounded-lg w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
