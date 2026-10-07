export function Skeleton() {
  return (
    <div role="status" aria-label="Loading bugs" className="space-y-1 p-2">
      <style>{`@keyframes bug-list-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }`}</style>
      <span className="sr-only">Loading bugs…</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="relative flex min-h-14 items-center gap-3 overflow-hidden rounded-md px-3 py-2"
        >
          <span className="pointer-events-none absolute inset-0 animate-[bug-list-shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-muted/10 to-transparent motion-reduce:animate-none" />
          <span className="h-2 w-2 rounded-full bg-bg-subtle" />
          <span className="h-3 w-8 rounded bg-bg-subtle" />
          <span className="h-3 flex-1 rounded bg-bg-subtle" />
          <span className="h-5 w-5 rounded-full bg-bg-subtle" />
          <span className="h-3 w-6 rounded bg-bg-subtle" />
        </div>
      ))}
    </div>
  )
}
