-- ============================================================
--  Riftbound Price Tracker — Supabase schema + seed
--  Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. PRODUCTS table
create table if not exists public.products (
  id            text primary key,            -- e.g. "ori-box"
  name          text not null,
  set_name      text not null,               -- "Origins" | "Spiritforged" | "Special"
  category      text not null,               -- "Booster Box" | "Playmat" | etc.
  msrp          numeric(8,2) not null,
  status        text not null default 'RELEASED', -- "RELEASED" | "RELEASED*" | "UPCOMING"
  note          text,
  created_at    timestamptz default now()
);

-- 2. PRICE_HISTORY table
create table if not exists public.price_history (
  id            bigserial primary key,
  product_id    text not null references public.products(id) on delete cascade,
  month_label   text not null,               -- e.g. "Oct '25"
  month_date    date not null,               -- first day of that month for ordering
  market_price  numeric(8,2),               -- null = not yet released / no data
  created_at    timestamptz default now(),
  unique (product_id, month_date)
);

-- Indexes for fast filtering
create index if not exists idx_price_history_product on public.price_history(product_id);
create index if not exists idx_price_history_date    on public.price_history(month_date);

-- Row-level security (read-only for anon users)
alter table public.products      enable row level security;
alter table public.price_history enable row level security;

create policy "Public read products"
  on public.products for select using (true);

create policy "Public read price_history"
  on public.price_history for select using (true);

-- ============================================================
--  SEED — Products
-- ============================================================
insert into public.products (id, name, set_name, category, msrp, status, note) values
-- Origins card products
('ori-box',        'Origins Booster Box',              'Origins',      'Booster Box',    120.00, 'RELEASED',  'Launch sellout drove major secondary spike; restocks normalized prices'),
('ori-pack',       'Origins Booster Pack',             'Origins',      'Booster Pack',     5.00, 'RELEASED',  'Single pack resale tracked on TCGPlayer'),
('ori-deck-jinx',  'Champion Deck: Jinx',              'Origins',      'Champion Deck',   20.00, 'RELEASED',  'Most popular Origins deck; slight premium vs MSRP'),
('ori-deck-viktor','Champion Deck: Viktor',            'Origins',      'Champion Deck',   20.00, 'RELEASED',  'Steady secondary demand'),
('ori-deck-leesin','Champion Deck: Lee Sin',           'Origins',      'Champion Deck',   20.00, 'RELEASED',  'Steady secondary demand'),
('ori-proving',    'Proving Grounds Starter Box',      'Origins',      'Starter Box',     40.00, 'RELEASED',  'Sold out on Riot Store; secondary market premium'),
-- Origins accessories
('ori-mat-ahri',   'Playmat: Ahri',                    'Origins',      'Playmat',         25.00, 'RELEASED',  'Most sought-after Origins mat'),
('ori-mat-jinx',   'Playmat: Jinx',                    'Origins',      'Playmat',         25.00, 'RELEASED',  NULL),
('ori-mat-mf',     'Playmat: Miss Fortune',            'Origins',      'Playmat',         25.00, 'RELEASED',  NULL),
('ori-mat-voli',   'Playmat: Volibear',                'Origins',      'Playmat',         25.00, 'RELEASED',  NULL),
('ori-slv-ahri',   'Art Sleeves: Ahri (100ct)',        'Origins',      'Card Sleeves',    12.00, 'RELEASED',  NULL),
('ori-slv-jinx',   'Art Sleeves: Jinx (100ct)',        'Origins',      'Card Sleeves',    12.00, 'RELEASED',  NULL),
('ori-slv-mf',     'Art Sleeves: Miss Fortune (100ct)','Origins',      'Card Sleeves',    12.00, 'RELEASED',  NULL),
('ori-slv-voli',   'Art Sleeves: Volibear (100ct)',    'Origins',      'Card Sleeves',    12.00, 'RELEASED',  NULL),
-- Special
('worlds-2025',    'Worlds Bundle 2025',               'Special',      'Limited Bundle',  99.99, 'RELEASED',  'Limited run; strong collector demand; never restocked'),
-- Spiritforged card products
('sfd-box',        'Spiritforged Booster Box',         'Spiritforged', 'Booster Box',    120.00, 'RELEASED',  'Launched Feb 13 2026; secondary market at moderate premium'),
('sfd-pack',       'Spiritforged Booster Pack',        'Spiritforged', 'Booster Pack',     5.00, 'RELEASED',  NULL),
('sfd-deck-fiora', 'Champion Deck: Fiora',             'Spiritforged', 'Champion Deck',   20.00, 'RELEASED',  'Competitive deck; slight secondary premium'),
('sfd-deck-rumble','Champion Deck: Rumble',            'Spiritforged', 'Champion Deck',   20.00, 'RELEASED',  NULL),
('sfd-deck-leesin','Champion Deck: Lee Sin (SFD)',     'Spiritforged', 'Champion Deck',   20.00, 'RELEASED',  NULL),
-- Spiritforged accessories
('sfd-mat-ahri',   'Playmat: Spirit Blossom Ahri',    'Spiritforged', 'Playmat',         25.00, 'RELEASED',  NULL),
('sfd-mat-irelia', 'Playmat: Spirit Blossom Irelia',  'Spiritforged', 'Playmat',         25.00, 'RELEASED',  NULL),
('sfd-mat-teemo',  'Playmat: Spirit Blossom Teemo',   'Spiritforged', 'Playmat',         25.00, 'RELEASED',  NULL),
('sfd-mat-darius', 'Playmat: Spirit Blossom Darius',  'Spiritforged', 'Playmat',         25.00, 'RELEASED',  NULL),
('sfd-slv-ahri',   'Art Sleeves: Spirit Blossom Ahri',  'Spiritforged','Card Sleeves',   12.00, 'RELEASED',  NULL),
('sfd-slv-irelia', 'Art Sleeves: Spirit Blossom Irelia','Spiritforged','Card Sleeves',   12.00, 'RELEASED',  NULL),
('sfd-slv-teemo',  'Art Sleeves: Spirit Blossom Teemo', 'Spiritforged','Card Sleeves',   12.00, 'RELEASED',  NULL),
('sfd-slv-darius', 'Art Sleeves: Spirit Blossom Darius','Spiritforged','Card Sleeves',   12.00, 'RELEASED',  NULL),
('lunar-2026',     'Lunar Revel Bundle 2026',          'Special',      'Limited Bundle',  39.99, 'RELEASED*', 'CN-text only; ships May 2026; expected secondary premium post-ship')
on conflict (id) do nothing;

