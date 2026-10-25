import { LEGAL_UPDATED } from "../site";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/** Shared layout for the legal pages: title, date, table of contents and the sections. */
export function LegalPage({ title, intro, sections, note }: { title: string; intro: string; sections: LegalSection[]; note?: React.ReactNode }) {
  return (
    <article className="legal">
      <div className="container narrow">
        <header className="legal-head" data-reveal>
          <p className="eyebrow">Rechtliches</p>
          <h1>{title}</h1>
          <p>{intro}</p>
          <p>Stand: {LEGAL_UPDATED}</p>
        </header>
        {sections.length > 4 && (
          <nav className="legal-toc" aria-label="Inhalt" data-reveal>
            <strong>Inhalt</strong>
            {sections.map((s, i) => <a key={s.id} href={`#${s.id}`}>{i + 1}. {s.title}</a>)}
          </nav>
        )}
        <div className="prose">
          {note && <div className="note">{note}</div>}
          {sections.map((s, i) => (
            <section key={s.id} aria-labelledby={s.id}>
              <h2 id={s.id}>{sections.length > 1 ? `${i + 1}. ` : ""}{s.title}</h2>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
