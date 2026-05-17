# Database Completeness Audit

Generated: 2026-05-10T11:23:38.636Z

This report checks display-critical Supabase tables for missing values. It does not print credentials or raw sensitive data.

## Summary

| Table | Rows | Blocking/P0 Missing Fields | P1 Missing Fields | Notes |
|---|---:|---:|---:|---|
| circuits | 79 | 0 | 5 | OK |
| drivers | 916 | 0 | 1 | OK |
| constructors | 187 | 0 | 2 | OK |
| races | 1171 | 0 | 0 | OK |
| race_results | 27240 | 1 | 0 | OK |
| qualifying_results | 26738 | 1 | 0 | OK |
| race_session_results | 78 | 0 | 0 | OK |
| fastf1_session_analytics | 54 | 0 | 0 | OK |
| driver_history_summary | 916 | 0 | 1 | OK |
| constructor_history_summary | 187 | 0 | 1 | OK |

## Field Details

### circuits

| Severity | Field | Missing | Missing % | Display Impact | Samples |
|---|---|---:|---:|---|---|
| P1 | location | 1 | 1.3% | Circuit subtitle loses city/locality. | valencia_street |
| P1 | country | 1 | 1.3% | Circuit subtitle loses country. | valencia_street |
| P1 | length | 1 | 1.3% | Circuit detail length shows pending data. | valencia_street |
| P1 | turns | 1 | 1.3% | Circuit detail turn count falls back or shows pending data. | valencia_street |
| P1 | direction | 1 | 1.3% | Circuit detail direction can show pending data or rely on local fallback. | valencia_street |
| P2 | race_laps | 31 | 39.2% | Length derivation from race distance is less reliable. | anderstorp, avus, bremgarten, buenos_aires, bugatti, clermont_ferrand, detroit, dijon |
| P2 | total_distance | 31 | 39.2% | Circuit detail race distance shows pending data. | anderstorp, avus, bremgarten, buenos_aires, bugatti, clermont_ferrand, detroit, dijon |
| P2 | lap_record | 31 | 39.2% | Lap record panel is hidden. | anderstorp, avus, bremgarten, buenos_aires, bugatti, clermont_ferrand, detroit, dijon |
| P2 | coordinates | 1 | 1.3% | Maps or location metadata cannot be added reliably. | valencia_street |

### drivers

| Severity | Field | Missing | Missing % | Display Impact | Samples |
|---|---|---:|---:|---|---|
| P1 | total_race_starts | 916 | 100.0% | Driver stat cards may show zero or pending data. | andre_simon, bobby_ball, bayliss_levrett, alberto_crespo, andre_pilette, adolfo_schwelm_cruz, albert_scherrer, alfonso_de_portago |

### constructors

| Severity | Field | Missing | Missing % | Display Impact | Samples |
|---|---|---:|---:|---|---|
| P1 | nationality | 187 | 100.0% | Constructor profile nationality and search subtitles degrade. | alta, life, frazer_nash, bar, alpine, haas, marchese, balsa |
| P1 | total_race_entries | 187 | 100.0% | Constructor stat cards may show zero or pending data. | alta, life, frazer_nash, bar, alpine, haas, marchese, balsa |

### races

| Severity | Field | Missing | Missing % | Display Impact | Samples |
|---|---|---:|---:|---|---|
| P2 | time | 1101 | 94.0% | Race time may show date-only fallback. | 30, 13, 38, 44, 14, 45, 42, 12 |

### race_results

| Severity | Field | Missing | Missing % | Display Impact | Samples |
|---|---|---:|---:|---|---|
| P0 | position | 10808 | 39.7% | Result tables cannot sort/display positions. | 88, 89, 90, 91, 92, 93, 94, 95 |

### qualifying_results

| Severity | Field | Missing | Missing % | Display Impact | Samples |
|---|---|---:|---:|---|---|
| P0 | position | 133 | 0.5% | Qualifying tables cannot sort/display positions. | 9064, 11227, 11317, 11946, 16568, 15733, 15843, 15970 |
| P2 | lap_time | 18423 | 68.9% | Qualifying time columns are sparse. | 1, 2, 3, 4, 5, 6, 7, 8 |

### race_session_results

| Severity | Field | Missing | Missing % | Display Impact | Samples |
|---|---|---:|---:|---|---|
| - | - | 0 | 0.0% | No missing display-critical fields found. | - |

### fastf1_session_analytics

| Severity | Field | Missing | Missing % | Display Impact | Samples |
|---|---|---:|---:|---|---|
| - | - | 0 | 0.0% | No missing display-critical fields found. | - |

### driver_history_summary

| Severity | Field | Missing | Missing % | Display Impact | Samples |
|---|---|---:|---:|---|---|
| P1 | seasons | 56 | 6.1% | History season table is incomplete. | adderly_fong, enrico_toccacelo, cian_shields, frederik_vesti, fabio_leimer, roy_nissany, satoshi_motoyama, alex_palou |

### constructor_history_summary

| Severity | Field | Missing | Missing % | Display Impact | Samples |
|---|---|---:|---:|---|---|
| P1 | seasons | 2 | 1.1% | History season table is incomplete. | first, del_roy |
