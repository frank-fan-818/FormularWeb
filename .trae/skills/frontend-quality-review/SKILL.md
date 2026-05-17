# frontend-quality-review

Use this skill when changing route-level pages, dashboard layouts, charts, or visual styling.

## Intent

Keep the UI aligned with a professional F1 data product: dense, race-control inspired, and built for comparison instead of generic dashboard cards.

## Checklist

- Confirm the page has a clear primary user task.
- Use `docs/design-brief-template.md` for new or redesigned pages.
- Reuse `src/styles/design-tokens.css` before inventing new colors, spacing, shadows, or radii.
- Keep Ferrari red for primary actions and key highlights.
- Avoid business logic directly in JSX; move reusable logic to `src/hooks/` or `src/utils/`.
- Confirm loading, empty, and error states are visible and specific.
- For chart work, follow `docs/chart-guidelines.md`.
- Check mobile and desktop layouts for overlapping text or controls.

## Evidence To Report

- Files changed.
- Viewports checked.
- Any unresolved design debt.
