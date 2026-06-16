export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 bg-gray-100 rounded-xl w-48" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-6 bg-gray-100 rounded-full" />
            <div className="h-4 bg-gray-100 rounded-lg w-12" />
            <div className="h-9 bg-gray-100 rounded-xl w-24" />
            <div className="h-4 bg-gray-100 rounded-lg w-6" />
            <div className="h-9 bg-gray-100 rounded-xl w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
