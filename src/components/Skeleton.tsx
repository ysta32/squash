const TITLE_WIDTHS = ['w-3/5', 'w-2/5', 'w-1/2', 'w-2/3', 'w-1/3', 'w-[45%]']

export function Skeleton() {
  return (
    <div role="status" aria-label="Loading bugs" className="space-y-px p-1.5">
      <span className="sr-only">Loading bugs…</span>
      {TITLE_WIDTHS.map((width, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex h-11 animate-pulse items-center gap-2.5 rounded-md pl-3 pr-2.5 motion-reduce:animate-none"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <span className="flex w-3 justify-center">
            <span className="h-2 w-2 rounded-full bg-fg/[0.07]" />
          </span>
          <span className="h-2.5 w-7 rounded-sm bg-fg/[0.07]" />
          <span className="min-w-0 flex-1">
            <span className={`block h-2.5 rounded-sm bg-fg/[0.07] ${width}`} />
          </span>
          <span className="h-2.5 w-8 rounded-sm bg-fg/[0.07]" />
          <span className="h-5 w-5 rounded-full bg-fg/[0.07]" />
        </div>
      ))}
    </div>
  )
}
