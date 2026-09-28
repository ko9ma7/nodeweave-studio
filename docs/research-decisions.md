# Research-to-product decisions

The supplied research converges on a few principles that NodeWeave applies directly.

## Function and style are independent

A process block, decision, database, group or swimlane is a semantic/functional choice. Minimal, Blueprint, Paper, Soft, Dark and High Contrast are presentation choices. NodeWeave keeps those layers separate so a whole diagram can be restyled without replacing its structure.

## Searchable catalog instead of a flat toolbar

Shapes and templates carry category/keyword metadata. The palette and command search query this metadata, so the library can grow without making the toolbar unusable.

## Interaction contract matters

The app does not stop at a static preview. It includes keyboard focus, shortcuts, multi-selection, connection ports, resize handles, empty states, dialogs, local persistence and responsive side panels.

## SVG is a first-class knowledge/output format

The editor uses SVG for the canonical visual rendering layer. The exporter generates SVG from the document model rather than serializing a browser screenshot. This keeps the output reusable in HTML, design tools and documentation.

## Local-first and GitHub Pages friendly

There is no backend and no secret in the frontend. Autosave is browser-local; portable backup is JSON. The repository includes a build script, PWA shell, GitHub Pages workflow and Windows bootstrap script.
