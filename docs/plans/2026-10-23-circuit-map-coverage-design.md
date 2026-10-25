# Official circuit maps on white

- Primary task: inspect an accurately annotated circuit layout, then open it at native resolution when labels are too small.
- Both circuit-list previews and circuit-detail figures use locally served Formula 1 diagrams. Remove all rendering paths that substitute bundled outline SVGs or manually placed annotations.
- Coverage: 32 verified source maps, including the current calendar set and available recent historical circuits. The source manifest records the official page/image, layout year, dimensions, byte length and SHA-256. Header years describe the supplied map, including older sources such as Jeddah 2025.
- Use a fixed white map surface in light and dark application themes. Reuse the existing fixed white/ink palette and existing spacing/radius tokens. Remove the graph-paper background and thumbnail contrast/rotation effects.
- List previews load lazily and retain card navigation. Detail maps load independently of race data. A native dialog offers the full 1252px image on white, with scrolling on small screens, a close button, Escape dismissal and focus return.
- If no verified official image is available, or if its local asset fails, show a specific unavailable state on white. Never silently return to the previous outlines.
- Acceptance: source coverage, aliases and file-integrity tests; desktop/tablet/mobile and both themes; white preview, detail and zoom surfaces; list-card navigation; delayed/error image paths; required route smoke checks; build, fonts and performance budgets.
- This is an uncommitted local batch. Submission and deployment require a new explicit user instruction.

Official references are recorded per circuit in `src/data/circuit-detailed-maps.json`, including https://www.formula1.com/en/racing/2025/saudi-arabia and https://www.formula1.com/en/racing/2020/germany.
