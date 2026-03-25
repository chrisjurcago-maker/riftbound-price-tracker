import { fetchProductsWithPrices, fetchMonthLabels } from '../lib/data'
import PriceTracker from '../components/PriceTracker'

// Revalidate every 10 minutes so prices stay reasonably fresh without hammering Supabase
export const revalidate = 600

export default async function HomePage() {
  let products = []
  let monthLabels = []
  let error = null

  try {
    ;[products, monthLabels] = await Promise.all([
      fetchProductsWithPrices(),
      fetchMonthLabels(),
    ])
  } catch (err) {
    console.error('Supabase fetch error:', err)
    error = err.message || 'Failed to load data from database.'
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16, padding: 32
      }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ color: '#E74C3C', fontWeight: 700, fontSize: 18 }}>Database connection error</div>
        <div style={{ color: '#95A5A6', fontSize: 14, maxWidth: 480, textAlign: 'center' }}>{error}</div>
        <div style={{ color: '#95A5A6', fontSize: 13 }}>
          Check that <code style={{ color: '#C9A84C' }}>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code style={{ color: '#C9A84C' }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set correctly.
        </div>
      </div>
    )
  }

  return <PriceTracker products={products} monthLabels={monthLabels} />
}
