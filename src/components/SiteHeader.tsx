import Link from "next/link";
import { reportCapabilityCopy } from "@/lib/reportCapabilities";

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function SiteHeader() {
  return (
    <header className="site-header page-container">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden="true">R</span>
        <span>
          <strong>RepoAtlas</strong>
          <small>Candidate Brief Generator</small>
        </span>
      </Link>
      <div className="header-end">
        <div className="header-badges" aria-label="Product capabilities">
          <Badge>No AI required</Badge>
          <Badge>TS/JS + Python + Java</Badge>
          <Badge>{reportCapabilityCopy.headerBadge}</Badge>
        </div>
      </div>
    </header>
  );
}
