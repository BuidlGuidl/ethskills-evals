import Link from 'next/link'
import { browseTools, type BrowseSort } from '@/server/tools'
import { TrackRecordBadge } from '@/components/TrackRecordBadge'
import { usdcLabel, relativeTime } from '@/ui/format'

export const dynamic = 'force-dynamic'

/**
 * Browse.
 *
 * Default order is by the owner's track record, computed offchain from settled
 * loans. The association's rule is that the people who keep the library working
 * are the ones you see first.
 */
export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string }>
}) {
  const { sort, q } = await searchParams
  const active: BrowseSort = sort === 'newest' ? 'newest' : 'reliability'
  const tools = browseTools({ sort: active, query: q })

  return (
    <>
      <h1>The shed</h1>
      <p className="muted">
        {tools.length} tool{tools.length === 1 ? '' : 's'} listed by your neighbours. Put down a
        USDC deposit to borrow one; you get it back when you return it, minus the daily late fee if
        it is late.
      </p>

      <form className="row" style={{ marginTop: 16 }}>
        <label className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted">Search</span>
          <input name="q" defaultValue={q ?? ''} placeholder="saw, ladder, wheelbarrow…" />
        </label>
        <input type="hidden" name="sort" value={active} />
        <button type="submit" className="ghost">
          Search
        </button>
      </form>

      <p className="muted" style={{ marginTop: 12 }}>
        Sorted by{' '}
        {active === 'reliability' ? (
          <>
            <strong>owner track record</strong> · <Link href="/?sort=newest">newest first</Link>
          </>
        ) : (
          <>
            <strong>newest</strong> · <Link href="/?sort=reliability">track record</Link>
          </>
        )}
      </p>

      <div className="grid">
        {tools.map((tool) => (
          <Link key={tool.uuid} href={`/tools/${tool.uuid}`} className="tool-card">
            {tool.photoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/photos/${tool.photoKey}`} alt={tool.title} />
            ) : (
              <div className="nophoto">no photo</div>
            )}
            <div className="body">
              <h3>{tool.title}</h3>
              <TrackRecordBadge record={tool.owner} />
              <span className="muted">
                {usdcLabel(tool.deposit)} deposit · {usdcLabel(tool.lateFeePerDay)}/day late
              </span>
              {tool.activeLoanId ? (
                <span className="pill">
                  out · due {relativeTime(tool.activeLoanDueAt ?? 0)}
                </span>
              ) : (
                <span className="pill">available</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {tools.length === 0 ? (
        <p className="muted">
          Nothing listed yet. <Link href="/tools/new">List the first tool.</Link>
        </p>
      ) : null}
    </>
  )
}
