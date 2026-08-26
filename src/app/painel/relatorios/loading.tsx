export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded-xl w-24" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100" />
            <div className="h-7 bg-gray-100 rounded-lg w-16" />
            <div className="h-3 bg-gray-100 rounded-lg w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 h-64" />
        <div className="bg-white rounded-2xl border border-gray-100 p-6 h-64" />
      </div>
    </div>
  )
}
