export type Screen = "today" | "diary" | "progress" | "body" | "community" | "profile" | "text" | "barcode" | "search" | "ob-welcome" | "ob-plan";

const ALT: Record<Screen, string> = {
  today: "Heute-Ansicht mit Kalorienbudget, Makros und Coach-Hinweis",
  diary: "Tagebuch mit Monatskalender und Tagessumme",
  progress: "Gewichtstrend mit Prognose",
  body: "Körpermodell: heute und Ziel nebeneinander",
  community: "Community mit Pseudonym und klaren Regeln",
  profile: "Profil mit Rhythmus, Erfolgen und Zielen",
  text: "Mahlzeit beschreiben: erkannte Zutaten mit Schätzbereich",
  barcode: "Gescanntes Produkt mit Originalfoto und Markenlogo",
  search: "Suche mit zuletzt verwendeten Lebensmitteln",
  "ob-welcome": "Willkommen bei Vitalo, Sprache automatisch erkannt",
  "ob-plan": "Persönlicher Plan mit Tagesziel, Tempo und Zielschätzung",
};

/**
 * A flat iPhone frame with the real app screenshot. Both appearances are rendered;
 * CSS shows the one that matches the site's theme.
 */
export function Phone({ screen, priority = false, className = "" }: { screen: Screen; priority?: boolean; className?: string }) {
  const loading = priority ? "eager" : "lazy";
  return (
    <figure className={`phone ${className}`}>
      <div className="phone-screen">
        <img className="shot shot-light" src={`/site/screens/${screen}-light.webp`} alt={ALT[screen]} width={660} height={1435} loading={loading} decoding="async" />
        <img className="shot shot-dark" src={`/site/screens/${screen}-dark.webp`} alt="" width={660} height={1435} loading={loading} decoding="async" aria-hidden />
      </div>
    </figure>
  );
}
