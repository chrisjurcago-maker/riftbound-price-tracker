import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

const GALLERY_URL = 'https://riftbound.leagueoflegends.com/en-us/card-gallery/'

// Extracts label(s) from a field regardless of which array key is used
function extractLabels(field, ...keys) {
  if (!field) return null
  if (Array.isArray(field)) return field.map(x => x.label).join(', ') || null
  for (const key of keys) {
    if (Array.isArray(field[key])) return field[key].map(x => x.label).join(', ') || null
  }
  return null
}

export async function POST() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY env var' }, { status: 500 })
  }

  try {
    // Fetch the official card gallery page
    const res = await fetch(GALLERY_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Gallery fetch failed: ${res.status}`)
    const html = await res.text()

    // Extract Next.js embedded JSON payload
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
    if (!match) throw new Error('__NEXT_DATA__ not found in page')

    const nextData  = JSON.parse(match[1])
    const blades    = nextData?.props?.pageProps?.page?.blades ?? []

    // Find whichever blade contains the cards array
    let cardItems = []
    for (const blade of blades) {
      const items = blade?.cards?.items
      if (Array.isArray(items) && items.length > 0) {
        cardItems = items
        break
      }
    }

    if (cardItems.length === 0) throw new Error('No cards found in page data')

    // Map to our DB schema
    const cards = cardItems.map(card => ({
      id:               card.id,
      name:             card.name,
      collector_number: card.collectorNumber,
      public_code:      card.publicCode,
      set_id:           card.set    ?? '',
      set_label:        card.setName ?? '',
      rarity:           card.rarity?.value?.label ?? null,
      card_type:        extractLabels(card.cardType, 'type', 'value', 'values'),
      domain:           extractLabels(card.domain ?? card.domains, 'values', 'value', 'type'),
      energy:           typeof card.energy === 'number' ? card.energy : null,
      power:            typeof card.power  === 'number' ? card.power  : null,
      image_url:        card.cardImage?.url ?? null,
      orientation:      card.orientation ?? 'portrait',
      is_new:           card.flags?.some(f => f.id === 'new') ?? false,
      updated_at:       new Date().toISOString(),
    }))

    // Upsert — service role key bypasses RLS
    const supabase = createClient(url, key)
    const { error } = await supabase
      .from('cards')
      .upsert(cards, { onConflict: 'id' })

    if (error) throw error

    revalidatePath('/cards')
    return NextResponse.json({ success: true, synced: cards.length })
  } catch (err) {
    console.error('Card sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
