# RepoAtlas

RepoAtlas is a local-first repository analysis app that generates a structured **Repo Brief** for onboarding, reviews, and architecture understanding.

> Last validated against code on **2026-03-25**.

For detailed product behavior, architecture decisions, scoring assumptions, and future-state design, see the engineering spec: [`docs/spec.md`](docs/spec.md).

---

## Quickstart (users + developers)

### Requirements

- Node.js 18+
- npm 9+

### Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, upload a repository `.zip`, and click **Analyze Repository**.

### Common scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
```

---

## API endpoints (currently available)

This table intentionally lists only API routes currently implemented in `src/app/api/**`.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/analyze` | Analyze an uploaded repo zip (multipart) or a local `zipRef` path (JSON/testing flow) and return `{ reportId }`. |
| `GET` | `/api/reports/{id}` | Fetch a previously generated report JSON by report ID. |

For payload details, error semantics, and architecture/data-flow context, see [`docs/spec.md`](docs/spec.md#8-api-design).

---

## Notes

- Exports are currently client-side (PDF/PNG/Markdown from the UI).
- Report storage uses local filesystem (`reports/`) by default, or Vercel Blob when configured.
- Fixture repos for analyzer tests are in `fixtures/`.
