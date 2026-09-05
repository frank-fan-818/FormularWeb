"""Classification support missing from FastF1 3.8.3's practice loader."""
import pandas as pd


def session_load_options(code: str, results_only=False, laps_only=False) -> dict:
    timed = code.upper() in {'FP1', 'FP2', 'FP3', 'Q', 'SQ', 'SS'}
    return {
        'laps': timed or not results_only,
        'messages': timed or (not results_only and not laps_only),
        'telemetry': not results_only and not laps_only,
        'weather': not results_only and not laps_only,
    }


def practice_results(results: pd.DataFrame, laps: pd.DataFrame) -> pd.DataFrame:
    """Rank non-deleted best times; untimed drivers remain unclassified.

    Mirrors upstream's practice calculation, adding total completed laps and
    stable first-achieved tie ordering. Never treats unknown deleted status as valid.
    """
    if laps.empty:
        return results.copy()
    if 'Deleted' not in laps or laps['Deleted'].isna().any():
        raise ValueError('Practice classification requires known deleted lap status')
    output = results.copy().set_index('DriverNumber', drop=False)
    output['Laps'] = laps.groupby('DriverNumber')['LapNumber'].max()
    valid = laps[laps['LapTime'].notna() & ~laps['Deleted'].astype(bool)].copy()
    for column in ('PitOutTime', 'PitInTime'):
        if column in valid:
            valid = valid[valid[column].isna()]
    if 'FastF1Generated' in valid:
        valid = valid[~valid['FastF1Generated'].fillna(False).astype(bool)]
    sort_columns = ['LapTime'] + (['Time'] if 'Time' in valid else [])
    best = valid.sort_values(sort_columns, kind='stable').drop_duplicates('DriverNumber')
    best = best.set_index('DriverNumber')
    output['Time'] = best['LapTime']
    output['Position'] = pd.Series(range(1, len(best) + 1), index=best.index, dtype=float)
    return output.sort_values('Position', kind='stable', na_position='last')
