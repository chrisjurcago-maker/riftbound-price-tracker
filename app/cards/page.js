import { fetchCardsWithPrices, fetchCardMonthLabels } from '../../lib/data'
import CardTracker from '../../components/CardTracker'

export const revalidate = 600

export default async function CardsPage() {
  let cards       = []
  let monthLabels = []
  let error       = null

  try {
    ;[cards, monthLabels] = await Promise.all([
      fetchCardsWithPrices(),
      fetchCardMonthLabels(),
    ])
  } catch (err) {
    console.error('Supabase fetch error:', err)
    error = err.message || 'Failed to load card data.'
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16, padding: 32,
      }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ color: '#E74C3C', fontWeight: 700, fontSize: 18 }}>Database connection error</div>
        <div style={{ color: '#95A5A6', fontSize: 14, maxWidth: 480, textAlign: 'center' }}>{error}</div>
      </div>
    )
  }

  return <CardTracker cards={cards} monthLabels={monthLabels} />
}
