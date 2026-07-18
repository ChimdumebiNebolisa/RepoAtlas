# Client bundle budget

The production build enforces initial JavaScript budgets for the three report journeys. Measurements sum the shared Next.js runtime and the route's initial client chunks, then gzip each emitted file with Node's default gzip settings. Lazy chunks are recorded separately because they load only after the visitor asks for their feature.

## Baseline

| Journey | Before | Current | Reduction | Guard |
|---|---:|---:|---:|---:|
| Homepage entry | 666,679 bytes gzip | 220,793 bytes gzip | 445,886 bytes (66.9%) | 245,000 bytes gzip |
| Completed report | 663,811 bytes gzip | 217,925 bytes gzip | 445,886 bytes (67.2%) | 242,000 bytes gzip |
| Shared report | 664,191 bytes gzip | 218,307 bytes gzip | 445,884 bytes (67.1%) | 242,000 bytes gzip |

The budgets leave roughly 10% headroom for compiler variation and small product changes. `npm run build` fails when any journey exceeds its boundary. `npm run check:bundles` can repeat the check against an existing production build.

## Largest owners and loading reasons

| Owner | Gzip size | Loading reason |
|---|---:|---|
| ELK graph layout | 436,649 bytes | Deferred until the Architecture Map tab or a full export needs the graph. This was the confirmed avoidable initial cost. |
| jsPDF | 104,498 bytes | Deferred until PDF export begins. |
| PostHog | 72,484 bytes | Loaded by the global product analytics boundary on all three journeys. |
| Next.js and React runtime | about 124,000 bytes | Required to hydrate the app and route. |
| html2canvas | 45,238 bytes | Deferred until PDF or PNG export begins. |
| Portable sharing compression | 14,087 bytes | Deferred until a portable private link is created or opened. |
| Report UI | about 15,000 bytes | Required to render the initial Candidate Brief controls and content. |

The ELK loading boundary preserves the interactive graph and export output while keeping graph layout and zoom code out of the initial route payload.
