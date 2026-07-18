import Link from "next/link";

type SiteHeaderProps = {
  current?: "pricing";
};

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function SiteHeader({ current }: SiteHeaderProps) {
  return (
    <header className="site-header page-container">
      <Link href={current === "pricing" ? "/" : "#top"} className="brand">
        <span className="brand-mark" aria-hidden="true">R</span>
        <span>
          <strong>RepoAtlas</strong>
          <small>Candidate Brief Generator</small>
        </span>
      </Link>
      <div className="header-end">
        <nav className="site-nav" aria-label="Primary navigation">
          <Link href="/pricing" aria-current={current === "pricing" ? "page" : undefined}>
            Pricing
          </Link>
        </nav>
        <div className="header-badges" aria-label="Product capabilities">
          <Badge>No AI required</Badge>
          <Badge>TS/JS + Python + Java</Badge>
          <Badge>Export Markdown/PDF/PNG</Badge>
        </div>
      </div>
    </header>
  );
}
