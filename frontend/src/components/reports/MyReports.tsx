import { useEffect, useState, type ReactNode } from 'react'
import {
  errorMessage,
  listMyReports,
  type MyReportItem,
  type MyReportResponse,
  type ReportStatus,
} from '../../lib/api'
import { useAccessToken } from '../../lib/useAccessToken'
import { ThemeToggle } from '../ThemeToggle'
import {
  ArrowRightIcon,
  CheckIcon,
  RetryIcon,
  ShieldIcon,
  TagMark,
} from '../chat/icons'

const PAGE_SIZE = 20

type FilterValue = ReportStatus | 'all'

const filters: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'pending_evidence', label: 'Pending evidence' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'rejected', label: 'Rejected' },
]

const statusMeta: Record<
  ReportStatus,
  { label: string; chip: string; detail: string; showReason: boolean }
> = {
  accepted: {
    label: 'Accepted',
    chip: 'bg-accent-soft text-accent-text',
    detail: 'Counts toward price estimates',
    showReason: false,
  },
  pending_evidence: {
    label: 'Pending evidence',
    chip: 'bg-active text-muted',
    detail: 'Waiting for more history',
    showReason: true,
  },
  flagged: {
    label: 'Flagged',
    chip: 'bg-inset text-negative',
    detail: 'Waiting for a reviewer',
    showReason: true,
  },
  rejected: {
    label: 'Rejected',
    chip: 'bg-inset text-negative',
    detail: 'Not used in estimates',
    showReason: false,
  },
}

function materialLabel(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatMoney(value: number, currency: string): string {
  const amount = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(value)
  return currency === 'PKR' ? `Rs ${amount}` : `${currency} ${amount}`
}

function formatQuantity(value: number): string {
  return `${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 3 }).format(value)} kg`
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Not recorded'
  }
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) {
    return 'Not recorded'
  }
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

function locationLabel(report: MyReportItem): string {
  return [report.area, report.city].filter(Boolean).join(', ') || 'Location not recorded'
}

function anomalyMethodLabel(method: string): string {
  const normalized = method.trim().toLowerCase()
  if (normalized === 'mad') {
    return 'Median/MAD statistical check'
  }
  if (normalized === 'validation') {
    return 'Intake validation'
  }
  return method
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <TagMark className="h-5 w-5 text-ink" />
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">ScrapSense</span>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="clay-card p-5">
          <div className="h-4 w-28 rounded-sm bg-active" />
          <div className="mt-3 h-3 w-48 rounded-sm bg-rule" />
          <div className="mt-5 h-14 w-full rounded-[14px] bg-active" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="clay-card px-6 py-10 text-center">
      <div className="clay-icon-chip mx-auto flex h-10 w-10 items-center justify-center text-accent-text">
        <CheckIcon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.015em] text-ink">
        {filtered ? 'No reports match this filter' : 'No reports yet'}
      </h2>
      <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-6 text-muted">
        {filtered
          ? 'Try another status, or clear the filter to see everything you have reported.'
          : 'Tell ScrapSense what you sold in the chat. Each finished report will appear here.'}
      </p>
      <a
        href="/"
        className="clay-button clay-button-primary mt-5 inline-flex h-11 items-center gap-2 px-4 text-[13px] font-medium text-on-solid"
      >
        Open the chat
        <ArrowRightIcon className="h-4 w-4" />
      </a>
    </div>
  )
}

