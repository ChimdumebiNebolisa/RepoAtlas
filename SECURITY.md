# Security Policy

RepoAtlas parses **untrusted** repository archives and public GitHub metadata.
Security is a core product constraint, not an afterthought.

## Reporting a vulnerability

Please report suspected vulnerabilities privately via GitHub Security Advisories
("Report a vulnerability" on the repository's **Security** tab), or by opening a
minimal issue that describes impact without including a working exploit. Do not
disclose publicly until a fix is available. We aim to acknowledge reports
promptly and will credit reporters who wish to be named.

## Dependency audit policy

The [security-audit workflow](.github/workflows/audit.yml) runs for pull requests
targeting `main`, pushes to `main`, a weekly schedule, and manual dispatch. It
has two enforced checks:

- Production dependencies: `npm audit --omit=dev --audit-level=low`
- Full dependency tree, including development tooling: `npm audit --audit-level=low`

Either audit failing fails the workflow; findings are not suppressed with
`continue-on-error`. The workflow installs from the committed lockfile with
`npm ci --ignore-scripts`, and dependency changes must clear both checks. Major
dependency migrations require separate compatibility evidence; `npm audit fix
--force` is not an automated remediation policy.

## Security model

- **Static analysis only.** RepoAtlas reads repository files as text. It never
  executes code from an analyzed repository.
- **No AI/LLM calls** are made as part of analysis.
- **Public repositories only.** Only public GitHub URLs and uploaded ZIP
  archives are accepted. A server-owned GitHub token is **never** attached to a
  user-supplied repository request.
- **No arbitrary path access.** A caller-supplied `zipRef` local path is
  rejected; the server only reads uploaded archives and downloaded public
  archives.
- **Capability-link model, no accounts.** A report id is a hard-to-guess read
  capability. There is no public mutation endpoint — the delete API was removed
  so a guessable id cannot destroy stored data. Retention is enforced by a
  server-side TTL sweep.
- **Hardened ZIP extraction.** Uploads are validated and extracted with
  path-traversal rejection, normalized-target collision preflight, and
  entry/size limits. Duplicate destinations and file/child-path conflicts are
  rejected before any archive entry is written.
- **No caching of untrusted data.** Report, share, and export responses are
  served with `Cache-Control: no-store`; baseline security headers
  (`nosniff`, `SAMEORIGIN`, referrer/permissions policy, and HSTS in
  production) are applied via `next.config.js`. Production pages also send a
  tested CSP from `securityHeaders.js`: same-origin scripts and connections,
  no objects or frames, and only the `data:`/`blob:` image, font, and worker
  capabilities required by the client-side report exports. The policy uses
  `unsafe-inline` for Next's generated runtime and the UI's inline styles, but
  does not grant `unsafe-eval` or third-party origins.

## Supported versions

This project targets the current `main` line. Security fixes are applied to
`main`; there is no long-term-support branch.
