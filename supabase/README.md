# Supabase setup — Sulap Artisan

Backend for Phase 2. The app reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
from `.env` (gitignored — copy `.env.example`). The client lives in
`src/lib/supabase.js`.

## 1. Run the schema migration

Supabase Dashboard → **SQL Editor** → paste `migrations/0001_init.sql` → **Run**.
It's idempotent, so re-running is safe. This creates: `profiles` (+ role
helpers + signup trigger), `categories`, `events`, `vendors`, `applications`,
`payments`, `deposits`, all with Row Level Security enabled.

If it errors, copy the exact message back and I'll patch the migration.

## 2. Seed categories + your first super-admin

Still in the SQL Editor, after the migration:

```sql
-- Categories (the nine the app ships with)
insert into public.categories (name, icon, description) values
  ('Food & Beverage','utensils','Coffee, drinks, cakes, cookies, desserts, snacks, meals, packaged food'),
  ('Handcraft / Art','palette','Paintings, prints, pottery, crochet, candles, resin art, handmade décor'),
  ('Fashion','shopbag','Clothing, thrift wear, upcycled fashion, tote bags, scarves, batik'),
  ('Jewellery','sparkles','Earrings, bracelets, necklaces, rings, beaded & clay accessories'),
  ('Beauty & Wellness','droplet','Handmade soap, body scrub, balm, perfume, essential oils, bath'),
  ('Home & Lifestyle','home','Home décor, tableware, room fragrance, plants, dried flowers, gifts'),
  ('Creative Services / Experience','pen','Portrait drawing, calligraphy, henna, workshops, live painting'),
  ('Books / Stationery','file','Zines, journals, notebooks, postcards, stickers, bookmarks, planners'),
  ('Others','folder','Any product or service not listed above')
on conflict do nothing;
```

**Create the first super-admin** (self-signup can only ever make a `vendor` —
admins are promoted by hand, on purpose):

1. Dashboard → **Authentication → Users → Add user** → create one with the
   organiser's email + a password (tick "Auto Confirm").
2. Back in the SQL Editor, promote it:
   ```sql
   update public.profiles set role = 'super', name = 'Siti Aminah'
   where id = (select id from auth.users where email = 'ORGANISER_EMAIL_HERE');
   ```

## 3. Auth settings

Authentication → **Providers → Email**: keep **Email** enabled. For launch,
decide on email confirmation:
- **On** (recommended for production) — vendors must confirm before signing in.
- **Off** (fine while testing) — Authentication → **Sign In / Providers →** turn
  off "Confirm email" so test signups work instantly.

## 4. Verify RLS (quick smoke test)

In the SQL Editor these run as the table owner (RLS bypassed), so instead verify
from the app once auth is wired (next batch). The policy intent:
- **anon** (logged out): can read `events` + `categories` only. No vendor/payment access.
- **vendor** (logged in): reads only their own vendor/application/payment/deposit rows.
- **admin**: full access via `is_admin()`.

## Still to come (next batches)
- Migration 0002: offences, vendor passes, parking, profile-change requests,
  activity log, site content + **Storage buckets** (private for docs/payment
  files/pass photos; signed URLs).
- Wiring the app: replace the in-memory store reads/writes with Supabase queries,
  starting with **auth** (real signup/login/session) then feature-by-feature.
