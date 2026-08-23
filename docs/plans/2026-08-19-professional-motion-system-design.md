# Professional Motion System Design

## Product intent

The dashboard should move like an F1 race-control product: immediate, controlled, information-led, and mechanically precise. Motion must explain state and hierarchy before it decorates. The memorable signature is a short directional reveal, a red timing-line accent, and tightly staggered data surfaces—not floating cards or elastic toy motion.

## First-principles model

Every animation must pay for itself against one of five user needs:

1. **Causality:** confirm that an input produced a result.
2. **Continuity:** show where content came from and preserve spatial orientation.
3. **Priority:** sequence attention from page identity to primary task to supporting data.
4. **State legibility:** distinguish loading, live, selected, stale, expanded, and disabled states.
5. **Comfort and speed:** stay interruptible, compositor-friendly, and absent when reduced motion is requested.

Animations that satisfy none of these needs are removed. Transform and opacity are the default animated properties. Layout, width, height, and broad `all` transitions are avoided unless the component genuinely changes geometry.

## Alternatives considered

### A. Motion library and animated route presence

This gives exit-before-enter choreography and spring physics, but adds runtime weight, can conflict with the 85 KiB performance gate, and is unnecessary for a data dashboard. Rejected.

### B. Page-specific handcrafted animation

This can look rich in isolated screenshots but repeats the current inconsistency and makes reduced-motion maintenance expensive. Rejected.

### C. Tokenized CSS motion plus minimal React state

Recommended. CSS handles route reveals, list staggering, hover/press states, skeletons, navigation, and overlays. React only supplies route remount identity and reduced-motion awareness to ECharts. This preserves performance and creates one maintainable language.

## Motion hierarchy

- **Instant (90–120ms):** press, focus, icon acknowledgement.
- **Fast (160–180ms):** hover, selection, dropdown response.
- **Standard (220–280ms):** cards, tabs, sidebar controls, small state changes.
- **Deliberate (360–480ms):** route/page reveal and data visualization entrance.
- **Ambient (900–1400ms):** skeleton shimmer and live status pulse only.

The system uses deceleration for entrances, acceleration for exits, and a restrained emphasized curve for large surfaces. Overshoot is not used on dense data components.

## Application map

- Route content remounts inside a keyed `motion-route-shell`; the persistent header/sidebar never replay.
- The first four semantic page sections enter in a 45ms cascade. Long lists stagger only their first eight visible rows/cards.
- Clickable surfaces use 2–3px elevation on hover and a short 0.985 press compression.
- Active navigation uses a growing timing-line indicator and icon translation instead of a sudden background swap.
- Search dropdowns originate from their trigger; overlays fade independently from moving panels.
- Skeletons use a slower low-contrast scan; live indicators use a bounded ring pulse.
- ECharts uses a standard 420ms initial draw and 240ms update, disabled through `prefers-reduced-motion`.

## Accessibility and performance

- `prefers-reduced-motion: reduce` removes non-essential transforms, opacity sequences, pulses, smooth scrolling, and chart animation.
- Focus visibility is never delayed by animation.
- No animation blocks pointer or keyboard input.
- Route motion stays under 360ms; interaction feedback stays under 180ms.
- No new animation dependency is introduced.
- Performance budgets, Lighthouse, desktop/tablet/mobile browser QA, console inspection, and chart rendering remain release gates.

