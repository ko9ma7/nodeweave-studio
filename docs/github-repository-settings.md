# GitHub Repository Settings — NodeWeave Studio

Canonical repository target:

- Repository: `ko9ma7/nodeweave-studio`
- Visibility: **Public**
- Default branch: `main`
- Website: `https://ko9ma7.github.io/nodeweave-studio/`
- License: MIT

## About / Edit repository details

**Description**

> SVG-first, local-first diagram editor with design tokens, auto layout, and SVG/PNG/WebP/HTML/JSON export.

**Website**

> https://ko9ma7.github.io/nodeweave-studio/

**Topics**

- `diagram-editor`
- `svg-editor`
- `flowchart`
- `diagram`
- `svg`
- `local-first`
- `github-pages`
- `design-tool`
- `mind-map`
- `system-design`
- `auto-layout`
- `pwa`
- `javascript`
- `no-dependencies`

## Recommended repository options

- Issues: **Enabled**
- Projects: **Disabled** unless project planning is actively used
- Wiki: **Disabled**; keep documentation versioned under `/docs`
- Discussions: **Disabled** initially
- Squash merge: **Enabled**
- Merge commits: **Disabled**
- Rebase merge: **Enabled**
- Automatically delete head branches: **Enabled**
- Allow update branch: **Enabled**

## Pages

- Build and deployment source: **GitHub Actions**
- Expected URL: `https://ko9ma7.github.io/nodeweave-studio/`
- Enforce HTTPS: enable after Pages is active

The workflow at `.github/workflows/deploy.yml` builds `dist/`, verifies the output, uploads the Pages artifact, and deploys it.

## Social preview

Use:

`assets/github-social-preview.png`

Recommended repository Social Preview dimensions are already provided by the project asset. GitHub currently exposes this upload through repository Settings rather than the repository-content API used by this automation path, so upload this file in **Settings → General → Social preview** when needed.

## Initial release

- Tag: `v1.0.0`
- Release title: `NodeWeave Studio v1.0.0`
- Suggested initial commit: `feat: launch NodeWeave Studio`
