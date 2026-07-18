import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Contact | RepoAtlas",
  description: "Contact RepoAtlas support about the product, privacy, or terms.",
};

const supportAddress = "repo-atlas-phi@mail.tin.computer";

export default function ContactPage() {
  return (
    <main className="site-shell info-shell">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <section className="contact-page page-container">
        <div className="contact-copy">
          <p className="eyebrow">Support</p>
          <h1>Talk to a person about RepoAtlas.</h1>
          <p>
            Send product, privacy, or terms questions to the support inbox. If your question is
            about a report, include its link but do not email repository files or sensitive code.
          </p>
        </div>

        <div className="contact-card">
          <p>Support email</p>
          <a href={`mailto:${supportAddress}`}>{supportAddress}</a>
          <span>Use one message per issue so the conversation stays easy to follow.</span>
        </div>

      </section>
    </main>
  );
}
