![SafeBed cover](public/next.svg)

# SafeBed · Homeless Aid Locator

SafeBed is a mobile-first Next.js app that helps outreach workers and unhoused neighbours quickly discover nearby shelters, warming/cooling centres, food programs, and outreach teams. It uses Supabase (Postgres + PostGIS) for location data and MapLibre GL JS for mapping.

## Stack

- Next.js 16 · TypeScript · App Router
- Tailwind CSS 4
- React Query for caching/offline fallback
- Supabase (Postgres/PostGIS) with RPC for geo search
- MapLibre GL JS

## Local Setup

```bash
git clone <repo>
cd safebed
npm install
cp .env.example .env.local   # already filled in this repo with your Supabase keys
npm run dev
```

Visit `http://localhost:3000`, allow geolocation, and start filtering results.

## Supabase configuration

The project already includes SQL you can paste directly into the Supabase SQL Editor:

- `supabase/schema.sql` – enables PostGIS/pgcrypto, creates enum types, the `locations` table (with generated latitude/longitude), triggers, indexes, and the `nearby_locations` RPC returning lat/lng plus filters.
- `supabase/seed.sql` – three high-quality Toronto sample records.

Steps:

1. Open Supabase → your SafeBed project → SQL editor.
2. Paste the contents of `supabase/schema.sql` and run it once.
3. Optional: run `supabase/seed.sql` for starter data.
4. Table Editor → `locations` → confirm rows and geometry exist.

> Need more data? Drop CSVs into Supabase Table Editor. Ensure you set `geom` with `ST_SetSRID(ST_MakePoint(lng, lat),4326)::geography`.

## Environment variables

`.env.local` is already populated with:

- `NEXT_PUBLIC_SUPABASE_URL=https://plnmcmdkndoiynpzzqox.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=…`

Feel free to rotate and update them; `.env.example` should mirror any future changes.

## Useful scripts

| Command         | Description                     |
| --------------- | -------------------------------- |
| `npm run dev`   | Start local dev server          |
| `npm run lint`  | Run ESLint                      |
| `npm run build` | Production build (Next.js)      |

## Project layout

```
src/
  app/
    api/locations/route.ts   // RPC-backed nearby search with mock fallback
    page.tsx                 // map + filters + list UI
    providers.tsx            // React Query provider
  components/
    map-view.tsx             // MapLibre integration
  data/mock-locations.ts     // Offline fallback dataset
  lib/supabase.ts            // Supabase client factory
  types/locations.ts         // Shared data contracts
  utils/{geo,hours}.ts       // Distance + open-now helpers
supabase/
  schema.sql
  seed.sql
```

## Next steps

1. Expand the Supabase dataset (bulk CSV import or partner forms) and keep `last_verified_at` fresh.
2. Add Supabase Auth + `/admin` update portal for partner organizations.
3. Layer in offline caching (IndexedDB) for field workers with spotty service.

Have fun, and stay warm! 💙
