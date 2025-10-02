# Canvas UX Playbook

_Last updated: 2025-10-02_

## 🎯 Purpose
This playbook codifies the current Canvas visual language and provides actionable guidance for designers and engineers shipping FigJam-style experiences. It captures the audit findings from Part 6 of the hardening plan and outlines the implementation process for design reviews.

---

## 🌐 Design Principles
1. **Fluid canvas-first focus** – Tooling must stay lightweight so the stage remains the hero. Favor floating controls, soft depth, and minimal chrome.
2. **Delight without distraction** – Use restrained motion, smooth easing (150–200 ms), and subtle shadows to convey hierarchy without overwhelming the workspace.
3. **Clarity & accessibility** – Preserve 4.5:1 contrast for primary text and interactive states. Ensure all controls are keyboard and screen-reader navigable.
4. **Consistency through tokens** – Centralize color, spacing, and typography decisions so every module speaks the same visual language.

---

## 🎨 Design Tokens Audit
Current tokens live in `src/styles/figjam-theme.css`. Tailwind configuration (`tailwind.config.js`) still uses the default theme, so utility classes do not yet map to the CSS variables. Key takeaways:

| Category    | Current State | Issues / Gaps | Action Items |
|-------------|---------------|---------------|--------------|
| **Color**   | CSS variables (`--bg-*`, `--accent-*`, `--text-*`) refreshed with dotted grid layers, vibrant stickies, and high-contrast swatches. | Tailwind `theme.extend.colors` empty; no semantic tokens (e.g., `surface.neutral`, `surface.brand`). | Map CSS variables into Tailwind via `theme.extend.colors` and document light/dark variants with semantic names. |
| **Spacing** | Variables (`--spacing-xs` → `--spacing-xl`) aligned to 4 px grid. | Tailwind spacing scale defaults to 4/8/12/16 but not linked to CSS variables; some components use hard-coded pixel values. | Define spacing scale in Tailwind and enforce via utility classes or SCSS helper mixins. |
| **Typography** | Global font stack (`-apple-system`, `Inter`, `Roboto`) defined in both `index.css` and `figjam-theme.css`. Base size 14 px. | No typography tokens (weights, sizes, line heights). Tailwind still uses defaults. | Establish type ramp (xs–2xl) with line heights, map to Tailwind `fontSize`, and document usage per component (labels, headings, tooltips). |
| **Radius** | Variables (`--radius-sm`, `--radius-md`, etc.). | Some hard-coded radii (`border-radius: 9999px` etc.) outside token usage. | Add radius scale to Tailwind `borderRadius` and update components to consume tokens. |
| **Shadows** | Three drop shadows defined. | Not exposed through Tailwind; some components inline bespoke shadows. | Extend Tailwind `boxShadow` to match tokens and prefer `shadow-token` classes. |

### Tokenization Backlog
- [ ] Mirror CSS variable values into Tailwind `theme.extend` (colors, spacing, radii, shadows, font families, font sizes).
- [ ] Expose a `design-tokens.ts` helper for runtime access (Konva renderers currently rely on inline colors).
- [ ] Audit components for hard-coded values and swap to tokens or Tailwind classes (toolbar buttons, zoom controls, color picker).
- [ ] Define dark-mode/theming strategy (even if deferred) to avoid piecemeal overrides later.

---

## 🧩 Component Standards
### Toolbar & Floating Controls
- Use the glassy toolbar surface (`--bg-toolbar`) with `--border-subtle` outlines and `--shadow-md` depth.
- Maintain 44 px minimum hit target on desktop; larger (48 px) for touch contexts.
- Active tool state must reflect the indigo accent (`--accent-indigo`) with an outer focus halo for accessibility.

### Panels & Inspectors
- Surface background `--bg-panel` with 8 px corner radius and `--shadow-md` depth.
- Internal spacing should follow the 8/12/16 scale (`--spacing-sm`, `--spacing-md`, `--spacing-lg`).
- Section headers use the medium weight typography token (pending `font-medium` definition) with 0.5 rem bottom margin.

