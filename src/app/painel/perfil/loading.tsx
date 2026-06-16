export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 bg-gray-100 rounded-xl w-36" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gray-100 shrink-0" />
          <div className="space-y-2">
            <div className="h-9 bg-gray-100 rounded-xl w-32" />
            <div className="h-3 bg-gray-100 rounded-lg w-28" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="h-5 bg-gray-100 rounded-lg w-32" />
        <div className="h-11 bg-gray-100 rounded-xl" />
        <div className="h-11 bg-gray-100 rounded-xl" />
        <div className="h-24 bg-gray-100 rounded-xl" />
        <div className="h-10 bg-gray-100 rounded-xl w-32" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="h-5 bg-gray-100 rounded-lg w-24" />
        <div className="h-11 bg-gray-100 rounded-xl" />
        <div className="h-11 bg-gray-100 rounded-xl" />
        <div className="h-11 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}
