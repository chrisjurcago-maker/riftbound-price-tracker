# Riftbound TCG — Price Tracker

A Next.js 14 app with Supabase backend tracking secondary market price trends
for Riftbound TCG sealed products and accessories.

---

## Stack

| Layer     | Technology |
|-----------|-----------|
| Framework | Next.js 14 (App Router) |
| Database  | Supabase (PostgreSQL) |
| Charts    | Recharts |
| Hosting   | Vercel |

---

## Setup — Step by Step

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project**, fill in the name (`riftbound-price-tracker`) and database password.
3. Wait ~2 minutes for provisioning.

### 2. Run the database migration

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Open `supabase/migrations/001_init.sql` from this project.
4. Paste the entire file contents into the SQL Editor.
5. Click **Run** (or press `Ctrl+Enter`).

This creates the `products` and `price_history` tables, sets up RLS policies,
and seeds all the initial product and price data.

### 3. Get your Supabase API keys

1. In Supabase, go to **Project Settings → API**.
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (keep this secret!) → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Configure environment variables locally

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
# then edit .env.local with your Supabase values
```

### 5. Run locally

```bash
npm install
npm run dev
# → open http://localhost:3000
```

---

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel
# follow the prompts, then add env vars:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel --prod
```

### Option B — Vercel Dashboard (recommended)

1. Push this repo to GitHub (make sure `.env.local` is in `.gitignore` ✓).
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo.
3. In the **Environment Variables** section before deploying, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy**.

Vercel auto-detects Next.js — no build config needed.

---

## Adding new price data

You can add monthly price entries directly in Supabase:

**Option 1 — SQL Editor:**
```sql
insert into public.price_history (product_id, month_label, month_date, market_price)
values ('ori-box', 'Apr ''26', '2026-04-01', 130.00)
on conflict (product_id, month_date) do update set market_price = excluded.market_price;
```

**Option 2 — Supabase Table Editor:**
1. Go to **Table Editor → price_history**.
2. Click **Insert Row** and fill in the fields.

The site revalidates every 10 minutes (see `app/page.js` → `export const revalidate = 600`),
so new data will appear on the site within 10 minutes of being added to Supabase.

---

## Project Structure

```
riftbound-price-tracker/
├── app/
│   ├── layout.js          # Root HTML layout + metadata
│   ├── page.js            # Server component — fetches from Supabase
│   └── globals.css        # Global reset + scrollbar styles
├── components/
│   └── PriceTracker.js    # Client component — full interactive UI
├── lib/
│   ├── supabase.js        # Supabase client singleton
│   └── data.js            # Data fetching helpers
├── supabase/
│   └── migrations/
│       └── 001_init.sql   # Schema + seed data — run this once in Supabase
├── .env.example           # Template for env vars (safe to commit)
├── .env.local             # Your real secrets (git-ignored)
├── next.config.js
└── package.json
```

---

## Updating prices from TCGPlayer

Current prices were estimated from community secondary market data as of March 2026.
For production use, consider:

- Manually updating `price_history` monthly via the Supabase SQL Editor.
- Building a scheduled Edge Function or cron job to pull from TCGPlayer's unofficial
  price API (if available) or scrape PriceCharting.

---

## License

MIT — free to use and modify.