-- ============================================================
--  SEED — Price history
--  Months: Oct 2025 through Mar 2026
-- ============================================================

-- Helper: one insert per product × month
-- Origins Booster Box
insert into public.price_history (product_id, month_label, month_date, market_price) values
('ori-box','Oct ''25','2025-10-01',195.00),('ori-box','Nov ''25','2025-11-01',210.00),
('ori-box','Dec ''25','2025-12-01',175.00),('ori-box','Jan ''26','2026-01-01',155.00),
('ori-box','Feb ''26','2026-02-01',140.00),('ori-box','Mar ''26','2026-03-01',135.00)
on conflict (product_id, month_date) do nothing;

-- Origins Booster Pack
insert into public.price_history (product_id, month_label, month_date, market_price) values
('ori-pack','Oct ''25','2025-10-01',9.00),('ori-pack','Nov ''25','2025-11-01',10.00),
('ori-pack','Dec ''25','2025-12-01',8.00),('ori-pack','Jan ''26','2026-01-01',7.00),
('ori-pack','Feb ''26','2026-02-01',6.50),('ori-pack','Mar ''26','2026-03-01',6.00)
on conflict (product_id, month_date) do nothing;

-- Champion Deck: Jinx
insert into public.price_history (product_id, month_label, month_date, market_price) values
('ori-deck-jinx','Oct ''25','2025-10-01',28.00),('ori-deck-jinx','Nov ''25','2025-11-01',30.00),
('ori-deck-jinx','Dec ''25','2025-12-01',26.00),('ori-deck-jinx','Jan ''26','2026-01-01',24.00),
('ori-deck-jinx','Feb ''26','2026-02-01',22.00),('ori-deck-jinx','Mar ''26','2026-03-01',21.00)
on conflict (product_id, month_date) do nothing;

