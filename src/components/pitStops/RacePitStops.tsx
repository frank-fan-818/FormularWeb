import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePitTranslation } from '@/hooks/usePitTranslation';
import { useRacePitStops } from '@/hooks/usePitStops';
import { filterPitRecords } from '@/utils/pitStops';
import { PitDataState } from './PitDataState';
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
  const rows = filterPitRecords(records, driver, team, sort);
  const drivers = [...new Map(records.map(row => [row.driverId, row])).values()];
  const teams = [...new Map(records.map(row => [row.constructorId, row.team])).entries()];
  return <section className="pit-module" aria-labelledby="race-pit-title">
    <header className="pit-heading"><h2 id="race-pit-title">{t('pitPerformance')}</h2>{Number(season) >= 2018 && <Link className="pit-link" to={`/pit-stops?season=${season}&round=${round}&view=event`}>{t('pitDhlLink')} →</Link>}</header>
    {!!records.length && <div className="pit-toolbar">
      <select aria-label={t('driver')} value={driver} onChange={e => setDriver(e.target.value)}><option value="">{t('pitAllDrivers')}</option>{drivers.map(row => <option key={row.driverId} value={row.driverId}>{row.driver}</option>)}</select>
      <select aria-label={t('constructor')} value={team} onChange={e => setTeam(e.target.value)}><option value="">{t('pitAllTeams')}</option>{teams.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select aria-label={t('pitSort')} value={sort} onChange={e => setSort(e.target.value)}><option value="lap">{t('pitByLap')}</option><option value="stop">{t('pitStationary')}</option><option value="lane">{t('pitLane')}</option></select>
    </div>}
    <PitDataState loading={loading} error={error} stale={data?.stale} empty={!records.length} pending={pending} onRetry={retry} />
    {!!records.length && <>
      <table className="pit-table pit-record-table"><thead><tr><th>{t('driver')}</th><th>{t('pitLapStop')}</th><th className="pit-number">{t('pitStationary')}</th><th className="pit-number">{t('pitLane')}</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.driverId}:${row.stop}`}>
        <td><span className="pit-driver-name">{row.code || row.driver}</span><span className="pit-secondary">{row.team}</span></td>
        <td><span>L{row.lap}</span><span className="pit-secondary">{t('pitStopNumber', { n: row.stop })}</span></td>
        <td className="pit-number pit-emphasis">{row.stopDuration === null ? '—' : `${row.stopDuration} s`}</td><td className="pit-number">{row.laneDuration} s</td>
      </tr>)}</tbody></table>
      {!rows.length && <div className="pit-state">{t('pitNoMatch')}</div>}
      {data?.partial && <div className="pit-state">{t('pitStaticUnavailable')}<button type="button" onClick={retry} disabled={loading}>{t('pitRetry')}</button></div>}
      <details className="pit-source"><summary>{t('pitSource')}</summary><p>{t('pitTimingExplanation')}</p><a href={`https://api.jolpi.ca/ergast/f1/${season}/${round}/pitstops/`} target="_blank" rel="noreferrer">Jolpica ↗</a> · <a href="https://openf1.org/docs/#pit" target="_blank" rel="noreferrer">OpenF1 ↗</a></details>
    </>}
  </section>;
}
