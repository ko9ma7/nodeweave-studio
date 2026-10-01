# NodeWeave Studio v1.7 product specification

This document is the repository-level implementation baseline for the current NodeWeave Studio direction.

## Product model

NodeWeave is an SVG-first visual workspace for diagrams, image flows, editable SVG assets, planners, smart maps, and reusable templates. The top-level library remains limited to **Shapes / SVG / Templates**. Large collections are explored through search, category select, sorting, and grid/list view rather than ever-growing button rows.

## Smart components

Smart components are data-driven editors rather than frozen examples. They should expose add, delete, reorder, duplicate, style, and overflow-safe behavior whenever the underlying data supports those operations.

### Brain map

- 2–12 regions.
- Region size is driven by percentage/weight.
- Small items may automatically become external callouts.
- External callouts use a seed marker, curved leader line, and outside label.
- Per-item display mode: Auto / Inside / Callout.
- Configurable callout threshold.
- Percent normalization to 100%.
- Silhouettes: left profile, right profile, simple head, brain/thought cloud.
- Text policy: wrap -> shrink -> externalize instead of silent clipping.

### Radial planner

- 12-hour and 24-hour modes.
- Arc length is calculated from actual start/end time.
- Cross-midnight intervals are supported.
- Small arcs can use external leader-line labels.
- Segments can be added, deleted, reordered, and time-sorted.

## SVG import and editing

Imported SVG assets preserve viewBox and aspect ratio. Text is opt-in and connector ports are independent of illustration mode.

Available render modes:

1. Original
2. Monochrome
3. Outline only
4. Fill only
5. Hybrid outline

The source SVG is preserved; rendering modes are non-destructive. Fixed HEX paint slots remain individually editable where detected.

Large SVG files are preflighted in `src/svg-worker.js`. Common editor metadata is removed before main-thread DOM parsing, complexity is recorded, and the UI reports import progress. The worker is intended to reduce freezes caused by large Inkscape/path-heavy files.

## Layout and text safety

- Only the asset list scrolls in the left sidebar; library controls remain stable.
- Auto-layout defaults to connected flows so standalone smart diagrams and illustrations stay in place.
- Text must not silently escape node bounds. Components should wrap, shrink, resize, or use callouts.
- Nodes can use 0 / 4 / 8 connection ports independently of their visual type.

## Style packs

A style pack changes the complete visual system: canvas, pattern, node fill/border/radius/shadow, typography, edges, and ports. Style switching is not limited to palette changes.

## Sharing and export

Projects can be shared using compressed URL-embedded document state. Export targets remain SVG, PNG, WebP, HTML, and JSON.

## Acceptance criteria

- Selecting All in the library must never clip controls.
- SVG drag/drop must never navigate the browser away from the editor.
- Large SVG imports must show progress rather than appearing frozen.
- Brain-map weights must create obvious size differences.
- Small brain-map thoughts and small planner arcs must remain readable via external leader lines.
- Smart components must not depend on hard-coded starter item counts.
- Imported SVGs must support outline-only and user-selected color without destroying the original source.
