'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts'

const COLORS = ['#2563EB', '#16A34A', '#EAB308', '#DC2626', '#7C3AED', '#0891B2', '#F97316']
const TONES: Record<string, { color: string; bg: string; iconBg: string }> = {
  blue: { color: '#2563EB', bg: '#EFF6FF', iconBg: '#DBEAFE' },
  green: { color: '#16A34A', bg: '#F0FDF4', iconBg: '#DCFCE7' },
  yellow: { color: '#CA8A04', bg: '#FEFCE8', iconBg: '#FEF3C7' },
  red: { color: '#DC2626', bg: '#FEF2F2', iconBg: '#FEE2E2' },
  neutral: { color: '#111827', bg: '#F8FAFC', iconBg: '#E5E7EB' },
}

type Metric = { label: string; value: string | number; hint?: string; tone?: string; icon?: string }
type Series = { key: string; name: string; color?: string }
type ChartSpec = { title: string; description?: string; type?: 'bar' | 'line'; data: any[]; xKey: string; series: Series[]; height?: number }
type DonutSpec = { title: string; description?: string; data: any[]; nameKey: string; valueKey: string; centerLabel?: string; centerValue?: string | number }
type BarsSpec = { title: string; description?: string; data: any[]; labelKey: string; valueKey: string; max?: number }
type SummaryBlock = { title: string; subtitle?: string; items: { label: string; value: string | number; tone?: string; meta?: string }[] }

type Props = {
  title: string
  periodLabel: string
  eyebrow?: string
  description?: string
  metrics: Metric[]
  primaryChart?: ChartSpec
  secondaryChart?: ChartSpec
  donut?: DonutSpec
  bars?: BarsSpec
  progress?: { title: string; description?: string; value: number; done: number; total: number; remainingLabel: string }
  summaries?: SummaryBlock[]
}

const formatTooltipValue = (value: any) => typeof value === 'number' ? value.toLocaleString('pt-BR') : value

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip-label">{label}</div>}
      {payload.map((entry: any, index: number) => (
        <div className="chart-tooltip-row" key={`${entry.name}-${index}`}>
          <span className="chart-dot" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <b>{formatTooltipValue(entry.value)}</b>
        </div>
      ))}
    </div>
  )
}

function MetricCard({ metric }: { metric: Metric }) {
  const tone = TONES[metric.tone || 'neutral'] || TONES.neutral
  return (
    <div className="dash-stat" style={{ ['--stat-color' as any]: tone.color, ['--stat-bg' as any]: tone.bg, ['--stat-icon-bg' as any]: tone.iconBg }}>
      <div>
        <div className="dash-stat-label">{metric.label}</div>
        <div className="dash-stat-value">{metric.value}</div>
        {metric.hint && <div className="dash-stat-hint">{metric.hint}</div>}
      </div>
      <div className="dash-stat-icon"><i className={`ti ${metric.icon || 'ti-chart-bar'}`} /></div>
    </div>
  )
}

