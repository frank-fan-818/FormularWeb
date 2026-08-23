# FormularOneWeb Motion System

## Product intent

Motion communicates cause, hierarchy, continuity, and system state. It must never make primary information wait, compete with telemetry, or create motion without a user-visible reason.

The visual character is a professional race-control interface: precise, restrained, fast, and information-led.

## Motion hierarchy

1. **Primary content:** visible on the first frame. Route and masthead movement uses transform only so headings remain readable and LCP is not held behind an opacity animation.
2. **Secondary sections:** enter once with a short opacity-and-translation transition to explain page hierarchy.
3. **Repeated data:** cards and rows use capped stagger delays. Items after the first six share the final delay so long lists never feel slow.
4. **Direct manipulation:** buttons compress on press; cards move only on hover-capable devices; tabs and navigation indicators preserve spatial continuity.
5. **Live state:** only genuinely live elements may repeat. Decorative dots must remain static.
6. **Loading state:** skeleton scans and route timing lines indicate work without blocking content or causing layout shift.

## Tokens

Use the semantic tokens in `src/styles/design-tokens.css` instead of literal durations or easing values:

- `--motion-duration-instant`: press feedback
- `--motion-duration-fast`: color and small-control state changes
- `--motion-duration-standard`: cards, rows, and ordinary components
- `--motion-duration-route`: route continuity
- `--motion-duration-data`: deliberate data and masthead choreography
- `--motion-duration-ambient`: skeletons and genuinely live status only
- `--motion-ease-standard`: reversible state changes
- `--motion-ease-enter`: entrances
- `--motion-ease-exit`: exits
- `--motion-ease-emphasized`: tabs and important spatial changes

## Implementation rules

- Prefer `transform` and `opacity`; never animate layout properties unless spatial continuity requires it.
- Never use `transition: all`.
- Never hide a primary heading, core metric, or LCP candidate behind an opacity entrance.
- Keep route animation on `.motion-route-shell` so the sidebar and header do not remount.
- Add reusable behavior to `src/styles/motion-system.css`, not isolated page keyframes.
- ECharts animation is owned by `EChartsPanel`; do not define inconsistent per-chart timings.
- Hover elevation applies only under `(hover: hover) and (pointer: fine)`.
- Repeating animation requires a live or loading semantic state.
- Every new motion must remain understandable when removed.

## Accessibility and performance

`prefers-reduced-motion: reduce` disables route, component, overlay, live-state, skeleton, and chart animations. The React hook `useReducedMotion` is reserved for libraries whose motion cannot be controlled by CSS.

The production performance gate verifies that the built HTML contains the route motion token and the reduced-motion contract. Browser QA verifies that the route shell is fully opaque during normal entry and has no animation or transform under reduced motion.

## Review checklist

- Does the movement explain a cause or relationship?
- Is the first frame readable?
- Is duration proportional to distance?
- Can repeated motion be removed after state acknowledgement?
- Does touch avoid hover-only movement?
- Does reduced-motion mode become effectively static?
- Are loading, empty, error, and success transitions unambiguous?
- Are desktop and mobile free of overlap and horizontal overflow?
