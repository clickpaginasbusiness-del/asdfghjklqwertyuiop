export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 bg-gray-100 rounded-xl w-32" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 h-32" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 h-48" />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 h-64" />
    </div>
  )
}