function ReportCard({ report }: { report: MyReportItem }) {
  const meta = statusMeta[report.status]
  return (
    <article className="clay-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">
              {materialLabel(report.material)}
            </h2>
            <span className={`clay-chip px-2.5 py-1 text-[11px] font-medium ${meta.chip}`}>
              {meta.label}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-5 text-muted">
            {locationLabel(report)}
            {' · '}
            Reported {formatTimestamp(report.observed_at ?? report.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[18px] font-medium leading-6 text-accent-text">
            {formatMoney(report.price_per_kg, report.currency)}
            <span className="text-[12px] text-muted"> / kg</span>
          </p>
          <p className="mt-0.5 text-[12px] leading-5 text-muted">
            {formatQuantity(report.quantity_kg)}
          </p>
        </div>
      </div>

      {meta.showReason && report.anomaly_reason ? (
        <div className="clay-inset mt-4 px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            {anomalyMethodLabel(report.anomaly_method)}
          </p>
          <p className="mt-1.5 text-[13px] leading-6 text-ink">{report.anomaly_reason}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-5 text-muted">
          Submitted {formatTimestamp(report.created_at)}
        </p>
        <p className="text-[11px] leading-5 text-muted">{meta.detail}</p>
      </div>
    </article>
  )
}

interface MyReportsProps {
  accountSlot?: ReactNode
}

export function MyReports({ accountSlot }: MyReportsProps) {
  const getToken = useAccessToken()
  const [filter, setFilter] = useState<FilterValue>('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<MyReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const token = await getToken()
        const response = await listMyReports(token, {
          status: filter === 'all' ? undefined : filter,
          page,
          pageSize: PAGE_SIZE,
        })
        if (!cancelled) {
          setData(response)
          setError(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(errorMessage(loadError))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filter, getToken, page, refreshKey])

  function changeFilter(value: FilterValue) {
    if (value === filter && page === 1) {
      return
    }
    setLoading(true)
    setError(null)
    setPage(1)
    setFilter(value)
  }

  function changePage(nextPage: number) {
    setLoading(true)
    setError(null)
    setPage(nextPage)
  }

  function reload() {
    setLoading(true)
    setError(null)
    setRefreshKey((current) => current + 1)
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 0

  return (
    <div className="min-h-svh bg-ground">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-8 px-5 py-5 sm:px-6">
        <a href="/" aria-label="ScrapSense chat">
          <Wordmark />
        </a>
        <div className="flex items-center gap-2">
          <a
            href="/"
            className="clay-button clay-button-secondary hidden h-11 items-center gap-2 px-4 text-[13px] font-medium text-ink sm:inline-flex sm:h-9 sm:px-3.5"
          >
            Back to chat
            <ArrowRightIcon className="h-4 w-4 rotate-180" />
          </a>
          {accountSlot}
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] px-5 pb-16 pt-2 sm:px-6 lg:pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-muted">
              <ShieldIcon className="h-3.5 w-3.5" />
              Your ledger
            </p>
            <h1 className="mt-2 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[36px]">
              My reports
            </h1>
            <p className="mt-2 max-w-[62ch] text-[13px] leading-6 text-muted sm:text-[14px]">
              Every sale you have told ScrapSense about. Accepted reports can support price
              estimates; flagged or pending reports stay out until they are reviewed.
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="clay-button clay-button-secondary flex h-11 items-center gap-2 px-4 text-[13px] font-medium text-ink sm:h-9"
          >
            <RetryIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter reports by status">
          {filters.map((option) => {
            const active = option.value === filter
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => changeFilter(option.value)}
                aria-pressed={active}
                disabled={loading}
                className={`clay-button h-9 px-3 text-[12px] font-medium ${
                  active
                    ? 'clay-button-primary text-on-solid'
                    : 'clay-button-secondary text-ink'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <div className="mt-4 space-y-3">
          {error ? (
            <div role="alert" className="clay-card mx-auto mt-4 max-w-[560px] p-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">
                Your reports could not be loaded
              </h2>
              <p className="mt-2 text-[13px] leading-6 text-muted">{error}</p>
              <button
                type="button"
                onClick={reload}
                className="clay-button clay-button-primary mt-5 inline-flex h-11 items-center gap-2 px-4 text-[13px] font-medium text-on-solid"
              >
                <RetryIcon className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : loading && !data ? (
            <ReportSkeleton />
          ) : items.length === 0 ? (
            <EmptyState filtered={filter !== 'all'} />
          ) : (
            <div className="space-y-3" aria-busy={loading || undefined}>
              {items.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          )}

          {!error && data ? (
            <nav
              aria-label="My report pages"
              className="flex flex-wrap items-center justify-between gap-3 pt-2"
            >
              <p className="text-[12px] leading-5 text-muted" aria-live="polite">
                {total} {total === 1 ? 'report' : 'reports'}
                {pages > 0 ? ` · Page ${Math.min(page, pages)} of ${pages}` : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => changePage(Math.max(1, page - 1))}
                  disabled={loading || page <= 1}
                  className="clay-button clay-button-secondary h-11 px-4 text-[13px] font-medium text-ink sm:h-9"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => changePage(page + 1)}
                  disabled={loading || !data.has_more}
                  className="clay-button clay-button-secondary h-11 px-4 text-[13px] font-medium text-ink sm:h-9"
                >
                  Next
                </button>
              </div>
            </nav>
          ) : null}
        </div>
      </main>
    </div>
  )
}
