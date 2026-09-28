# Contributing to NodeWeave Studio

Thanks for your interest in improving NodeWeave Studio.

## Before opening a pull request

1. Keep changes focused on one problem or feature.
2. Preserve the local-first and static-hosting architecture unless the proposal explicitly introduces an optional adapter.
3. Do not add runtime dependencies for convenience when the same behavior can be implemented clearly with platform APIs.
4. Preserve keyboard access, focus-visible behavior, responsive layouts, and reduced-motion handling.
5. Treat imported SVG as active content and keep sanitizer rules restrictive.
6. Run the project checks before submitting.

```bash
npm run build
npm run check
```

## Development

```bash
npm run dev
```

Open `http://localhost:4173/`.

## Pull requests

A useful PR description should include:

- the user problem being solved
- the implementation approach
- screenshots or a short recording for visible UI changes
- keyboard/mobile behavior when relevant
- export compatibility impact when relevant
- any new security or persistence considerations

## Third-party assets and code

Do not add copied assets or source code without a compatible license and required attribution. Keep third-party notices separate from NodeWeave Studio's MIT license when necessary.