function ChartCard({ chart }: { chart: ChartSpec }) {
  const height = chart.height || 250
  const isLine = chart.type === 'line'
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <div>
          <h3>{chart.title}</h3>
          {chart.description && <p>{chart.description}</p>}
        </div>
      </div>
      <div className="dash-chart" style={{ height }}>
        {chart.data.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height="100%">
            {isLine ? (
              <LineChart data={chart.data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey={chart.xKey} tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                {chart.series.map((series, index) => <Line key={series.key} dataKey={series.key} name={series.name} type="monotone" stroke={series.color || COLORS[index % COLORS.length]} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />)}
              </LineChart>
            ) : (
              <BarChart data={chart.data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey={chart.xKey} tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                {chart.series.map((series, index) => <Bar key={series.key} dataKey={series.key} name={series.name} fill={series.color || COLORS[index % COLORS.length]} radius={[8, 8, 0, 0]} maxBarSize={38} />)}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}

function DonutCard({ donut }: { donut: DonutSpec }) {
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <div>
          <h3>{donut.title}</h3>
          {donut.description && <p>{donut.description}</p>}
        </div>
      </div>
      <div className="dash-donut-wrap">
        <div className="dash-donut">
          {donut.data.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut.data} cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={3} dataKey={donut.valueKey} nameKey={donut.nameKey}>
                  {donut.data.map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="dash-donut-center"><b>{donut.centerValue ?? ''}</b><span>{donut.centerLabel ?? ''}</span></div>
        </div>
        <div className="dash-legend">
          {donut.data.slice(0, 7).map((item: any, index: number) => <div className="dash-legend-row" key={`${item[donut.nameKey]}-${index}`}><span style={{ background: COLORS[index % COLORS.length] }} /> <p>{item[donut.nameKey]}</p><b>{item[donut.valueKey]}</b></div>)}
        </div>
      </div>
    </section>
  )
}

function HorizontalBars({ bars }: { bars: BarsSpec }) {
  const max = bars.max || Math.max(1, ...bars.data.map((item: any) => Number(item[bars.valueKey] || 0)))
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <div>
          <h3>{bars.title}</h3>
          {bars.description && <p>{bars.description}</p>}
        </div>
      </div>
      <div className="dash-bars">
        {bars.data.length === 0 ? <EmptyChart /> : bars.data.slice(0, 8).map((item: any, index: number) => {
          const value = Number(item[bars.valueKey] || 0)
          return <div className="dash-bar-row" key={`${item[bars.labelKey]}-${index}`}>
            <div className="dash-bar-info"><span>{item[bars.labelKey]}</span><b>{value}</b></div>
            <div className="dash-bar-track"><div style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: COLORS[index % COLORS.length] }} /></div>
          </div>
        })}
      </div>
    </section>
  )
}

function ProgressCard({ progress }: { progress: NonNullable<Props['progress']> }) {
  const value = Math.max(0, Math.min(100, Math.round(progress.value)))
  return (
    <section className="dash-card progress-card">
      <div className="dash-card-head"><div><h3>{progress.title}</h3>{progress.description && <p>{progress.description}</p>}</div></div>
      <div className="progress-ring" style={{ ['--progress' as any]: `${value * 3.6}deg` }}>
        <div><b>{value}%</b><span>entregue</span></div>
      </div>
      <div className="progress-meta"><div><b>{progress.done}</b><span>concluídas</span></div><div><b>{progress.total}</b><span>total mês</span></div></div>
      <div className="progress-foot">{progress.remainingLabel}</div>
    </section>
  )
}

function Summary({ block }: { block: SummaryBlock }) {
  return (
    <section className="dash-card summary-card">
      <div className="dash-card-head"><div><h3>{block.title}</h3>{block.subtitle && <p>{block.subtitle}</p>}</div></div>
      <div className="summary-list">
        {block.items.length === 0 ? <EmptyChart label="Sem itens para este período" /> : block.items.map((item, index) => {
          const tone = TONES[item.tone || 'neutral'] || TONES.neutral
          return <div className="summary-row" key={`${item.label}-${index}`}><div className="summary-dot" style={{ background: tone.color }} /><div><b>{item.label}</b>{item.meta && <span>{item.meta}</span>}</div><strong>{item.value}</strong></div>
        })}
      </div>
    </section>
  )
}

function EmptyChart({ label = 'Sem dados suficientes' }: { label?: string }) {
  return <div className="dash-empty"><i className="ti ti-chart-dots" />{label}</div>
}

export default function DashboardCharts({ title, periodLabel, eyebrow, description, metrics, primaryChart, secondaryChart, donut, bars, progress, summaries = [] }: Props) {
  return (
    <div className="page-wrap dash-pro-page">
      <div className="dash-pro-head">
        <div>
          {eyebrow && <div className="dash-eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        <div className="dash-period"><i className="ti ti-calendar-stats" />{periodLabel}</div>
      </div>
      <div className="dash-pro-body">
        <div className="dash-stat-grid">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>
        <div className="dash-main-grid">
          {primaryChart && <div className="dash-span-2"><ChartCard chart={primaryChart} /></div>}
          {progress && <ProgressCard progress={progress} />}
          {donut && <DonutCard donut={donut} />}
          {bars && <HorizontalBars bars={bars} />}
          {secondaryChart && <ChartCard chart={secondaryChart} />}
          {summaries.map((block) => <Summary key={block.title} block={block} />)}
        </div>
      </div>
    </div>
  )
}
