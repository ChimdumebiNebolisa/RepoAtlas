import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Page not found | RepoAtlas",
};

export default function NotFound() {
  return (
    <main className="site-shell not-found-shell">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <section
        className="not-found-page page-container"
        aria-labelledby="not-found-title"
      >
        <div className="not-found-copy">
          <p className="not-found-code">404 / Page not found</p>
          <h1 id="not-found-title">We couldn&apos;t find this page.</h1>
          <p className="not-found-description">
            The link may be incomplete or out of date. Return to RepoAtlas to
            start a repository walkthrough.
          </p>
          <Link href="/" className="btn btn-primary not-found-action">
            Return to RepoAtlas
          </Link>
        </div>
      </section>
    </main>
  );
}
