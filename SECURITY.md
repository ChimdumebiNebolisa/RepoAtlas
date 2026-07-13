# Security Policy

RepoAtlas parses **untrusted** repository archives and public GitHub metadata.
Security is a core product constraint, not an afterthought.

## Reporting a vulnerability

Please report suspected vulnerabilities privately via GitHub Security Advisories
("Report a vulnerability" on the repository's **Security** tab), or by opening a
minimal issue that describes impact without including a working exploit. Do not
disclose publicly until a fix is available. We aim to acknowledge reports
promptly and will credit reporters who wish to be named.

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
  path-traversal rejection and entry/size limits.
- **No caching of untrusted data.** Report, share, and export responses are
  served with `Cache-Control: no-store`; baseline security headers
  (`nosniff`, `SAMEORIGIN`, referrer/permissions policy, and HSTS in
  production) are applied via `next.config.js`.

## Supported versions

This project targets the current `main` line. Security fixes are applied to
`main`; there is no long-term-support branch.
