import { supabase } from './supabase'

/**
 * Fetch all products with their full price history, joined.
 * Returns products array where each product has a `prices` array
 * sorted by month_date ascending.
 */
export async function fetchProductsWithPrices() {
  if (!supabase) throw new Error('Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('*')
    .order('set_name')
    .order('name')

  if (pErr) throw pErr

  const { data: history, error: hErr } = await supabase
    .from('price_history')
    .select('*')
    .order('month_date', { ascending: true })

  if (hErr) throw hErr

  // Group price rows by product_id
  const historyMap = {}
  for (const row of history) {
    if (!historyMap[row.product_id]) historyMap[row.product_id] = []
    historyMap[row.product_id].push(row)
  }

  return products.map(p => ({
    ...p,
    priceHistory: historyMap[p.id] || [],
  }))
}

/**
 * Fetch a single product with its price history.
 */
export async function fetchProduct(id) {
  const { data: product, error: pErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (pErr) throw pErr

  const { data: history, error: hErr } = await supabase
    .from('price_history')
    .select('*')
    .eq('product_id', id)
    .order('month_date', { ascending: true })

  if (hErr) throw hErr

  return { ...product, priceHistory: history }
}

/**
 * Get unique month labels in chronological order across all history.
 */
export async function fetchMonthLabels() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('price_history')
    .select('month_label, month_date')
    .order('month_date', { ascending: true })

  if (error) throw error

  const seen = new Set()
  const labels = []
  for (const row of data) {
    if (!seen.has(row.month_label)) {
      seen.add(row.month_label)
      labels.push(row.month_label)
    }
  }
  return labels
}
