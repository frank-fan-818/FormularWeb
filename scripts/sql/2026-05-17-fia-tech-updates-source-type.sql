-- Allow FIA news-page technical update records to share the upgrade table.

alter table public.fia_car_upgrades
  drop constraint if exists fia_car_upgrades_source_type_check;

alter table public.fia_car_upgrades
  add constraint fia_car_upgrades_source_type_check
    check (source_type in ('FIA', 'FIA_TECH_UPDATE'));
