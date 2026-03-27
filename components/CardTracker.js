'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const C = {
  gold:   '#C9A84C',
  dark:   '#1A1A2E',
  mid:    '#16213E',
  accent: '#0F3460',
  green:  '#2ECC71',
  orange: '#E67E22',
  red:    '#E74C3C',
  gray:   '#95A5A6',
  white:  '#FFFFFF',
  row1:   '#12122a',
  row2:   '#0f0f22',
  rowSel: '#1a2a4a',
}

const RARITY_ORDER = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Showcase: 5 }

const WINDOWS = [
  { label: '1 Day',    months: null },
  { label: '1 Week',   months: null },
  { label: '1 Month',  months: 1    },
  { label: '3 Months', months: 3    },
  { label: '6 Months', months: 6    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function latestPrice(priceHistory) {
  const sorted = [...priceHistory]
    .filter(r => r.market_price !== null)
    .sort((a, b) => new Date(b.month_date) - new Date(a.month_date))
  return sorted[0]?.market_price ?? null
}

function getTrend(priceHistory, allLabels, windowMonths) {
  if (windowMonths === null) return null
  const sliced = allLabels.slice(-(windowMonths + 1))
  const data = sliced
    .map(label => {
      const row = priceHistory.find(r => r.month_label === label)
      return { price: row?.market_price ?? null }
    })
    .filter(d => d.price !== null)
  if (data.length < 2) return null
  const first = data[0].price
  const last  = data[data.length - 1].price
  return ((last - first) / first) * 100
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

function RarityBadge({ rarity }) {
  const colors = {
    Common:    { bg: '#4a4a6a', text: C.white  },
    Uncommon:  { bg: '#2a6a4a', text: C.white  },
    Rare:      { bg: '#1a4a8a', text: C.white  },
    Epic:      { bg: '#6a2a8a', text: C.white  },
    Showcase:  { bg: '#8a5a10', text: '#ffd700' },
  }
  const style = colors[rarity] ?? { bg: '#2a2a4a', text: C.gray }
  return (
    <span style={{
      background: style.bg, color: style.text,
      borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{rarity ?? '—'}</span>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div style={{
      background: C.mid, border: `1px solid ${C.gold}`,
      borderRadius: 8, padding: '10px 14px', color: C.white, fontSize: 13,
    }}>
      <div style={{ color: C.gold, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div>Market: <strong>${Number(val).toFixed(2)}</strong></div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CardTracker({ cards, monthLabels }) {
  const router = useRouter()
  const [isPending,  startTransition] = useTransition()
  const [windowIdx,  setWindowIdx]    = useState(4)
  const [search,     setSearch]       = useState('')
  const [filterSet,  setFilterSet]    = useState('All Sets')
  const [filterRar,  setFilterRar]    = useState('All Rarities')
  const [filterType, setFilterType]   = useState('All Types')
  const [filterDom,  setFilterDom]    = useState('All Domains')
  const [selected,   setSelected]     = useState(null)
  const [sortCol,    setSortCol]      = useState('collector_number')
  const [sortDir,    setSortDir]      = useState(1)
  const [syncStatus, setSyncStatus]   = useState(null)
  const [syncing,    setSyncing]      = useState(false)

  const windowMonths = WINDOWS[windowIdx].months
  const isSubMonthly = windowMonths === null

  // ── Dynamic filter options built from loaded data ───────────────────────────
  const sets    = useMemo(() => ['All Sets',    ...new Set(cards.map(c => c.set_label).filter(Boolean).sort())], [cards])
  const rars    = useMemo(() => ['All Rarities',...[...new Set(cards.map(c => c.rarity).filter(Boolean))].sort((a,b) => (RARITY_ORDER[a]??9) - (RARITY_ORDER[b]??9))], [cards])
  const types   = useMemo(() => ['All Types',   ...new Set(cards.flatMap(c => c.card_type?.split(', ') ?? []).filter(Boolean).sort())], [cards])
  const domains = useMemo(() => ['All Domains', ...new Set(cards.flatMap(c => c.domain?.split(', ')    ?? []).filter(Boolean).sort())], [cards])

  // ── Filtered + sorted rows ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return cards
      .filter(c => {
        if (filterSet  !== 'All Sets'      && c.set_label !== filterSet)              return false
        if (filterRar  !== 'All Rarities'  && c.rarity    !== filterRar)              return false
        if (filterType !== 'All Types'     && !c.card_type?.includes(filterType))     return false
        if (filterDom  !== 'All Domains'   && !c.domain?.includes(filterDom))         return false
        if (search && !c.name.toLowerCase().includes(search.toLowerCase()))           return false
        return true
      })
      .sort((a, b) => {
        if (sortCol === 'name')             return sortDir * a.name.localeCompare(b.name)
        if (sortCol === 'collector_number') return sortDir * (a.collector_number - b.collector_number)
        if (sortCol === 'rarity')           return sortDir * ((RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9))
        if (sortCol === 'card_type')         return sortDir * (a.card_type ?? '').localeCompare(b.card_type ?? '')
        if (sortCol === 'domain')           return sortDir * (a.domain    ?? '').localeCompare(b.domain    ?? '')
        if (sortCol === 'energy')           return sortDir * ((a.energy ?? 99) - (b.energy ?? 99))
        if (sortCol === 'market') {
          return sortDir * ((latestPrice(a.priceHistory) ?? 0) - (latestPrice(b.priceHistory) ?? 0))
        }
        if (sortCol === 'trend') {
          const at = getTrend(a.priceHistory, monthLabels, windowMonths) ?? -999
          const bt = getTrend(b.priceHistory, monthLabels, windowMonths) ?? -999
          return sortDir * (at - bt)
        }
        return 0
      })
  }, [cards, filterSet, filterRar, filterType, filterDom, search, sortCol, sortDir, windowMonths, monthLabels])

  const selectedCard = selected ? cards.find(c => c.id === selected) : null

  const chartData = useMemo(() => {
    if (!selectedCard) return []
    return monthLabels
      .map(label => {
        const row = selectedCard.priceHistory.find(r => r.month_label === label)
        return { month: label, price: row?.market_price ?? null }
      })
      .filter(d => d.price !== null)
  }, [selectedCard, monthLabels])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => -d)
    else { setSortCol(col); setSortDir(1) }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <span style={{ color: '#555', marginLeft: 4 }}>⇅</span>
    return <span style={{ color: C.gold, marginLeft: 4 }}>{sortDir === 1 ? '▲' : '▼'}</span>
  }

  async function handleSync() {
    setSyncing(true)
    setSyncStatus(null)
    try {
      const res  = await fetch('/api/sync-cards', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSyncStatus(`Synced ${data.synced} cards`)
      startTransition(() => router.refresh())
    } catch (err) {
      setSyncStatus(`Error: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const td = (extra = {}) => ({ padding: '9px 12px', ...extra })
  const th = (col, extra = {}) => ({
    padding: '10px 12px', textAlign: 'left', color: C.gold,
    fontWeight: 700, fontSize: 11, letterSpacing: 0.5,
    cursor: col ? 'pointer' : 'default',
    borderBottom: `2px solid ${C.gold}`, whiteSpace: 'nowrap',
    userSelect: 'none', background: C.dark,
    ...extra,
  })

  const selectStyle = {
    background: C.accent, color: C.white, border: '1px solid #2a2a5a',
    borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: '#0d0d1a', minHeight: '100vh', color: C.white }}>

      {/* ── Header ── */}
      <div style={{ background: C.dark, borderBottom: `2px solid ${C.gold}`, padding: '18px 28px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.gold, letterSpacing: 1 }}>
          ⚔ RIFTBOUND TCG — SINGLES PRICE TRACKER
        </div>
        <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>
          Individual card secondary market prices · Synced from official Riftbound card gallery
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{
        background: C.mid, padding: '12px 28px', borderBottom: '1px solid #2a2a4a',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        {/* Refresh data */}
        <button
          onClick={() => startTransition(() => router.refresh())}
          disabled={isPending}
          title="Refresh prices"
          style={{
            background: isPending ? C.accent : C.dark, color: isPending ? C.gray : C.gold,
            border: `1px solid ${C.gold}`, borderRadius: 20, padding: '6px 14px',
            fontWeight: 700, fontSize: 13, cursor: isPending ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ display: 'inline-block', animation: isPending ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          {isPending ? 'Refreshing…' : 'Refresh'}
        </button>

        {/* Sync from official gallery */}
        <button
          onClick={handleSync}
          disabled={syncing || isPending}
          title="Pull latest cards from riftbound.leagueoflegends.com"
          style={{
            background: syncing ? C.accent : C.gold, color: syncing ? C.gray : C.dark,
            border: 'none', borderRadius: 20, padding: '6px 14px',
            fontWeight: 700, fontSize: 13, cursor: syncing ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>⟳</span>
          {syncing ? 'Syncing…' : 'Sync Cards'}
        </button>
        {syncStatus && (
          <span style={{ fontSize: 12, color: syncStatus.startsWith('Error') ? C.red : C.green }}>
            {syncStatus}
          </span>
        )}

        <span style={{ color: C.gray, fontSize: 13, fontWeight: 600 }}>TIME WINDOW:</span>
        {WINDOWS.map((w, i) => (
          <button key={w.label} onClick={() => setWindowIdx(i)} style={{
            background: windowIdx === i ? C.gold : C.accent,
            color:      windowIdx === i ? C.dark : C.white,
            border: 'none', borderRadius: 20, padding: '6px 18px',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>{w.label}</button>
        ))}

        {/* Filters */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            [sets,    filterSet,  setFilterSet ],
            [rars,    filterRar,  setFilterRar ],
            [types,   filterType, setFilterType],
            [domains, filterDom,  setFilterDom ],
          ].map(([opts, val, set], i) => (
            <select key={i} value={val} onChange={e => set(e.target.value)} style={selectStyle}>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
          <input
            placeholder="Search card…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: C.accent, color: C.white, border: '1px solid #2a2a5a',
              borderRadius: 6, padding: '5px 10px', fontSize: 12, width: 150, outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Empty state ── */}
      {cards.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: C.gray }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🃏</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No cards loaded yet</div>
          <div style={{ fontSize: 13 }}>
            Click <strong style={{ color: C.gold }}>Sync Cards</strong> above to pull the full card list from the official gallery.
          </div>
        </div>
      )}

      {/* ── Body: table + detail panel ── */}
      {cards.length > 0 && (
        <div style={{ display: 'flex' }}>

          {/* Table */}
          <div style={{ flex: 1, overflowX: 'auto' }}>
            <div style={{ padding: '6px 28px', color: C.gray, fontSize: 11 }}>
              Showing {filtered.length} of {cards.length} cards
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {[
                    ['collector_number', '#'         ],
                    ['name',             'Card Name' ],
                    [null,               'Set'       ],
                    ['rarity',           'Rarity'    ],
                    ['card_type',        'Type'      ],
                    ['domain',           'Domain'    ],
                    ['energy',           'Cost'      ],
                    ['market',           'Market Price'],
                    ['trend',            isSubMonthly ? 'Trend' : `${WINDOWS[windowIdx].label} Trend`],
                  ].map(([col, label]) => (
                    <th key={label} style={th(col)} onClick={() => col && toggleSort(col)}>
                      {label}{col && <SortIcon col={col} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const market = latestPrice(c.priceHistory)
                  const trend  = getTrend(c.priceHistory, monthLabels, windowMonths)
                  const isSel  = selected === c.id
                  const rowBg  = isSel ? C.rowSel : i % 2 === 0 ? C.row1 : C.row2
                  return (
                    <tr key={c.id} onClick={() => setSelected(isSel ? null : c.id)} style={{
                      background: rowBg, cursor: 'pointer',
                      borderLeft: isSel ? `3px solid ${C.gold}` : '3px solid transparent',
                    }}>
                      <td style={td({ color: C.gray, fontSize: 11 })}>{c.public_code}</td>
                      <td style={td({ fontWeight: isSel ? 700 : 400, color: isSel ? C.gold : C.white })}>
                        {c.name}
                        {c.is_new && <span style={{ marginLeft: 6, background: C.green, color: C.dark, borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>NEW</span>}
                      </td>
                      <td style={td({ color: C.gray, whiteSpace: 'nowrap' })}>{c.set_label}</td>
                      <td style={td()}><RarityBadge rarity={c.rarity} /></td>
                      <td style={td({ color: C.gray })}>{c.card_type ?? '—'}</td>
                      <td style={td({ color: C.gray })}>{c.domain    ?? '—'}</td>
                      <td style={td({ textAlign: 'center', color: c.energy !== null ? C.white : C.gray })}>
                        {c.energy !== null ? c.energy : '—'}
                      </td>
                      <td style={td({ fontWeight: 700, color: market ? C.white : C.gray })}>
                        {market ? `$${Number(market).toFixed(2)}` : '—'}
                      </td>
                      <td style={td()}>
                        {isSubMonthly
                          ? <span style={{ color: C.gray, fontSize: 11 }} title="Sub-monthly data not tracked">—</span>
                          : <TrendBadge pct={trend} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && cards.length > 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>No cards match your filters.</div>
            )}
          </div>

          {/* ── Detail Panel ── */}
          {selectedCard && (
            <div style={{
              width: 360, background: C.mid, borderLeft: `2px solid ${C.gold}`,
              padding: 20, flexShrink: 0,
              position: 'sticky', top: 0, maxHeight: '100vh', overflowY: 'auto',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ color: C.gold, fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{selectedCard.name}</div>
                  <div style={{ color: C.gray, fontSize: 11, marginTop: 3 }}>
                    {selectedCard.public_code} · {selectedCard.set_label}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: C.gray, fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              {/* Card image */}
              {selectedCard.image_url && (
                <div style={{ marginBottom: 14, borderRadius: 8, overflow: 'hidden', background: '#0a0a1a' }}>
                  <img
                    src={selectedCard.image_url}
                    alt={selectedCard.name}
                    loading="lazy"
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>
              )}

              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  ['Rarity',  selectedCard.rarity    ?? '—'],
                  ['Type',    selectedCard.card_type  ?? '—'],
                  ['Domain',  selectedCard.domain     ?? '—'],
                  ['Energy',  selectedCard.energy !== null ? selectedCard.energy : '—'],
                  ['Market',  (() => { const m = latestPrice(selectedCard.priceHistory); return m ? `$${Number(m).toFixed(2)}` : '—' })()],
                  [WINDOWS[windowIdx].label, (() => { const t = getTrend(selectedCard.priceHistory, monthLabels, windowMonths); return t !== null ? `${t > 0 ? '+' : ''}${t.toFixed(1)}%` : '—' })()],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: C.accent, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ color: C.gray, fontSize: 10, marginBottom: 4 }}>{label}</div>
                    <div style={{ color: C.gold, fontWeight: 700, fontSize: 14 }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Price chart */}
              {chartData.length >= 2 ? (
                <>
                  <div style={{ color: C.gray, fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>PRICE HISTORY</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                      <XAxis dataKey="month" tick={{ fill: C.gray, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: C.gray, fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={v => `$${v}`} width={50} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="price" stroke={C.gold} strokeWidth={2.5}
                        dot={{ fill: C.gold, r: 4 }} activeDot={{ r: 6, fill: C.white }} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 12, textAlign: 'center', lineHeight: 1.6, background: '#0a0a1a', borderRadius: 8 }}>
                  No price history yet.<br />Add entries via Supabase.
                </div>
              )}

              {/* Monthly breakdown */}
              {selectedCard.priceHistory.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ color: C.gray, fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>MONTHLY BREAKDOWN</div>
                  {selectedCard.priceHistory
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
              )}

              <div style={{ marginTop: 14, padding: 10, background: '#0a0a1a', borderRadius: 6, border: '1px solid #2a2a4a' }}>
                <div style={{ color: C.gray, fontSize: 10, lineHeight: 1.5 }}>
                  ⚠ Prices are <strong>estimated</strong> from community-reported secondary market data.
                  Always verify current prices before buying or selling.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
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
