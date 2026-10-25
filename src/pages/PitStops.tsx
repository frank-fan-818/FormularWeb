import { Link, useSearchParams } from 'react-router-dom';
import DocumentHead from '@/components/DocumentHead';
import { PitDataState } from '@/components/pitStops/PitDataState';
import { usePitAward } from '@/hooks/usePitStops';
import { useSeasonRacesCached } from '@/hooks/useSeasonDataCached';
import { useAppStore } from '@/store';
import { usePitTranslation } from '@/hooks/usePitTranslation';
import '@/components/pitStops/pitStops.css';

export default function PitStops() {
  const { t } = usePitTranslation();
  const currentSeason = useAppStore(state => state.currentSeason);
  const [params, setParams] = useSearchParams();
  const season = /^20\d{2}$/.test(params.get('season') || '') ? params.get('season')! : currentSeason;
  const eventView = params.get('view') === 'event';
  const fastestView = params.get('view') === 'fastest';
  const { races, loading: racesLoading, error: racesError, refetch } = useSeasonRacesCached(season);
  const completed = races.filter(race => Date.parse(`${race.date}T${race.time || '00:00:00Z'}`) < Date.now());
  const round = /^[1-9]\d?$/.test(params.get('round') || '') ? params.get('round')! : completed[completed.length - 1]?.round || races[0]?.round || '';
  const { data, loading, error, retry } = usePitAward(season, eventView ? round : '', !eventView || !!round);
  const seasons = [...new Set([Number(season), ...(data?.seasons || [])])].sort((a,b) => b-a);
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key,value]) => value ? next.set(key,value) : next.delete(key));
    setParams(next);
  };
  const rows = eventView ? data?.stops || [] : fastestView ? data?.seasonFastest || [] : data?.standings || [];
  const leader = data?.standings[0]?.points || 0;
  return <div className="pit-page">
    <DocumentHead title="DHL Pit Stop Award — F1 Dashboard" />
    <header className="pit-heading pit-page-heading"><h1>DHL Pit Stop Award</h1><select aria-label={t('season')} value={season} onChange={e => update({ season: e.target.value, round: '' })}>{seasons.map(year => <option key={year} value={year}>{year}</option>)}</select></header>
    <div className="pit-view-tabs" role="group" aria-label={t('pitTitle')}>
      <button type="button" aria-pressed={!eventView && !fastestView} onClick={() => update({ view: '', round: '' })}>{t('pitSeasonStandings')}</button>
      <button type="button" aria-pressed={eventView} onClick={() => update({ view: 'event' })}>{t('pitEventStandings')}</button>
      <button type="button" aria-pressed={fastestView} onClick={() => update({ view: 'fastest', round: '' })}>{t('pitSeasonFastest')}</button>
    </div>
    {eventView && <div className="pit-toolbar pit-event-toolbar"><select aria-label={t('races')} value={round} onChange={e => update({ round: e.target.value })} disabled={!races.length}>
      {!races.length && <option value="">{t(racesLoading ? 'pitLoading' : 'pitEmpty')}</option>}{races.map(race => <option key={race.round} value={race.round}>{race.round} · {race.raceName}</option>)}
    </select>{round && <Link className="pit-link" to={`/races/${round}/results?season=${season}#race-pit-title`}>{t('pitDetails')} →</Link>}</div>}
    {eventView && racesError && !races.length ? <PitDataState loading={racesLoading} error empty onRetry={refetch} /> : <PitDataState loading={loading || (eventView && racesLoading && !round)} error={error} stale={data?.stale} empty={!rows.length} onRetry={retry} />}
    {!!rows.length && (fastestView ? <table className="pit-table pit-fastest-table"><thead><tr><th className="pit-rank">{t('rank')}</th><th>{t('driver')}</th><th>{t('pitEvent')}</th><th className="pit-number">{t('pitOfficialTime')}</th></tr></thead><tbody>{data!.seasonFastest.map(row => <tr key={row.id}>
      <td>{row.rank}</td><td><span className="pit-driver-name">{row.driver}</span><span className="pit-secondary">{row.team}</span></td><td title={row.event}><span className="pit-desktop">{row.event}</span><span className="pit-mobile">{row.eventAbbreviation}</span></td><td className="pit-number pit-emphasis">{row.duration} s</td>
    </tr>)}</tbody></table> : eventView ? <table className="pit-table pit-award-table"><thead><tr><th className="pit-rank">{t('rank')}</th><th>{t('driver')}</th><th className="pit-desktop">{t('pitLap')}</th><th className="pit-number">{t('pitOfficialTime')}</th><th className="pit-number pit-desktop">{t('points')}</th></tr></thead><tbody>{data!.stops.map(row => <tr key={row.id}>
      <td>{row.rank}</td><td><span className="pit-driver-name">{row.code || row.driver}</span><span className="pit-secondary">{row.team}</span>
        <details className="pit-row-details"><summary>{t('pitDetails')}</summary><span>{t('pitLap')}: {row.lap ?? '—'} · {t('points')}: {row.points}</span>{(row.irregular || row.notes) && <p>{row.notes || t('pitFlagged')}</p>}</details>
        {(row.irregular || row.notes) && <span className="pit-desktop pit-secondary">{row.notes || t('pitFlagged')}</span>}</td>
      <td className="pit-desktop">{row.lap ?? '—'}</td><td className="pit-number pit-emphasis">{row.duration} s</td><td className="pit-number pit-desktop">{row.points}</td>
    </tr>)}</tbody></table> : <table className="pit-table"><thead><tr><th className="pit-rank">{t('rank')}</th><th>{t('constructor')}</th><th className="pit-number">{t('points')}</th><th className="pit-number pit-desktop">{t('pitGap')}</th></tr></thead><tbody>{data!.standings.map(row => <tr key={row.team}>
      <td>{row.rank}</td><td>{row.team}<div className="pit-points-track" aria-hidden="true"><span style={{ width: `${leader ? row.points / leader * 100 : 0}%` }} /></div></td><td className="pit-number pit-emphasis">{row.points}</td><td className="pit-number pit-desktop">{leader === row.points ? '—' : leader-row.points}</td>
    </tr>)}</tbody></table>)}
    <a className="pit-source-link" href="https://inmotion.dhl/en/formula-1/fastest-pit-stop-award" target="_blank" rel="noreferrer">DHL ↗</a>
  </div>;
}
