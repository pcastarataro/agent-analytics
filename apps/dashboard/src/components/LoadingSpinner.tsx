export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      <span className="ml-3 text-sm text-gray-500">Loading…</span>
    </div>
  );
}
