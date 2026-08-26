import assert from 'node:assert/strict';
import test from 'node:test';
import { findIncompleteEligibleSessions } from './fastf1-manifest-policy.mjs';

const manifest = {
  rounds: [
    {
      round: 1,
      eventName: 'Opening GP',
      sessions: [
        { session: 'R', eligible: true, complete: true, path: '1/R.json' },
        { session: 'Q', eligible: true, complete: false, path: '1/Q.json' },
      ],
    },
    {
      round: 2,
      eventName: 'Future GP',
      sessions: [{ session: 'R', eligible: false, complete: false, path: '2/R.json' }],
    },
  ],
};

test('reports incomplete sessions only after they become eligible', () => {
  assert.deepEqual(findIncompleteEligibleSessions(manifest), [{
    round: 1,
    eventName: 'Opening GP',
    session: 'Q',
    path: '1/Q.json',
  }]);
});
test('supports manual verification scoped to one round', () => {
  assert.deepEqual(findIncompleteEligibleSessions(manifest, 2), []);
});