### Canvas Stage
- Grid now uses dual dotted layers (`--grid-dot-strong` + `--grid-dot-soft`) at 22 px spacing—keep Konva grid renderer in sync.
- Pan/drag cursors should revert to `cursor: grab`/`grabbing` for affordance.
- Selection overlays should lean on the indigo accent (stroke = `var(--accent-indigo)`, fill = `rgba(93, 90, 255, 0.16)`).

### Text Editors
- New text creation uses `--text-editor-border-color` token; ensure final tokens keep 4 px padding (update token table accordingly).
- Existing editors should inherit canvas selection frame with no border to avoid double outlines.

### Updated Palette (2025-10-02)
| Token | Hex / RGBA | Usage |
|-------|------------|-------|
| `--accent-indigo` | `#5D5AFF` | Primary actions, active tool pills |
| `--accent-iris` | `#8B7CF7` | Indigo gradient partner |
| `--accent-sun` | `#FFD262` | Default sticky notes, highlight badges |
| `--accent-tangerine` | `#FF9D6C` | Warm emphasis, destructive gradients |
| `--accent-mint` | `#66E0B8` | Positive states, connector feedback |
| `--accent-sky` | `#66C6FF` | Secondary accents, zoom feedback |
| `--accent-berry` | `#FF6AD5` | Playful annotations, marker ink |
| `--accent-slate` | `#1F2544` | High-contrast text + modal surfaces |
| `--grid-dot-strong` | `rgba(70, 76, 107, 0.18)` | Foreground dotted layer |
| `--grid-dot-soft` | `rgba(70, 76, 107, 0.08)` | Background dotted layer |

---

## ♿ Accessibility Checklist
- **Color contrast**: Verify brand accent backgrounds meet 4.5:1 when used with white text (`#5D5AFF` passes—capture ratios for hover/active blends).
- **Focus indicators**: Every interactive element must show a visible focus halo; reuse `outline: 3px solid var(--accent-indigo)` with `outline-offset: 2px`.
- **Keyboard navigation**: Ensure toolbar buttons, dropdown items, and color swatches are tabbable and support arrow navigation where appropriate.
- **ARIA & labeling**: Tool buttons require `aria-pressed` and descriptive `aria-label`. Tooltips should use `aria-describedby` or native `title` fallback.
- **Motion preferences**: Respect `prefers-reduced-motion`; reduce or disable scaling effects on active tool state for users who opt out.

---

## ✅ Design Review Process
1. **Pre-flight**: Include screenshots (or recordings) showing default, hover, focus, active, and error states. Note WCAG contrast ratios for any new colors.
2. **Token check**: Confirm no new hard-coded colors/spacings; reference the token table or extend Tailwind accordingly.
3. **PR checklist**: Add a `Design QA` section in the PR description summarizing visual changes and accessibility considerations.
4. **Design sign-off**: At least one design reviewer (or designated proxy) must approve UI-affecting PRs before merge.
5. **Post-merge**: Update this playbook and/or `docs/design/changelog.md` (future) when introducing new tokens or components.

---

## 🔭 Implementation Backlog
- [ ] Create Tailwind token bridge (`tailwind.config.js` + `design-tokens.ts`).
- [ ] Build visual regression harness (e.g., Storybook + Playwright screenshots) for critical components: toolbar, color picker, mindmap node.
- [ ] Draft motion/animation guidelines (durations, easing curves, acceptable scale ranges).
- [ ] Introduce `docs/design/changelog.md` for logging design system updates.
- [ ] Partner with accessibility QA to validate keyboard-only flows (tool switching, modal interactions, inspector editing).

---

## 📚 References
- `src/styles/figjam-theme.css`
- `src/index.css`
- `tailwind.config.js`
- `docs/canvas-hardening-plan.md` (Part 6)
- WCAG 2.1 AA contrast guidelines
