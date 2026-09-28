# Changelog

All notable changes to NodeWeave Studio are documented here.

## [1.5.6] - 2026-09-29

### Improved

- preserve imported SVG root fill/stroke presentation attributes so `currentColor` artwork renders and recolors correctly
- size newly imported SVGs from their original viewBox aspect ratio instead of forcing a square node
- add non-destructive SVG effects: original, monochrome tint, soft shadow, sticker outline, glow, and color badge
- add contain/cover/stretch fitting and aspect-ratio locking for SVG assets
- detect fixed HEX paint slots and expose per-slot color overrides without rewriting the source SVG
- add one-click clipboard SVG loading for copy/paste workflows from external icon sites
- organize SVG color, effect, fitting, sizing, ports, and transform controls into a dedicated inspector section

## [1.5.5] - 2026-09-29

### Fixed

- split the left library into a fixed toolbar row and an independent scrolling asset row using CSS Grid
- category chips no longer change height or get covered when switching between All and individual categories
- switching library tabs/categories now resets the asset list to the top and keeps the active category visible

## [1.5.4] - 2026-09-29

### Fixed

- redrew the brain-map outer silhouette as a natural right-facing human profile with curved forehead, nose, lips, chin, neck, and back-of-head contours
- clipped all internal thought regions to the head silhouette so colored areas never spill outside the face
- refined region placement to better match worksheet-style "inside my head" examples

## [1.5.3] - 2026-09-29

### Fixed

- stopped the left library toolbar, category chips, search controls, and smart-tool row from shrinking vertically inside the sidebar flex layout
- made only the asset/template list consume the remaining sidebar height and scroll independently
- removed the category mask effect and guaranteed a full-height horizontal category row so chips can no longer be half-clipped

## [1.5.2] - 2026-09-29

### Improved

- reorganized the left library hierarchy with dedicated sort, view, browse, and catalog controls
- added recommended/name/category sorting and grid/list views for library assets
- refined sidebar spacing, card sizing, scroll behavior, and responsive panel widths
- automatic layout now defaults to connected-flow nodes only, leaving standalone smart diagrams and media untouched
- auto layout uses rank-specific node dimensions instead of the largest node in the document, preventing oversized spacing around brain maps and planners
- added layout scope selection, right/bottom alignment, equal-gap distribution, selection fit, and full-document fit controls

## [1.5.1] - 2026-09-29

### Fixed

- restored the runtime JSON catalog loader and catalog index missing from the previous remote sync
- repaired the service worker shell list so new releases can activate instead of leaving an older cached editor visible
- aligned repository verification with the self-contained catalog admin page

### Improved

- exposed Share in the top toolbar with URL-embedded project sharing
- promoted 12/24-hour radial planner, brain map, and image insertion as first-class Smart Tools
- imported SVG files now default to illustration-only mode; text and connector ports are enabled explicitly when needed

## [1.4.0] - 2026-09-28

### Added

- 39 JSON-driven diagram style packs informed by `designblock-studio` and `ui-ux-pro-max-skill` style taxonomies
- style effects beyond palette changes: canvas patterns, node gradients, hard/soft/glow/depth shadows, border dashes, typography weight/tracking, edge width/dash/caps, and port shape
- 4-port / 8-port / no-port node connection modes with circle, square, or diamond handles
- `catalog/styles.json` so future styles can be added without changing the renderer source
- Admin JSON merge/export now preserves custom `styles` entries

### Changed

- Style inspector is grouped by style family and shows a visual preview for every style pack
- SVG export preserves style gradients, node shadows, and edge styling

## [1.3.1] - 2026-09-28

### Fixed

- prevent the browser from navigating away when SVG files are dropped onto the catalog admin page
- add a dedicated multi-file SVG upload/drop zone with per-batch mode and category defaults
- report per-file failures instead of closing/replacing the admin page

## [1.3.0] - 2026-09-28

### Added

- repository-managed `catalog/index.json` and `catalog/library.json` data layer
- `/admin.html` catalog management page that automatically loads the current repository JSON
- SVG asset form with icon/block modes, editable default text, text position, dimensions, source URL, and optional `currentColor` normalization
- JSON merge, replace, copy, local preview/apply, and `library.json` download workflows
- NodeWeave project JSON → reusable template conversion from the admin page
- browser-local catalog override for testing catalog changes before committing them to GitHub
- JSON-defined SVG blocks that can render editable text over non-rectangular SVG artwork
- starter repository-managed SVG block examples such as thought clouds, organic blobs, ribbon banners, braces, speech bubbles, road signs, and goal mountains

### Changed

- catalog content can now grow without editing `src/catalog.js` or application code
- build, verification, and Service Worker pipelines now include the repository catalog and admin page
- Service Worker cache version bumped so deployments do not keep serving stale editor files

## [1.2.0] - 2026-09-28

### Added

- library browser modal with category chips for Shapes, SVG Symbols, and Templates
- 8 additional shape primitives including chevron, tag, bookmark, pentagon, octagon, and hourglass
- 30+ more original `currentColor` SVG symbols for lifestyle, planning, travel, finance, learning, and illustration use cases
- 12 additional starter templates including brain-thought ratio, daily/weekly/monthly planners, habit tracker, meal planner, kanban board, SWOT, Eisenhower matrix, roadmap, and travel checklist

### Changed

- left sidebar library now exposes quick category chips and a one-click full browser instead of relying only on long scrolling
- library counts updated to 38 shapes, 65 bundled SVG symbols, and 26 starter templates
- README and product copy refreshed to reflect the expanded diagram + planning use cases

## [1.1.0] - 2026-09-28

### Added

- expanded diagram primitive catalog from 12 shapes to 30+ shapes
- 30+ original NodeWeave `currentColor` SVG symbols across people, system, device, security, status, communication, content, and action categories
- SVG library tab with category grouping and search
- external SVG paste dialog with optional source URL metadata
- direct raw-SVG clipboard paste and SVG file drag-and-drop onto the canvas
- editable SVG color, rotation, horizontal/vertical flip, inner padding, background, and dimensions
- optional imported-SVG single-color normalization to `currentColor`
- 14 starter templates including incident response, data pipeline, decision tree, org chart, auth flow, customer journey, content workflow, network topology, and release planning
- copy/paste selection workflow with internal connector preservation
- node z-order commands for bring-to-front and send-to-back
- command palette entries for SVG symbols, SVG paste, and select-all
- Koboyo link-out workflow with license-safe non-bundled integration guidance

### Changed

- library navigation now separates Shapes, SVG Symbols, and Templates
- project metadata and bootstrap release tag updated to v1.1.0

## [1.0.0] - 2026-09-28

### Added

- SVG-first node and connector editor
- straight, Bézier, and orthogonal connector routing
- searchable shape and template catalogs
- multi-selection, resize, alignment, distribution, and flow auto-layout
- diagram-wide design tokens and theme presets
- browser autosave and named local projects
- JSON import/export
- sanitized custom SVG shape import
- SVG, PNG, WebP, HTML, and JSON export
- responsive desktop/tablet/mobile interface
- light, dark, and system UI themes
- PWA manifest and Service Worker application shell
- SEO, social preview, favicon, 404, and GitHub Pages deployment assets
- GitHub Actions deployment workflow
