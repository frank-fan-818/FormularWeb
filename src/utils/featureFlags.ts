/**
 * Lightweight Feature Flags for the F1 dashboard.
 *
 * Priority (highest to lowest):
 *   1. URL search params   ?features=disable:fastf1-telemetry,fastf1-weather
 *   2. Zustand store        (persisted in localStorage via persist middleware)
 *   3. Module defaults      (all enabled)
 */

import { useAppStore } from '@/store';

export type FeatureFlag =
  | 'fastf1-telemetry'
  | 'fastf1-weather'
  | 'fastf1-duel'
  | 'race-predictions';

const DEFAULTS: Record<FeatureFlag, boolean> = {
  'fastf1-telemetry': true,
  'fastf1-weather': true,
  'fastf1-duel': true,
  'race-predictions': true,
};

/**
 * Parse `?features=disable:fastf1-telemetry,fastf1-weather` from the URL.
 * Features prefixed with `disable:` are returned as disabled.
 */
function getURLDisabledFeatures(): Set<FeatureFlag> {
  if (typeof window === 'undefined') return new Set();

  const params = new URLSearchParams(window.location.search);
  const raw = params.get('features');
  if (!raw) return new Set();

  const disabled = new Set<FeatureFlag>();
  const parts = raw.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('disable:')) {
      const name = trimmed.slice('disable:'.length).trim() as FeatureFlag;
      if (name in DEFAULTS) {
        disabled.add(name);
      }
    }
    // Non-prefixed parts are ignored (leave at store / default).
  }

  return disabled;
}

/**
 * Check whether a feature flag is enabled.
 *
 * Usage:
 *   if (isFeatureEnabled('fastf1-telemetry')) { ... }
 */
export function isFeatureEnabled(feature: FeatureFlag): boolean {
  // 1. URL params (highest priority)
  const urlDisabled = getURLDisabledFeatures();
  if (urlDisabled.has(feature)) return false;

  // 2. Zustand store (persisted in localStorage)
  try {
    const state = useAppStore.getState();
    if (state.features && feature in state.features) {
      return state.features[feature] ?? DEFAULTS[feature];
    }
  } catch {
    // Store not available yet — fall through to defaults
  }

  // 3. Module defaults (lowest priority)
  return DEFAULTS[feature];
}
