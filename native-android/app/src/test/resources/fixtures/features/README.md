# Public API regression samples

Fetched read-only on 2026-10-27, using the same Android User-Agent.
No account credentials or member-only responses are included. Android packages do not contain test resources.

- `history.json`: public `driver_history_summary` for max_verstappen, Supabase REST.
- `upgrades.json`: two public `fia_car_upgrades` rows for 2025 round 1.
- `pit.json`: https://formular-web.vercel.app/api/pit-stops?kind=award&season=2025
- `archive-drivers.json`: https://api.jolpi.ca/ergast/f1/drivers.json?limit=100&offset=0
- `archive-circuits.json`: https://api.jolpi.ca/ergast/f1/circuits.json?limit=100&offset=0
- `circuit-history.json`: https://api.jolpi.ca/ergast/f1/circuits/monza/races.json?limit=100
- `driver-season.json`: https://api.jolpi.ca/ergast/f1/2025/drivers/max_verstappen/results.json?limit=100
- `constructor-season.json`: https://api.jolpi.ca/ergast/f1/2025/constructors/mercedes/results.json?limit=100
- `news-*.xml`: https://formular-web.vercel.app/news-feed/{motorsport,fia,reddit}
  Reduced to two entries containing only title, link, date and identity metadata. Article content is excluded.
