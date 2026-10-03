# Submitline design world

## Idea

A final inspection table for a project about to face judges. The interface feels like a careful editorial artifact, not an analytics dashboard. The core visual is one working sheet: source rule at left, observed evidence at right, with a narrow sequence line joining input and result.

## Visual language

- Bone `#F4F1EA` canvas, ink `#100F0D` type, terra `#DA532C` for the active action and blockers, quiet moss `#426657` for verified evidence.
- Large low-contrast serif headlines balanced by compact, tight grotesk body text. Mono labels use wide tracking and small uppercase text.
- Hairline rules, generous vertical space, precise aligned columns. Status is conveyed by text and shape as well as color.
- No card grid, purple gradient, inflated score, or decorative confetti. A subtle grain and a small scanning line can create movement without hiding results.
- On phones, the two result columns stack in reading order: blocker summary, requirements, evidence, video timeline.

## Interaction

One prominent first action: **Check my submission**. Checks report progress independently. A corrected link can be rerun without clearing the rest. Source passages remain visible throughout. Video observations are timestamped jump links, with a clear note that deAPI reads pixels and that the entrant must confirm claims about functionality.

## Accessibility

Semantic headings and forms, visible focus, contrast on the light canvas, reduced-motion support, no color-only status, and keyboard-operable timeline controls.
