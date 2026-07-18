import Link from "next/link";

const footerLinks = [
  ["Interview prep", "/interview-preparation"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Contact", "/contact"],
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-layout page-container">
        <div className="site-footer-brand">
          <Link href="/">RepoAtlas</Link>
          <p>Deterministic repository analysis. No code execution. No AI calls.</p>
        </div>

        <nav className="footer-nav" aria-label="Footer navigation">
          {footerLinks.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>

        <p className="site-footer-meta">
          <span>© {new Date().getUTCFullYear()} RepoAtlas</span>
          <a className="tin-credit" href="https://tin.computer">
            <span className="tin-mark" aria-hidden="true" />
            Growth by Tin
          </a>
        </p>
      </div>
    </footer>
  );
}
