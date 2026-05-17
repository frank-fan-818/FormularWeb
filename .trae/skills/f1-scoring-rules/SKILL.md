---
name: "f1-scoring-rules"
description: "F1 historical scoring rules reference. Invoke when calculating season standings, fixing championship data, or implementing historical scoring logic for seasons before 1991."
---

# F1 Historical Scoring Rules

This skill provides comprehensive reference for F1 historical scoring systems and rules used across different eras. Use this when implementing or fixing season standings, championship calculations, or historical data aggregation.

## When to Invoke

- Calculating or verifying season championship standings
- Fixing incorrect championship results (e.g., 1988 Prost vs Senna)
- Implementing historical scoring logic in `historySummaryAggregation.ts`
- Backfilling or correcting race result data
- User reports incorrect championship winner or points

## Scoring Eras Reference

### 1. Point Systems by Era

| Era | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th | 9th | 10th | Fastest Lap |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|------|-------------|
| 1950-1959 | 8 | 6 | 4 | 3 | 2 | - | - | - | - | - | +1 point |
| 1960-1990 | 9 | 6 | 4 | 3 | 2 | 1 | - | - | - | - | None |
| 1991-2002 | 10 | 6 | 4 | 3 | 2 | 1 | - | - | - | - | None |
| 2003-2009 | 10 | 8 | 6 | 5 | 4 | 3 | 2 | 1 | - | - | None |
| 2010-2018 | 25 | 18 | 15 | 12 | 10 | 8 | 6 | 4 | 2 | 1 | None |
| 2019-present | 25 | 18 | 15 | 12 | 10 | 8 | 6 | 4 | 2 | 1 | +1 point (if P1-P10) |

### 2. Drop-score System (Best-N Races)

This is the most critical rule that caused the 1988 Prost/Senna bug.

| Years | Rule | Example |
|-------|------|---------|
| 1950-1953 | All races count | No drop |
| 1954-1959 | Best 4-5 races | 1954: 9 races, best 5 count |
| 1960-1966 | Best 6 races | 10 races, best 6 count |
| 1967-1978 | First half: best 5 of 6; Second half: best 4 of 6 | Total 9 best |
| 1979-1980 | Best 7 races | 15 races, best 7 count |
| 1981-1990 | Best 11 races | 16 races, best 11 count |
| 1991-present | All races count | No drop |

### 3. Famous Cases Affected by Drop-score

#### 1988 Season (Most Notable)
- **Total races**: 16
- **Rule**: Best 11 count
- **Senna**: 8 wins, 1 second, 1 DNF = 105 total, **90 best-11**
- **Prost**: 7 wins, 8 seconds, 1 third = 105 total, **87 best-11**
- **Champion**: Senna (90 > 87)
- **Bug cause**: Code summed all 16 races, making Prost appear to have more points

#### 1984 Season
- **Rule**: Best 11 of 16 races
- **Lauda**: Won by just 0.5 points over Prost
- Without drop-score, result would be different

#### 1962 Season
- **Rule**: Best 5 of 9 races (actually best 6 per some sources)
- **Hill vs. Clark**: Drop-score determined the championship

### 4. Shared Car Era (1950-1957)

- Multiple drivers could share one car during a race
- Points were **split equally** among drivers
- Example: If a car finished 1st (9 points), two drivers each got 4.5 points
- This also counted toward the "best-N" calculation

### 5. Sprint Race Points (Modern Era)

| Year | Format | Points Distribution |
|------|--------|---------------------|
| 2021 | Top 3 | 3-2-1 |
| 2022 | Top 4 | 8-7-6-5 |
| 2023-present | Top 8 | 8-7-6-5-4-3-2-1 |

### 6. Half Points Rule

| Era | Condition |
|-----|-----------|
| Historical | Race completed < 75% distance = half points |
| 2021 Belgium | Controversial 2-lap race, half points awarded |
| 2022+ | Revised sliding scale based on laps completed |

## Implementation Guide

### For `historySummaryAggregation.ts`

When calculating season standings, apply these rules:

```typescript
function getDropScoreRule(year: number): { totalRaces: number; bestCount: number } {
  if (year >= 1981 && year <= 1990) {
    return { totalRaces: 16, bestCount: 11 }; // 1981-1990: best 11
  }
  if (year >= 1979 && year <= 1980) {
    return { totalRaces: 15, bestCount: 7 };  // 1979-1980: best 7
  }
  if (year >= 1967 && year <= 1978) {
    return { totalRaces: 12, bestCount: 9 };  // Split season rule
  }
  if (year >= 1960 && year <= 1966) {
    return { totalRaces: 10, bestCount: 6 };  // Best 6
  }
  // 1991+ and 1950-1953: all races count
  return { totalRaces: 0, bestCount: 0 };
}

function calculateBestNScore(raceResults: RaceResult[], bestCount: number): number {
  if (bestCount === 0) {
    // All races count
    return raceResults.reduce((sum, r) => sum + r.points, 0);
  }

  // Sort by points descending, take best N
  const sorted = [...raceResults].sort((a, b) => b.points - a.points);
  return sorted.slice(0, bestCount).reduce((sum, r) => sum + r.points, 0);
}
```

### For Database Backfill

When fixing existing data in `race_results` table:

1. Identify seasons with drop-score rules (1954-1990)
2. For each driver in affected seasons:
   - Calculate total points from all races
   - Apply best-N rule to get championship points
   - Update `driver_history_summary.seasons` JSON with correct positions

### Testing Checklist

- [ ] 1988: Senna should be champion (90 pts vs Prost 87 pts)
- [ ] 1984: Lauda should win by 0.5 points
- [ ] 1991+: All races should count (no drop-score)
- [ ] Pre-1950: No official championship
- [ ] Shared car era (1950-1957): Points split correctly

## Related Files

- `src/utils/historySummaryAggregation.ts` - Main aggregation logic
- `src/api/historyProfiles.ts` - Driver/constructor history profiles
- `src/pages/DriverHistoryDetail.tsx` - Championship display
- `scripts/backfill-history-summaries.ts` - Data backfill script
- `src/api/ergast.ts` - External API fallback

## Notes

- The Jolpi.ca/Ergast API returns **official championship points** (already applied drop-score rules)
- Our Supabase `race_results` table stores **raw race points** (no drop-score applied)
- The bug occurs when we aggregate from `race_results` instead of using official standings
- **Recommended fix**: Use official API standings for historical seasons, or implement drop-score logic in aggregation
