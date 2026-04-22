# Database Audit - 2026-04-19

This audit was cross-checked against the live Supabase public tables through direct REST queries and the current page implementations in `src/pages/`.

## Verified public tables

### `circuits`
- `circuit_id`
- `name`
- `locality`
- `country`
- `lat`
- `long`
- `length`
- `turns`
- `direction`
- `first_race`
- `total_races`
- `race_laps`
- `total_distance`
- `lap_record`
- `lap_record_driver`
- `lap_record_year`
- `created_at`

### `constructors`
- `constructor_id`
- `name`
- `nationality`
- `founded_year`
- `total_race_entries`
- `total_wins`
- `total_podiums`
- `total_pole_positions`
- `total_fastest_laps`
- `total_championships`
- `created_at`

### `drivers`
- `driver_id`
- `first_name`
- `last_name`
- `code`
- `permanent_number`
- `date_of_birth`
- `nationality`
- `total_race_entries`
- `total_race_starts`
- `total_wins`
- `total_podiums`
- `total_pole_positions`
- `total_fastest_laps`
- `total_championships`
- `created_at`

### `qualifying_results`
- `id`
- `race_id`
- `driver_id`
- `constructor_id`
- `position`
- `q1_time`
- `q2_time`
- `q3_time`
- `created_at`

### `race_results`
- `id`
- `race_id`
- `driver_id`
- `constructor_id`
- `position`
- `grid_position`
- `points`
- `laps`
- `status`
- `time`
- `fastest_lap_rank`
- `fastest_lap_time`
- `created_at`

### `races`
- `id`
- `season`
- `round`
- `race_name`
- `circuit_id`
- `date`
- `time`
- `is_sprint_weekend`
- `created_at`

### `seasons`
- `year`
- `created_at`

## Page-visible fields not yet persisted in base tables

### `drivers`
- `total_points`
- `best_race_finish_position`

### `constructors`
- `total_points`
- `best_race_finish_position`

### `races`
- `circuit_name`
- `locality`
- `country`

## Derived fields intentionally left out of base tables

- Current season standings values
- Recent team / latest season labels
- Championship season lists
- Season trend chart data
- Joined driver / constructor names in result tables
