# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security-sensitive report.

Use GitHub's private vulnerability reporting / security advisory flow for this repository:

https://github.com/ko9ma7/nodeweave-studio/security/advisories/new

Include reproduction steps, affected browser/version, and a minimal test case when possible.

## Security-sensitive areas

NodeWeave Studio is a static, local-first application, but several areas still require careful review:

- custom SVG import and sanitization
- generated standalone HTML exports
- clipboard operations
- browser storage and imported JSON validation
- Service Worker caching behavior
- future cloud or collaboration adapters

SVG should be treated as active document content rather than as a passive bitmap. Any extension to custom SVG import should preserve strict allowlisting and reject executable/event-driven content and unsafe external references.
