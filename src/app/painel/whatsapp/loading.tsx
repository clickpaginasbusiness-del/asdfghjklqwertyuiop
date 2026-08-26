export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 bg-gray-100 rounded-xl w-44" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="h-5 bg-gray-100 rounded-lg w-32" />
        <div className="h-24 bg-gray-100 rounded-xl" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="h-5 bg-gray-100 rounded-lg w-40" />
        <div className="h-24 bg-gray-100 rounded-xl" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="h-5 bg-gray-100 rounded-lg w-36" />
        <div className="h-24 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}
