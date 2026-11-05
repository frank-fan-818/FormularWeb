import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePitTranslation } from '@/hooks/usePitTranslation';
import { useRacePitStops } from '@/hooks/usePitStops';
import { filterPitRecords, formatPitLaneTime } from '@/utils/pitStops';
import { PitDataState } from './PitDataState';
import { PitDriver } from './PitDriver';
import './pitStops.css';

export default function RacePitStops({ season, round, pending }: { season: string; round: string; pending: boolean }) {
  const { t } = usePitTranslation();
  const { data, loading, error, retry } = useRacePitStops(season, round, !pending && Number(season) >= 2011);
  const [driver, setDriver] = useState(''); const [team, setTeam] = useState(''); const [sort, setSort] = useState('lap');
  const records = data?.records || [];
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== '#race-pit-title' || loading) return;
    const frame = requestAnimationFrame(() => document.getElementById('race-pit-title')?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [hash, loading]);
  const quickest = records.reduce<(typeof records)[number] | undefined>((best, row) =>
    row.stopDuration !== null && (!best || Number(row.stopDuration) < Number(best.stopDuration)) ? row : best, undefined);
  const activeSort = !quickest && sort === 'stop' ? 'lap' : sort;
  const rows = filterPitRecords(records, driver, team, activeSort);
  const drivers = [...new Map(records.map(row => [row.driverId, row])).values()];
  const teams = [...new Map(records.map(row => [row.constructorId, row.team])).entries()];
  return <section className="pit-module" aria-labelledby="race-pit-title">
    <header className="pit-heading"><h2 id="race-pit-title">{t('pitPerformance')}</h2>{Number(season) >= 2018 && <Link className="pit-link" to={`/pit-stops?season=${season}&round=${round}&view=event`}>{t('pitDhlLink')} →</Link>}</header>
    {quickest && <div className="pit-quickest">
      <div>
        <div className="pit-quickest-label">{t('pitQuickestRecorded')}</div>
        <PitDriver name={quickest.driver} team={quickest.team} driverId={quickest.driverId} />
      </div>
      <div className="pit-quickest-time">{quickest.stopDuration} s<span className="pit-secondary">{t('pitLap')} {quickest.lap}</span></div>
    </div>}
    {!!records.length && !quickest && !data?.partial && <p className="pit-timing-note">{t('pitNoStationaryTiming')}</p>}
    {!!records.length && <div className="pit-toolbar">
      <select aria-label={t('driver')} value={driver} onChange={e => setDriver(e.target.value)}><option value="">{t('pitAllDrivers')}</option>{drivers.map(row => <option key={row.driverId} value={row.driverId}>{row.driver}</option>)}</select>
      <select aria-label={t('constructor')} value={team} onChange={e => setTeam(e.target.value)}><option value="">{t('pitAllTeams')}</option>{teams.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select aria-label={t('pitSort')} value={activeSort} onChange={e => setSort(e.target.value)}><option value="lap">{t('pitByLap')}</option>{quickest && <option value="stop">{t('pitStationary')}</option>}<option value="lane">{t('pitLane')}</option></select>
    </div>}
    <PitDataState loading={loading} error={error} stale={data?.stale} empty={!records.length} pending={pending} onRetry={retry} />
    {!!records.length && <>
      <table className="pit-table pit-record-table"><thead><tr><th scope="col">{t('driver')}</th><th scope="col">{t('pitLapStop')}</th>{quickest && <th scope="col" className="pit-number">{t('pitStationary')}</th>}<th scope="col" className="pit-number">{t('pitLane')}</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.driverId}:${row.stop}`}>
        <td><PitDriver name={row.driver} team={row.team} driverId={row.driverId} code={row.code} /></td>
        <td><span className="pit-lap">L{row.lap}</span><span className="pit-secondary">{t('pitStopNumber', { n: row.stop })}</span></td>
        {quickest && <td className="pit-number pit-emphasis">{row.stopDuration === null ? '—' : `${row.stopDuration} s`}</td>}<td className="pit-number">{formatPitLaneTime(row.laneDuration)}</td>
      </tr>)}</tbody></table>
      {!rows.length && <div className="pit-state">{t('pitNoMatch')}</div>}
      {data?.partial && <div className="pit-state">{t('pitStaticUnavailable')}<button type="button" onClick={retry} disabled={loading}>{t('pitRetry')}</button></div>}
      <details className="pit-source"><summary>{t('pitSource')}</summary><p>{t('pitTimingExplanation')}</p><a href={`https://api.jolpi.ca/ergast/f1/${season}/${round}/pitstops/`} target="_blank" rel="noreferrer">Jolpica ↗</a> · <a href="https://openf1.org/docs/#pit" target="_blank" rel="noreferrer">OpenF1 ↗</a></details>
    </>}
  </section>;
}
