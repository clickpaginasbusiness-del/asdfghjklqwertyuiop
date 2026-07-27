export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 bg-gray-100 rounded-xl w-48" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="h-5 bg-gray-100 rounded-lg w-20" />
        <div className="h-14 bg-gray-100 rounded-xl" />
        <div className="h-14 bg-gray-100 rounded-xl" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="h-5 bg-gray-100 rounded-lg w-28" />
        <div className="h-14 bg-gray-100 rounded-xl" />
        <div className="h-14 bg-gray-100 rounded-xl" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="h-5 bg-gray-100 rounded-lg w-40" />
        <div className="h-9 bg-gray-100 rounded-xl" />
        <div className="h-9 bg-gray-100 rounded-xl" />
        <div className="h-9 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}
