import { cn } from '../../lib/utils'
import { MK_CONTAINER } from '../marketing/MarketingLayout'
import { Reveal } from '../marketing/Reveal'
import { FILED_FIELDS } from './content'
import { Band, EntryHead } from './Section'

/**
 * The same bug side by side: what survives a chat channel, and what Squash writes down. One
 * table rather than two panels, so the empty column is read as the point.
 */
function Comparison() {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">
        The fields of bug 24 as a chat message carries them, and as Squash records them
      </caption>
      <thead>
        <tr className="border-b border-line-2">
          <th scope="col" className="lp-mono w-[7rem] pb-3">
            field
          </th>
          <th scope="col" className="lp-mono w-[12rem] pb-3">
            in the channel
          </th>
          <th scope="col" className="lp-mono pb-3 text-ink">
            in squash
          </th>
        </tr>
      </thead>
      <tbody>
        {FILED_FIELDS.map((field) => (
          <tr key={field.term} className="border-b border-line align-top">
            <th scope="row" className="py-4 pr-6 font-mono text-sm font-normal text-ink-3">
              {field.term}
            </th>
            <td className="py-4 pr-6 font-mono text-sm text-ink-3">
              <span className="text-markup">—</span> not recorded
            </td>
            <td className="py-4 font-mono text-sm text-ink">{field.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Why the record on the stage exists at all: the version of it that lives in a chat channel. */
export function Problem() {
  return (
    <Band labelledBy="problem-heading">
      <div className={cn(MK_CONTAINER, 'grid gap-12 lg:grid-cols-12 lg:gap-12')}>
        <Reveal className="lg:col-span-5">
          <EntryHead
            id="problem-heading"
            mark="why bug 24 was filed twice"
            title="A screenshot in a channel is not a bug report."
          >
            <p>
              It arrives without the page, the device or the steps. By tomorrow it has scrolled
              away, and nobody can say who took it or whether it was ever fixed.
            </p>
          </EntryHead>
          <figure className="mt-10 max-w-[22rem]">
            <blockquote className="border-l-2 border-markup pl-4 font-mono text-sm leading-6 text-ink-2">
              IMG_4471.PNG
              <br />
              “is this just me?”
            </blockquote>
            <figcaption className="lp-mono mt-3">posted 14:02, nothing else attached</figcaption>
          </figure>
        </Reveal>
        <Reveal delay={80} className="lg:col-span-7">
          <Comparison />
        </Reveal>
      </div>
    </Band>
  )
}