-- Champion Deck: Viktor
insert into public.price_history (product_id, month_label, month_date, market_price) values
('ori-deck-viktor','Oct ''25','2025-10-01',25.00),('ori-deck-viktor','Nov ''25','2025-11-01',27.00),
('ori-deck-viktor','Dec ''25','2025-12-01',23.00),('ori-deck-viktor','Jan ''26','2026-01-01',22.00),
('ori-deck-viktor','Feb ''26','2026-02-01',21.00),('ori-deck-viktor','Mar ''26','2026-03-01',20.00)
on conflict (product_id, month_date) do nothing;

-- Champion Deck: Lee Sin
insert into public.price_history (product_id, month_label, month_date, market_price) values
('ori-deck-leesin','Oct ''25','2025-10-01',24.00),('ori-deck-leesin','Nov ''25','2025-11-01',26.00),
('ori-deck-leesin','Dec ''25','2025-12-01',22.00),('ori-deck-leesin','Jan ''26','2026-01-01',21.00),
('ori-deck-leesin','Feb ''26','2026-02-01',20.00),('ori-deck-leesin','Mar ''26','2026-03-01',20.00)
on conflict (product_id, month_date) do nothing;

-- Proving Grounds
insert into public.price_history (product_id, month_label, month_date, market_price) values
('ori-proving','Oct ''25','2025-10-01',60.00),('ori-proving','Nov ''25','2025-11-01',70.00),
('ori-proving','Dec ''25','2025-12-01',65.00),('ori-proving','Jan ''26','2026-01-01',58.00),
('ori-proving','Feb ''26','2026-02-01',55.00),('ori-proving','Mar ''26','2026-03-01',52.00)
on conflict (product_id, month_date) do nothing;

-- Playmats — Origins
insert into public.price_history (product_id, month_label, month_date, market_price) values
('ori-mat-ahri','Oct ''25','2025-10-01',40.00),('ori-mat-ahri','Nov ''25','2025-11-01',45.00),('ori-mat-ahri','Dec ''25','2025-12-01',38.00),('ori-mat-ahri','Jan ''26','2026-01-01',33.00),('ori-mat-ahri','Feb ''26','2026-02-01',30.00),('ori-mat-ahri','Mar ''26','2026-03-01',28.00),
('ori-mat-jinx','Oct ''25','2025-10-01',35.00),('ori-mat-jinx','Nov ''25','2025-11-01',40.00),('ori-mat-jinx','Dec ''25','2025-12-01',34.00),('ori-mat-jinx','Jan ''26','2026-01-01',30.00),('ori-mat-jinx','Feb ''26','2026-02-01',28.00),('ori-mat-jinx','Mar ''26','2026-03-01',27.00),
('ori-mat-mf','Oct ''25','2025-10-01',33.00),('ori-mat-mf','Nov ''25','2025-11-01',37.00),('ori-mat-mf','Dec ''25','2025-12-01',32.00),('ori-mat-mf','Jan ''26','2026-01-01',28.00),('ori-mat-mf','Feb ''26','2026-02-01',27.00),('ori-mat-mf','Mar ''26','2026-03-01',26.00),
('ori-mat-voli','Oct ''25','2025-10-01',30.00),('ori-mat-voli','Nov ''25','2025-11-01',34.00),('ori-mat-voli','Dec ''25','2025-12-01',30.00),('ori-mat-voli','Jan ''26','2026-01-01',27.00),('ori-mat-voli','Feb ''26','2026-02-01',26.00),('ori-mat-voli','Mar ''26','2026-03-01',25.00)
on conflict (product_id, month_date) do nothing;

