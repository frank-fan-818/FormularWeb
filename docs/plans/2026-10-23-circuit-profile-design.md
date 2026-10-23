# Circuit profile layout

- Audience and task: F1 viewers identifying a circuit and reading its route and engineering specifications.
- Desktop: compact title and locality above a large flat diagram, alongside a single set of eight specifications. Remove the duplicate metric strip and hidden duplicate image.
- Mobile: wrap the full circuit name; stack diagram and two-column specifications without page overflow.
- Visual language: existing display/mono fonts and design tokens, thin neutral track lines, a red direction arrow, no heavy shadows or invented sector colouring.
- Shanghai: retain the bundled vector geometry, rotate it to match the official diagram's orientation, and annotate turn numbers and the start/finish line. Other circuits retain their own local geometry without guessed annotation.
- Loading/unavailable: preserve the image loading and fallback states and the existing parameter placeholders.
- Acceptance: desktop 1440×900, tablet 768×1024 and mobile 375×812; Shanghai and Monaco in both themes; no console errors or failed assets; existing circuit data and SVG parser tests plus production build.

References consulted:

- https://www.formula1.com/en/racing/2026/china
- https://media.formula1.com/image/upload/c_fit,h_704/q_auto/v1740000001/common/f1/2026/track/2026trackshanghaidetailed.webp
- https://www.motorsport.com/f1/news/chinese-grand-prix-shanghai-f1-circuit-guide-1024943/1401325/

The external graphic is a design reference only. The page renders the existing local vector and does not add an external image request.
