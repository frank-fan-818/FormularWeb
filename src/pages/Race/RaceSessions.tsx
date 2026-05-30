import { useRaceData } from './RaceContext';

const RaceSessions = () => {
  const { raceInfo, activeTab, qualifyingResults, raceResults } = useRaceData();

  return (
    <div>
      <h2>Race Sessions</h2>
      {raceInfo ? (
        <p>{raceInfo.raceName} — Sessions content coming soon.</p>
      ) : (
        <p>Loading race data...</p>
      )}
      <p>Active tab: {activeTab}</p>
      <p>Qualifying results: {qualifyingResults.length} entries</p>
      <p>Race results: {raceResults.length} entries</p>
    </div>
  );
};

export default RaceSessions;
