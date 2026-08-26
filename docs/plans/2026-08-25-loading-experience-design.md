# Timing Beacon loading experience

## Goal

Make long data operations feel deliberate and trustworthy without hiding already available race information. The loader should look like part of a professional timing product, remain lightweight, and work across desktop, mobile, light mode, dark mode, and reduced-motion preferences.

## System

- **Page**: route chunks and first-load detail views. Provides a strong status surface with request, validation, and render stages.
- **Panel**: lists and large RaceDetail sections whose data is still being assembled.
- **Inline**: charts and analysis modules. Keeps the surrounding page usable while a single visualization renders.

The visual language uses a timing rail, a synchronisation marker, staged telemetry segments, and concise English status copy. All motion uses CSS transforms and opacity; there are no image or animation-library payloads.

## Placement

- Global lazy route boundary
- Races, drivers, constructors, and circuits lists
- Circuit and constructor archive details
- RaceDetail initial session load and tab transitions
- FastF1 analysis module states and deferred chart chunks
- Password reset link verification

Short, bounded form submissions retain button-level progress so users do not lose form context.

## Accessibility and performance

- `role="status"`, polite live-region announcements, and descriptive labels
- Static but informative presentation under `prefers-reduced-motion`
- 120 ms delayed reveal reduces distracting flashes on fast cache hits
- Existing content stays mounted wherever the data architecture permits progressive rendering
