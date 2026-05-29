-- Add practice session support to fastf1_session_analytics table.
-- Required by: scripts/export-fastf1-season-data.py (FP1/FP2/FP3 export)
--             scripts/import-fastf1-session-analytics.ts (FP1/FP2/FP3 import)

alter table public.fastf1_session_analytics
  drop constraint if exists fastf1_session_analytics_session_check;

alter table public.fastf1_session_analytics
  add constraint fastf1_session_analytics_session_check
    check (session in ('R', 'Q', 'SQ', 'SS', 'S', 'FP1', 'FP2', 'FP3'));
