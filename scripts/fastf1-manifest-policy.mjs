export function findIncompleteEligibleSessions(manifest, round) {
  const selectedRound = round ? Number(round) : null;
  return (manifest?.rounds || []).flatMap((race) => {
    if (selectedRound && Number(race.round) !== selectedRound) return [];
    return (race.sessions || [])
      .filter((session) => session.eligible && !session.complete)
      .map((session) => ({
        round: Number(race.round),
        eventName: String(race.eventName || ''),
        session: String(session.session || ''),
        path: String(session.path || ''),
      }));
  });
}