-- Sleeves — Origins
insert into public.price_history (product_id, month_label, month_date, market_price) values
('ori-slv-ahri','Oct ''25','2025-10-01',20.00),('ori-slv-ahri','Nov ''25','2025-11-01',22.00),('ori-slv-ahri','Dec ''25','2025-12-01',18.00),('ori-slv-ahri','Jan ''26','2026-01-01',16.00),('ori-slv-ahri','Feb ''26','2026-02-01',15.00),('ori-slv-ahri','Mar ''26','2026-03-01',14.00),
('ori-slv-jinx','Oct ''25','2025-10-01',18.00),('ori-slv-jinx','Nov ''25','2025-11-01',20.00),('ori-slv-jinx','Dec ''25','2025-12-01',17.00),('ori-slv-jinx','Jan ''26','2026-01-01',15.00),('ori-slv-jinx','Feb ''26','2026-02-01',14.00),('ori-slv-jinx','Mar ''26','2026-03-01',13.00),
('ori-slv-mf','Oct ''25','2025-10-01',16.00),('ori-slv-mf','Nov ''25','2025-11-01',18.00),('ori-slv-mf','Dec ''25','2025-12-01',15.00),('ori-slv-mf','Jan ''26','2026-01-01',14.00),('ori-slv-mf','Feb ''26','2026-02-01',13.00),('ori-slv-mf','Mar ''26','2026-03-01',12.00),
('ori-slv-voli','Oct ''25','2025-10-01',15.00),('ori-slv-voli','Nov ''25','2025-11-01',17.00),('ori-slv-voli','Dec ''25','2025-12-01',14.00),('ori-slv-voli','Jan ''26','2026-01-01',13.00),('ori-slv-voli','Feb ''26','2026-02-01',12.00),('ori-slv-voli','Mar ''26','2026-03-01',12.00)
on conflict (product_id, month_date) do nothing;

-- Worlds Bundle 2025 (launched Oct 28, tracked from Nov)
insert into public.price_history (product_id, month_label, month_date, market_price) values
('worlds-2025','Nov ''25','2025-11-01',165.00),('worlds-2025','Dec ''25','2025-12-01',175.00),
('worlds-2025','Jan ''26','2026-01-01',185.00),('worlds-2025','Feb ''26','2026-02-01',200.00),
('worlds-2025','Mar ''26','2026-03-01',210.00)
on conflict (product_id, month_date) do nothing;

-- Spiritforged products (launched Feb 13 2026, data from Feb + Mar)
insert into public.price_history (product_id, month_label, month_date, market_price) values
('sfd-box','Feb ''26','2026-02-01',155.00),('sfd-box','Mar ''26','2026-03-01',145.00),
('sfd-pack','Feb ''26','2026-02-01',7.50),('sfd-pack','Mar ''26','2026-03-01',7.00),
('sfd-deck-fiora','Feb ''26','2026-02-01',26.00),('sfd-deck-fiora','Mar ''26','2026-03-01',24.00),
('sfd-deck-rumble','Feb ''26','2026-02-01',24.00),('sfd-deck-rumble','Mar ''26','2026-03-01',22.00),
('sfd-deck-leesin','Feb ''26','2026-02-01',22.00),('sfd-deck-leesin','Mar ''26','2026-03-01',21.00),
('sfd-mat-ahri','Feb ''26','2026-02-01',38.00),('sfd-mat-ahri','Mar ''26','2026-03-01',35.00),
('sfd-mat-irelia','Feb ''26','2026-02-01',35.00),('sfd-mat-irelia','Mar ''26','2026-03-01',32.00),
('sfd-mat-teemo','Feb ''26','2026-02-01',32.00),('sfd-mat-teemo','Mar ''26','2026-03-01',30.00),
('sfd-mat-darius','Feb ''26','2026-02-01',30.00),('sfd-mat-darius','Mar ''26','2026-03-01',28.00),
('sfd-slv-ahri','Feb ''26','2026-02-01',17.00),('sfd-slv-ahri','Mar ''26','2026-03-01',16.00),
('sfd-slv-irelia','Feb ''26','2026-02-01',16.00),('sfd-slv-irelia','Mar ''26','2026-03-01',15.00),
('sfd-slv-teemo','Feb ''26','2026-02-01',15.00),('sfd-slv-teemo','Mar ''26','2026-03-01',14.00),
('sfd-slv-darius','Feb ''26','2026-02-01',14.00),('sfd-slv-darius','Mar ''26','2026-03-01',13.00),
('lunar-2026','Feb ''26','2026-02-01',55.00),('lunar-2026','Mar ''26','2026-03-01',58.00)
on conflict (product_id, month_date) do nothing;
