# NodeWeave Studio architecture

NodeWeave is intentionally **SVG-first and local-first**.

## Core model

The canonical project state is plain JSON:

- `nodes`: shape type, bounds, label, per-node style overrides.
- `edges`: source/target node, connection ports, routing, label, style overrides.
- `tokens`: canvas, surface, text, border, primary, edge, radius, font family.
- `settings`: grid, snap, layout direction, gaps, export preferences.
- `meta`: project ID, title and timestamps.

The editor view, SVG export, raster export and HTML export all consume the same model. This avoids a screenshot-only export pipeline and keeps vector output deterministic.

## Rendering layers

1. Canvas background/grid (CSS)
2. SVG edge layer
3. SVG node layer
4. Selection handles / connection ports
5. Temporary interaction layer (connection preview and marquee selection)

## Interaction contract

- Pointer drag: move nodes.
- Selected node corners: resize.
- Port drag: create an edge.
- Wheel: zoom around cursor.
- Space + drag or middle mouse: pan.
- Empty-canvas drag: marquee selection.
- Shift: additive selection.
- Keyboard: delete, arrows, undo/redo, duplicate, save, command search.

## Export pipeline

`project JSON -> SVG serializer -> SVG / standalone HTML`

For PNG/WebP the generated SVG is rasterized in the browser via Canvas. No remote rendering service or API key is needed.

## Persistence

Autosave and named projects use LocalStorage. The editor has no server dependency. JSON export is the portable backup format.

## Extensibility

Add a new shape by:

1. Adding metadata in `src/catalog.js`.
2. Adding its SVG primitive to `shapePrimitive()` in `src/geometry.js`.
3. Optionally adjusting its text box in `textBox()`.

Add a new style by adding a token preset to `THEMES`. Shape geometry and visual style are intentionally independent.
