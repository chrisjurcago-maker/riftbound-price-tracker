import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

const FINDING_API = 'https://svcs.ebay.com/services/search/FindingService/v1'

// Returns median sold price from eBay completed listings, or null if none found
async function fetchEbayPrice(appId, cardName, setLabel) {
  const query = encodeURIComponent(`Riftbound TCG ${cardName} ${setLabel}`)
  const url = [
    FINDING_API,
    '?OPERATION-NAME=findCompletedItems',
    '&SERVICE-VERSION=1.0.0',
    `&SECURITY-APPNAME=${appId}`,
    '&RESPONSE-DATA-FORMAT=JSON',
    `&keywords=${query}`,
    '&itemFilter(0).name=SoldItemsOnly',
    '&itemFilter(0).value=true',
    '&itemFilter(1).name=Currency',
    '&itemFilter(1).value=USD',
    '&sortOrder=EndTimeSoonest',
    '&paginationInput.entriesPerPage=10',
  ].join('')

  const res    = await fetch(url, { cache: 'no-store' })
  const rlogid = res.headers.get('x-ebay-c-tracking') ?? res.headers.get('rlogid') ?? 'not found'
  const text   = await res.text()

  console.log('eBay rlogid:', rlogid)
  if (!res.ok) throw new Error(`eBay API error ${res.status} (rlogid: ${rlogid}): ${text.slice(0, 300)}`)
  if (!text)   throw new Error('eBay API returned empty response')

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`eBay API returned non-JSON: ${text.slice(0, 200)}`)
  }

  const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? []
  const prices = items
    .map(item => parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__))
    .filter(p => !isNaN(p) && p > 0)
    .sort((a, b) => a - b)

  if (prices.length === 0) return null

  // Use median to reduce outlier impact
  const mid = Math.floor(prices.length / 2)
  return prices.length % 2 === 0
    ? (prices[mid - 1] + prices[mid]) / 2
    : prices[mid]
}

function currentMonthLabel() {
  const now = new Date()
  const month = now.toLocaleString('en-US', { month: 'short' })
  const year  = String(now.getFullYear()).slice(2)
  return `${month} '${year}`
}

function currentMonthDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export async function POST(request) {
  const appId      = process.env.EBAY_CLIENT_ID
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!appId)       return NextResponse.json({ error: 'Missing EBAY_CLIENT_ID'          }, { status: 500 })
  if (!serviceKey)  return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })

  const { cardId } = await request.json().catch(() => ({}))
  if (!cardId) return NextResponse.json({ error: 'cardId is required' }, { status: 400 })

  const supabase = createClient(supabaseUrl, serviceKey)

  // Fetch the card
  const { data: card, error: cErr } = await supabase
    .from('cards')
    .select('id, name, set_label')
    .eq('id', cardId)
    .single()

  if (cErr || !card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  try {
    // Search eBay for sold listings
    const price = await fetchEbayPrice(appId, card.name, card.set_label)

    if (price === null) {
      return NextResponse.json({ found: false, cardId, message: 'No sold listings found on eBay' })
    }

    const rounded = Math.round(price * 100) / 100

    // Upsert into card_price_history for current month
    const { error: uErr } = await supabase
      .from('card_price_history')
      .upsert({
        card_id:      cardId,
        month_label:  currentMonthLabel(),
        month_date:   currentMonthDate(),
        market_price: rounded,
      }, { onConflict: 'card_id,month_date' })

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

    revalidatePath('/cards')
    return NextResponse.json({ found: true, cardId, price: rounded })
  } catch (err) {
    console.error('eBay fetch error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
