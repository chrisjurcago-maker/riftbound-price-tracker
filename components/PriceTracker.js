'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  gold:    '#C9A84C',
  dark:    '#1A1A2E',
  mid:     '#16213E',
  accent:  '#0F3460',
  green:   '#2ECC71',
  orange:  '#E67E22',
  red:     '#E74C3C',
  gray:    '#95A5A6',
  white:   '#FFFFFF',
  row1:    '#12122a',
  row2:    '#0f0f22',
  rowSel:  '#1a2a4a',
}

const SETS       = ['All Sets', 'Origins', 'Spiritforged', 'Special']
const CATEGORIES = ['All Categories', 'Booster Box', 'Booster Pack', 'Champion Deck',
                    'Starter Box', 'Playmat', 'Card Sleeves', 'Limited Bundle']
const WINDOWS    = [
  { label: '1 Day',    months: null },
  { label: '1 Week',   months: null },
  { label: '1 Month',  months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPricesForWindow(priceHistory, allLabels, windowMonths) {
  const sliced = windowMonths === null ? allLabels.slice(-2) : allLabels.slice(-windowMonths)
  return sliced.map(label => {
    const row = priceHistory.find(r => r.month_label === label)
    return { month: label, price: row?.market_price ?? null }
  })
}

function getTrend(priceHistory, allLabels, windowMonths) {
  if (windowMonths === null) return null
  // Slice one extra month back so we always have a "from" point to compare against.
  // e.g. "1 Month" compares previous month → current month.
  const sliced = allLabels.slice(-(windowMonths + 1))
  const data = sliced
    .map(label => {
      const row = priceHistory.find(r => r.month_label === label)
      return { month: label, price: row?.market_price ?? null }
    })
    .filter(d => d.price !== null)
  if (data.length < 2) return null
  const first = data[0].price
  const last  = data[data.length - 1].price
  return ((last - first) / first) * 100
}

function latestPrice(priceHistory) {
  const sorted = [...priceHistory].filter(r => r.market_price !== null)
    .sort((a, b) => new Date(b.month_date) - new Date(a.month_date))
  return sorted[0]?.market_price ?? null
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────
function TrendBadge({ pct }) {
  if (pct === null) return <span style={{ color: C.gray, fontSize: 11 }}>—</span>
  const up    = pct >  2
  const down  = pct < -2
  const color = up ? C.green : down ? C.red : C.orange
  const arrow = up ? '▲' : down ? '▼' : '►'
  return (
    <span style={{ color, fontWeight: 700, fontSize: 12 }}>
      {arrow} {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function StatusBadge({ status }) {
  const bg = status === 'RELEASED' ? C.green : status === 'RELEASED*' ? C.orange : C.gray
  return (
    <span style={{
      background: bg, color: C.white, borderRadius: 4,
      padding: '2px 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{status}</span>
  )
}

function CustomTooltip({ active, payload, label, msrp }) {
  if (!active || !payload?.length) return null
  const val     = payload[0].value
  const premium = val && msrp ? (((val - msrp) / msrp) * 100).toFixed(1) : null
  return (
    <div style={{
      background: C.mid, border: `1px solid ${C.gold}`, borderRadius: 8,
      padding: '10px 14px', color: C.white, fontSize: 13,
    }}>
      <div style={{ color: C.gold, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div>Market: <strong>${Number(val).toFixed(2)}</strong></div>
      <div style={{ color: C.gray, fontSize: 11 }}>MSRP: ${msrp}</div>
      {premium !== null && (
        <div style={{ color: parseFloat(premium) > 0 ? C.green : C.red, fontSize: 11 }}>
          {parseFloat(premium) > 0 ? '+' : ''}{premium}% vs MSRP
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PriceTracker({ products, monthLabels }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [windowIdx,  setWindowIdx]  = useState(4)
  const [filterSet,  setFilterSet]  = useState('All Sets')
  const [filterCat,  setFilterCat]  = useState('All Categories')
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState(null)
  const [sortCol,    setSortCol]    = useState('name')
  const [sortDir,    setSortDir]    = useState(1)

  const windowMonths   = WINDOWS[windowIdx].months
  const isSubMonthly   = windowMonths === null

  // ── filtered + sorted rows ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return products
      .filter(p => {
        if (filterSet !== 'All Sets' && p.set_name !== filterSet) return false
        if (filterCat !== 'All Categories' && p.category !== filterCat) return false
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        if (sortCol === 'name')   return sortDir * a.name.localeCompare(b.name)
        if (sortCol === 'msrp')   return sortDir * (a.msrp - b.msrp)
        if (sortCol === 'market') return sortDir * ((latestPrice(a.priceHistory) ?? 0) - (latestPrice(b.priceHistory) ?? 0))
        if (sortCol === 'trend')  {
          const at = getTrend(a.priceHistory, monthLabels, windowMonths) ?? -999
          const bt = getTrend(b.priceHistory, monthLabels, windowMonths) ?? -999
          return sortDir * (at - bt)
        }
        return 0
      })
  }, [products, filterSet, filterCat, search, sortCol, sortDir, windowMonths, monthLabels])

  const selectedProduct = selected ? products.find(p => p.id === selected) : null

  // ── chart data for selected product ───────────────────────────────────────
  const chartData = useMemo(() => {
    if (!selectedProduct) return []
    return monthLabels
      .map(label => {
        const row = selectedProduct.priceHistory.find(r => r.month_label === label)
        return { month: label, price: row?.market_price ?? null }
      })
      .filter(d => d.price !== null)
  }, [selectedProduct, monthLabels])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => -d)
    else { setSortCol(col); setSortDir(1) }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <span style={{ color: '#555', marginLeft: 4 }}>⇅</span>
    return <span style={{ color: C.gold, marginLeft: 4 }}>{sortDir === 1 ? '▲' : '▼'}</span>
  }

  // ── shared cell style ──────────────────────────────────────────────────────
  const td = (extra = {}) => ({
    padding: '9px 12px', ...extra,
  })

  const th = (col, extra = {}) => ({
    padding: '10px 12px', textAlign: 'left', color: C.gold,
    fontWeight: 700, fontSize: 11, letterSpacing: 0.5,
    cursor: col ? 'pointer' : 'default',
    borderBottom: `2px solid ${C.gold}`, whiteSpace: 'nowrap',
    userSelect: 'none', background: C.dark,
    ...extra,
  })

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: '#0d0d1a', minHeight: '100vh', color: C.white }}>

      {/* ── Header ── */}
      <div style={{ background: C.dark, borderBottom: `2px solid ${C.gold}`, padding: '18px 28px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.gold, letterSpacing: 1 }}>
          ⚔ RIFTBOUND TCG — PRICE TRENDS
        </div>
        <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>
          Estimated secondary market prices (TCGPlayer / eBay) · MSRP from official Riot & UVS Games pricing · Updated Mar 2026
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{
        background: C.mid, padding: '12px 28px', borderBottom: '1px solid #2a2a4a',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <button
          onClick={() => startTransition(() => router.refresh())}
          disabled={isPending}
          title="Refresh prices"
          style={{
            background: isPending ? C.accent : C.dark,
            color: isPending ? C.gray : C.gold,
            border: `1px solid ${C.gold}`, borderRadius: 20, padding: '6px 14px',
            fontWeight: 700, fontSize: 13, cursor: isPending ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'opacity 0.2s',
          }}
        >
          <span style={{ display: 'inline-block', animation: isPending ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          {isPending ? 'Refreshing…' : 'Refresh'}
        </button>

        <span style={{ color: C.gray, fontSize: 13, fontWeight: 600 }}>TIME WINDOW:</span>
        {WINDOWS.map((w, i) => (
          <button key={w.label} onClick={() => setWindowIdx(i)} style={{
            background: windowIdx === i ? C.gold : C.accent,
            color:      windowIdx === i ? C.dark  : C.white,
            border: 'none', borderRadius: 20, padding: '6px 18px',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>{w.label}</button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            [SETS, filterSet, setFilterSet],
            [CATEGORIES, filterCat, setFilterCat],
          ].map(([opts, val, set], i) => (
            <select key={i} value={val} onChange={e => set(e.target.value)} style={{
              background: C.accent, color: C.white, border: '1px solid #2a2a5a',
              borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
            }}>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
          <input
            placeholder="Search product…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: C.accent, color: C.white, border: '1px solid #2a2a5a',
              borderRadius: 6, padding: '5px 10px', fontSize: 12, width: 160, outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Body: table + chart panel ── */}
      <div style={{ display: 'flex' }}>

        {/* Table */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {[
                  ['name',   'Product'],
                  [null,     'Set'],
                  [null,     'Category'],
                  [null,     'Status'],
                  ['msrp',   'MSRP'],
                  ['market', 'Market Price'],
                  ['trend',  isSubMonthly ? 'Trend' : `${WINDOWS[windowIdx].label} Trend`],
                  [null,     'vs MSRP'],
                ].map(([col, label]) => (
                  <th key={label} style={th(col)} onClick={() => col && toggleSort(col)}>
                    {label}{col && <SortIcon col={col} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const market  = latestPrice(p.priceHistory)
                const trend   = getTrend(p.priceHistory, monthLabels, windowMonths)
                const vsMsrp  = market ? (((market - p.msrp) / p.msrp) * 100).toFixed(1) : null
                const isSel   = selected === p.id
                const rowBg   = isSel ? C.rowSel : i % 2 === 0 ? C.row1 : C.row2

                return (
                  <tr key={p.id} onClick={() => setSelected(isSel ? null : p.id)} style={{
                    background: rowBg, cursor: 'pointer',
                    borderLeft: isSel ? `3px solid ${C.gold}` : '3px solid transparent',
                  }}>
                    <td style={td({ fontWeight: isSel ? 700 : 400, color: isSel ? C.gold : C.white })}>{p.name}</td>
                    <td style={td({ color: C.gray, whiteSpace: 'nowrap' })}>{p.set_name}</td>
                    <td style={td({ color: C.gray, whiteSpace: 'nowrap' })}>{p.category}</td>
                    <td style={td()}><StatusBadge status={p.status} /></td>
                    <td style={td({ color: C.white })}>${Number(p.msrp).toFixed(2)}</td>
                    <td style={td({ fontWeight: 700, color: market ? C.white : C.gray })}>
                      {market ? `$${Number(market).toFixed(2)}` : '—'}
                    </td>
                    <td style={td()}>
                      {isSubMonthly
                        ? <span style={{ color: C.gray, fontSize: 11 }} title="Sub-monthly data not tracked">—</span>
                        : <TrendBadge pct={trend} />}
                    </td>
                    <td style={td()}>
                      {vsMsrp !== null
                        ? <span style={{ color: parseFloat(vsMsrp) > 5 ? C.green : parseFloat(vsMsrp) < -5 ? C.red : C.orange, fontWeight: 600, fontSize: 12 }}>
                            {parseFloat(vsMsrp) > 0 ? '+' : ''}{vsMsrp}%
                          </span>
                        : <span style={{ color: C.gray }}>—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>No products match your filters.</div>
          )}
        </div>

        {/* ── Detail / Chart Panel ── */}
        {selectedProduct && (
          <div style={{
            width: 380, background: C.mid, borderLeft: `2px solid ${C.gold}`,
            padding: 20, flexShrink: 0,
            position: 'sticky', top: 0, maxHeight: '100vh', overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ color: C.gold, fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{selectedProduct.name}</div>
                <div style={{ color: C.gray, fontSize: 11, marginTop: 3 }}>{selectedProduct.set_name} · {selectedProduct.category}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{
                background: 'none', border: 'none', color: C.gray, fontSize: 18, cursor: 'pointer',
              }}>✕</button>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                ['MSRP',   `$${Number(selectedProduct.msrp).toFixed(2)}`],
                ['Market', (() => { const m = latestPrice(selectedProduct.priceHistory); return m ? `$${Number(m).toFixed(2)}` : '—' })()],
                [WINDOWS[windowIdx].label, (() => { const t = getTrend(selectedProduct.priceHistory, monthLabels, windowMonths); return t !== null ? `${t > 0 ? '+' : ''}${t.toFixed(1)}%` : '—' })()],
              ].map(([label, val]) => (
                <div key={label} style={{ background: C.accent, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ color: C.gray, fontSize: 10, marginBottom: 4 }}>{label}</div>
                  <div style={{ color: C.gold, fontWeight: 700, fontSize: 15 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Line chart */}
            {chartData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                  <XAxis dataKey="month" tick={{ fill: C.gray, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.gray, fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `$${v}`} width={50} />
                  <Tooltip content={<CustomTooltip msrp={selectedProduct.msrp} />} />
                  <ReferenceLine y={selectedProduct.msrp} stroke={C.gray} strokeDasharray="4 4"
                    label={{ value: 'MSRP', fill: C.gray, fontSize: 10, position: 'insideTopRight' }} />
                  <Line type="monotone" dataKey="price" stroke={C.gold} strokeWidth={2.5}
                    dot={{ fill: C.gold, r: 4 }} activeDot={{ r: 6, fill: C.white }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
                Insufficient data for this window.<br />Try the 6 Months view.
              </div>
            )}

            {/* Monthly breakdown */}
            <div style={{ marginTop: 14 }}>
              <div style={{ color: C.gray, fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>MONTHLY BREAKDOWN</div>
              {selectedProduct.priceHistory
                .filter(r => r.market_price !== null)
                .sort((a, b) => new Date(a.month_date) - new Date(b.month_date))
                .map((row, idx, arr) => {
                  const prev  = idx > 0 ? arr[idx - 1].market_price : null
                  const delta = prev !== null ? row.market_price - prev : null
                  return (
                    <div key={row.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 0', borderBottom: '1px solid #1e1e3a',
                    }}>
                      <span style={{ color: C.gray, fontSize: 12 }}>{row.month_label}</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {delta !== null && (
                          <span style={{ color: delta > 0 ? C.green : delta < 0 ? C.red : C.gray, fontSize: 11 }}>
                            {delta > 0 ? '+' : ''}{Number(delta).toFixed(2)}
                          </span>
                        )}
                        <span style={{ color: C.white, fontWeight: 700, fontSize: 13 }}>
                          ${Number(row.market_price).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Note */}
            {selectedProduct.note && (
              <div style={{ marginTop: 14, padding: 10, background: '#0a0a1a', borderRadius: 6, border: '1px solid #2a2a4a' }}>
                <div style={{ color: C.gold, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>📌 NOTE</div>
                <div style={{ color: C.gray, fontSize: 11, lineHeight: 1.5 }}>{selectedProduct.note}</div>
              </div>
            )}

            {/* Disclaimer */}
            <div style={{ marginTop: 14, padding: 10, background: '#0a0a1a', borderRadius: 6, border: '1px solid #2a2a4a' }}>
              <div style={{ color: C.gray, fontSize: 10, lineHeight: 1.5 }}>
                ⚠ Prices are <strong>estimated</strong> from community-reported secondary market data (TCGPlayer, eBay).
                Always verify current prices before buying or selling.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer legend ── */}
      <div style={{
        background: C.dark, padding: '10px 28px', borderTop: '1px solid #2a2a4a',
        display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {[[C.green, '▲ Rising (>+2%)'], [C.red, '▼ Falling (<−2%)'], [C.orange, '► Stable (±2%)']].map(([color, label]) => (
          <span key={label} style={{ color, fontSize: 12, fontWeight: 600 }}>{label}</span>
        ))}
        <span style={{ color: C.gray, fontSize: 12, marginLeft: 'auto' }}>
          Click any row to see its price chart →
        </span>
      </div>
    </div>
  )
}
