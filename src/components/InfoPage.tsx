import { SiteHeader } from "@/components/SiteHeader";

type InfoSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

type InfoPageProps = {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: InfoSection[];
};

export function InfoPage({ eyebrow, title, introduction, sections }: InfoPageProps) {
  return (
    <main className="site-shell info-shell">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article className="info-page page-container">
        <header className="info-page-header">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{introduction}</p>
        </header>

        <div className="info-page-sections">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items && (
                <ul>
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
