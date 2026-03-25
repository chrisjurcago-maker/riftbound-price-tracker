-- ============================================================
--  Riftbound Price Tracker — Cards schema
--  Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. CARDS table (synced from official card gallery)
create table if not exists public.cards (
  id               text primary key,        -- e.g. "ogn-037-298"
  name             text not null,
  collector_number int  not null,
  public_code      text not null,           -- e.g. "OGN-037/298"
  set_id           text not null,           -- e.g. "OGN", "SFD"
  set_label        text not null,           -- e.g. "Origins", "Spiritforged"
  rarity           text,                    -- "Common" | "Uncommon" | "Rare" | "Epic" | "Showcase"
  card_type        text,                    -- "Unit" | "Spell" | "Battlefield"
  domain           text,                    -- e.g. "Fury" or "Calm, Chaos"
  energy           int,
  power            int,
  image_url        text,
  orientation      text default 'portrait',
  is_new           boolean default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- 2. CARD_PRICE_HISTORY table
create table if not exists public.card_price_history (
  id           bigserial primary key,
  card_id      text not null references public.cards(id) on delete cascade,
  month_label  text not null,
  month_date   date not null,
  market_price numeric(8,2),
  created_at   timestamptz default now(),
  unique (card_id, month_date)
);

create index if not exists idx_card_ph_card on public.card_price_history(card_id);
create index if not exists idx_card_ph_date on public.card_price_history(month_date);

-- RLS (read-only for anon; sync route uses service role key)
alter table public.cards              enable row level security;
alter table public.card_price_history enable row level security;

create policy "Public read cards"
  on public.cards for select using (true);

create policy "Public read card_price_history"
  on public.card_price_history for select using (true);
