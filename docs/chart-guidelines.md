# Chart Guidelines

Charts in FormularOneWeb should feel like race engineering tools: dense, legible, and quick to compare.

## Colors

- Ferrari red is reserved for primary actions, highlights, or the selected race context.
- Driver series should use stable high-contrast colors from the page helper, not random ECharts defaults.
- Weather colors are semantic: red/orange for temperature, blue for humidity, blue fill for rain.
- Track status areas use soft fills with visible borders: yellow, VSC orange, SC blue, red flag red.

## Tooltips

- Always escape dynamic text before returning HTML tooltips.
- Keep tooltip width capped to the viewport.
- Sort multi-driver lap tooltips by performance when comparison is the task.
- Use `-` for unavailable data instead of blank values.

## States

- Every chart card needs a loading state, an empty state, and a no-data explanation.
- Mobile chart heights should be explicitly set and shorter than desktop.
- Legends must be interactive when series count can exceed 6.

## QA

- Check desktop and mobile screenshots after chart changes.
- Check browser console after hovering and toggling legends.
- Verify no tooltip is clipped beyond the viewport.
