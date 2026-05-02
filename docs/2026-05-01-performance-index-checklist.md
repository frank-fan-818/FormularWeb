# Performance Index Checklist

This is a non-destructive checklist for Supabase/Postgres performance review. Confirm these indexes exist before changing application architecture.

```sql
create index if not exists drivers_driver_id_idx
  on public.drivers (driver_id);

create index if not exists constructors_constructor_id_idx
  on public.constructors (constructor_id);

create index if not exists circuits_circuit_id_idx
  on public.circuits (circuit_id);

create index if not exists races_season_round_idx
  on public.races (season, round);

create index if not exists races_circuit_season_round_idx
  on public.races (circuit_id, season, round);

create index if not exists race_results_race_position_idx
  on public.race_results (race_id, position);

create index if not exists qualifying_results_race_position_idx
  on public.qualifying_results (race_id, position);

create index if not exists fastf1_session_analytics_lookup_idx
  on public.fastf1_session_analytics (season, round, session);
```

Run `explain analyze` against slow Supabase requests before adding duplicate indexes in production.
