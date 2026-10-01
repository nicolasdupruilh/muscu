// Courbe simple en SVG : une ou deux séries dans le temps, un seul axe, réticule et infobulle au toucher.
import { useLayoutEffect, useRef, useState } from 'react'

export interface ChartPoint {
  /** Instant, en millisecondes. */
  x: number
  y: number
  /** Détail affiché dans l'infobulle (« 30 kg × 10 »…). */
  detail?: string
}

export interface ChartSeries {
  id: string
  label: string
  /** Variable CSS de la couleur de série (« --series-1 »). */
  color: string
  points: ChartPoint[]
}

const PAD = { top: 12, right: 16, bottom: 26, left: 36 }
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min]
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

export function LineChart({
  series,
  yDomain,
  yFormat = (v) => v.toLocaleString('fr-FR'),
  height = 200,
  refLines = [],
  yTicks,
}: {
  series: ChartSeries[]
  /** Échelle fixe (ex. 0 à 10 pour la douleur) ; sinon calculée sur les données. */
  yDomain?: [number, number]
  yFormat?: (v: number) => string
  height?: number
  /** Repères horizontaux discrets (ex. seuils vert / orange). */
  refLines?: { y: number; label: string }[]
  /** Graduations imposées (ex. 0, 2, 4… pour une note sur 10). */
  yTicks?: number[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [hover, setHover] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const all = series.flatMap((s) => s.points)
  if (all.length === 0) return <p className="muted">Pas encore de données.</p>

  const xs = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b)
  const [x0, x1] = [xs[0], xs[xs.length - 1]]
  let [y0, y1] = yDomain ?? [Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y))]
  if (!yDomain) {
    // Un peu d'air au-dessus et au-dessous, sans descendre sous zéro.
    const pad = (y1 - y0) * 0.15 || Math.max(1, y1 * 0.1)
    ;[y0, y1] = [Math.max(0, y0 - pad), y1 + pad]
  }
  const ticks = yTicks ?? niceTicks(y0, y1)
  const innerW = width - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const sx = (x: number) => PAD.left + (x1 === x0 ? innerW / 2 : ((x - x0) / (x1 - x0)) * innerW)
  const sy = (y: number) => PAD.top + innerH - ((y - y0) / (y1 - y0 || 1)) * innerH

  // Dates en bas : première, dernière, et celle du milieu seulement si elle a la place.
  const mid = xs[Math.floor(xs.length / 2)]
  const roomy = (x: number) => Math.abs(sx(x) - sx(x0)) > 70 && Math.abs(sx(x1) - sx(x)) > 70
  const xLabels = xs.length === 1 ? [x0] : sx(x1) - sx(x0) < 70 ? [x1] : xs.length > 2 && roomy(mid) ? [x0, mid, x1] : [x0, x1]
  const hoverX = hover !== null ? xs[hover] : undefined

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    let best = 0
    xs.forEach((x, i) => {
      if (Math.abs(sx(x) - px) < Math.abs(sx(xs[best]) - px)) best = i
    })
    setHover(best)
  }

  return (
    <div className="chart" ref={ref}>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.id}>
              <span className="chart-key" style={{ background: `var(${s.color})` }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={series.map((s) => s.label).join(', ')}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} />
            <text className="chart-axis" x={PAD.left - 6} y={sy(t)} dy="0.32em" textAnchor="end">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {refLines.map((r) => (
          <g key={r.label}>
            <line className="chart-ref" x1={PAD.left} x2={width - PAD.right} y1={sy(r.y)} y2={sy(r.y)} />
            <text className="chart-axis" x={width - PAD.right} y={sy(r.y) - 4} textAnchor="end">
              {r.label}
            </text>
          </g>
        ))}
        {xLabels.map((x, i) => (
          <text
            key={x}
            className="chart-axis"
            x={sx(x)}
            y={height - 8}
            textAnchor={xLabels.length === 1 ? (xs.length === 1 ? 'middle' : 'end') : i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
          >
            {shortDate.format(new Date(x))}
          </text>
        ))}
        {hoverX !== undefined && <line className="chart-cross" x1={sx(hoverX)} x2={sx(hoverX)} y1={PAD.top} y2={PAD.top + innerH} />}
        {series.map((s) => (
          <g key={s.id} style={{ color: `var(${s.color})` }}>
            {s.points.length > 1 && (
              <polyline className="chart-line" points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} />
            )}
            {s.points.map((p) => (
              <circle key={p.x} className="chart-dot" cx={sx(p.x)} cy={sy(p.y)} r={p.x === hoverX ? 6 : 4} />
            ))}
          </g>
        ))}
      </svg>
      {hoverX !== undefined && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(sx(hoverX), 70), width - 70) }}>
          <div className="small muted">{shortDate.format(new Date(hoverX))}</div>
          {series.map((s) => {
            const p = s.points.find((q) => q.x === hoverX)
            return (
              p && (
                <div key={s.id}>
                  {series.length > 1 && <span className="chart-key" style={{ background: `var(${s.color})` }} />}
                  <strong>{yFormat(p.y)}</strong>
                  {p.detail && <span className="muted"> · {p.detail}</span>}
                  {series.length > 1 && <span className="muted"> {s.label.toLowerCase()}</span>}
                </div>
              )
            )
          })}
        </div>
      )}
    </div>
  )
}
