import Link from "next/link";
import { Fragment } from "react";
import { AppStoreButton } from "./components/Chrome";
import { CountUp } from "./components/CountUp";
import { Icon, type IconName } from "./components/Icon";
import { Phone } from "./components/Phone";
import { Pricing } from "./components/Pricing";
import { Story, type StoryStep } from "./components/Story";
import { TrendChart } from "./components/TrendChart";
import { PRICES } from "./site";

/** Splits a headline into words that rise in one after another. */
function Words({ text, start = 0 }: { text: string; start?: number }) {
  return (
    <>
      {text.split(" ").map((word, i, all) => (
        <Fragment key={i}>
          <span className="word" style={{ "--w": i + start } as React.CSSProperties}>
            <span>{word}</span>
          </span>
          {i < all.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

function SectionHead({ eyebrow, title, text, center = false }: { eyebrow: string; title: string; text?: string; center?: boolean }) {
  return (
    <div className={`section-head ${center ? "center" : ""}`} data-reveal>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {text && <p className="lead">{text}</p>}
    </div>
  );
}

const STEPS: StoryStep[] = [
  {
    screen: "text",
    icon: "chat",
    kicker: "Beschreiben",
    title: "Sag einfach, was du gegessen hast.",
    text: "„Zwei Eier, ein Vollkorntoast mit Butter und ein Cappuccino.“ Vitalo erkennt die Zutaten, schätzt die Mengen und zeigt einen ehrlichen Bereich statt Scheingenauigkeit.",
    points: ["Jede Zutat einzeln anpassbar", "Schätzbereich statt erfundener Kommastellen", "Auch per Foto deiner Mahlzeit"],
  },
  {
    screen: "barcode",
    icon: "barcode",
    kicker: "Scannen",
    title: "Barcode drauf. Fertig.",
    text: "Verpackung scannen, Originalfoto und Markenlogo sehen, Portion wählen. Werte, die die Community bestätigt hat, sind gekennzeichnet.",
    points: ["Schweizer und europäische Produkte", "Portionen statt Grammrechnen", "Fehlende Produkte selbst ergänzen"],
  },
  {
    screen: "search",
    icon: "search",
    kicker: "Suchen",
    title: "Was du oft isst, ist einen Tipp entfernt.",
    text: "Zuletzt verwendet, Favoriten und eine Datenbank mit regionalen Lebensmitteln. Das Birchermüesli vom Montag ist wieder genau so schnell eingetragen.",
    points: ["Zuletzt verwendet mit deiner üblichen Portion", "Favoriten und eigene Lebensmittel", "Findet auch Tippfehler und Schweizer Begriffe"],
  },
  {
    screen: "diary",
    icon: "chart",
    kicker: "Tagebuch",
    title: "Dein Monat auf einen Blick.",
    text: "Jeder Tag mit Kalorien, Makros und Wasser. Vergessene Mahlzeiten sind kein Drama: Markiere einen Tag als abgeschlossen, und er zählt trotzdem.",
    points: ["Kalender mit erfassten Tagen", "Tage bewusst abschliessen", "Mahlzeiten kopieren und planen"],
  },
];

const PRIVACY: { icon: IconName; title: string; text: string }[] = [
  { icon: "lock", title: "Einwilligung pro Zweck", text: "Gesundheitsdaten, KI, Apple Health, Community und Mitteilungen sind einzeln freigegeben und jederzeit widerrufbar." },
  { icon: "ban", title: "Keine Werbung, kein Tracking", text: "Kein Werbe-Tracking, kein Verkauf von Daten. Vitalo finanziert sich ausschliesslich über Vitalo Plus." },
  { icon: "export", title: "Export und Löschen", text: "Alle Daten als JSON oder CSV exportieren. Das Konto löschst du direkt in der App, sofort und vollständig." },
  { icon: "eyeOff", title: "Fotos bleiben privat", text: "Fortschrittsfotos sind standardmässig nur für dich. Das Körpermodell wird auf deinem iPhone berechnet." },
  { icon: "shield", title: "Gesunde Grenzen", text: "Nie unter 1'200 bzw. 1'500 kcal, kein Zielgewicht unter BMI 18.5, ein ruhiger Hinweis bei zu schnellem Tempo." },
  { icon: "heart", title: "Nie beschämen", text: "Keine roten Warnfarben, keine verlorenen Streaks wegen eines Tages, keine guten oder bösen Lebensmittel." },
];

const APPLE: { icon: IconName; title: string; text: string }[] = [
  { icon: "widget", title: "Widgets", text: "Restbudget, Makros und Wasser auf dem Home- und Sperrbildschirm." },
  { icon: "heart", title: "Apple Health", text: "Gewicht, Aktivität und Mahlzeiten, wenn du es möchtest. Beide Richtungen." },
  { icon: "mic", title: "Siri und Kurzbefehle", text: "Wasser eintragen, Restkalorien abfragen oder eine Mahlzeit erfassen, ohne die App zu öffnen." },
  { icon: "globe", title: "Deine Sprache", text: "Deutsch, Englisch, Französisch, Italienisch und Spanisch. Beim Start automatisch erkannt." },
];

const FAQ: [string, string][] = [
  ["Ersetzt Vitalo eine Ernährungsberatung?", "Nein. Vitalo hilft dir, deine Ernährung zu verstehen und kleine Änderungen umzusetzen. Es stellt keine Diagnosen und behandelt keine Krankheiten. Bei Erkrankungen, Medikamenten, Schwangerschaft oder Essstörungen wende dich bitte an eine Fachperson."],
  ["Wie genau ist die Erkennung per Foto oder Text?", "Die KI liefert Schätzungen, und genau so zeigt Vitalo sie an: mit einem Bereich und einer Sicherheit. Du siehst jede erkannte Zutat und korrigierst Mengen mit einem Tipp, bevor etwas gespeichert wird."],
  ["Was passiert mit meinen Daten?", "Deine Daten gehören dir. Sie werden verschlüsselt übertragen, nicht für Werbung genutzt und nicht verkauft. Fotos gehen nur mit deiner Zustimmung an die KI. Export und Löschung sind jederzeit in der App möglich. Details stehen in der Datenschutzerklärung."],
  ["Brauche ich ein Abo?", `Nein. Die Gratis-Version ist ein vollwertiger Kalorien- und Gewichtstracker inklusive Barcode, Datenbank und Community. Vitalo Plus kostet ${PRICES.monthly} ${PRICES.currency} pro Monat oder ${PRICES.yearly} ${PRICES.currency} pro Jahr und lässt sich ${PRICES.trialDays} Tage gratis testen.`],
  ["Wie kündige ich Vitalo Plus?", "In den iPhone-Einstellungen unter deinem Namen › Abonnements. Die Kündigung gilt zum Ende der laufenden Periode; bis dahin bleibt Plus aktiv."],
  ["Für wen ist Vitalo nicht gedacht?", "Für Personen unter 18 Jahren und als Ersatz für eine Behandlung. Bei Untergewicht bietet Vitalo keine Abnehmziele an, und es gibt einen Schutzmodus ohne Kaloriendefizit, etwa für Schwangerschaft oder Stillzeit."],
  ["Welche Geräte werden unterstützt?", "iPhone mit iOS 26 oder neuer. Deine Daten werden mit deinem Konto synchronisiert, damit sie bei einem Gerätewechsel erhalten bleiben."],
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container hero-copy">
          <p className="eyebrow hero-in" style={{ "--d": "0ms" } as React.CSSProperties}>Für iPhone · iOS 26</p>
          <h1 className="hero-title">
            <Words text="Ernährung, die sich" />{" "}
            <br className="br-wide" />
            <Words text="deinem Leben anpasst." start={3} />
          </h1>
          <p className="lead hero-in" style={{ "--d": "520ms" } as React.CSSProperties}>
            Vitalo erfasst Mahlzeiten in Sekunden, erkennt Muster in deinem Alltag und schlägt kleine Änderungen vor, die du wirklich durchhältst.
          </p>
          <div className="cta-row hero-in" style={{ "--d": "640ms" } as React.CSSProperties}>
            <AppStoreButton size="lg" />
            <a className="btn btn-ghost btn-lg" href="#erfassen">So funktioniert’s <Icon name="arrow" size={18} /></a>
          </div>
          <p className="hero-note hero-in" style={{ "--d": "760ms" } as React.CSSProperties}>Gratis nutzbar · Plus {PRICES.trialDays} Tage kostenlos testen · Keine Werbung</p>
        </div>
        <div className="hero-stage" aria-label="Screenshots der App">
          <div className="hero-phone hero-phone-left"><Phone screen="text" priority /></div>
          <div className="hero-phone hero-phone-center"><Phone screen="today" priority /></div>
          <div className="hero-phone hero-phone-right"><Phone screen="progress" priority /></div>
        </div>
      </section>

      {/* Facts */}
      <section className="facts-strip">
        <div className="container facts">
          <div className="fact" data-reveal><strong><CountUp to={5} /></strong><span>Wege, eine Mahlzeit zu erfassen</span></div>
          <div className="fact" data-reveal style={{ "--delay": "60ms" } as React.CSSProperties}><strong><CountUp to={5} /></strong><span>Sprachen, automatisch erkannt</span></div>
          <div className="fact" data-reveal style={{ "--delay": "120ms" } as React.CSSProperties}><strong><CountUp to={1200} /></strong><span>kcal Untergrenze, die nie unterschritten wird</span></div>
          <div className="fact" data-reveal style={{ "--delay": "180ms" } as React.CSSProperties}><strong><CountUp to={0} /></strong><span>Werbe-Tracker in der App</span></div>
        </div>
      </section>

      {/* Capture */}
      <section className="section" id="erfassen">
        <div className="container">
          <SectionHead eyebrow="Erfassen" title="Eine Mahlzeit. Ein paar Sekunden." text="Tippen, sprechen, fotografieren oder scannen: Du wählst den schnellsten Weg, Vitalo erledigt den Rest." />
          <div className="modes" data-reveal>
            {([["chat", "Beschreiben"], ["camera", "Foto"], ["barcode", "Barcode"], ["search", "Suche"], ["bolt", "Schnell"]] as [IconName, string][]).map(([icon, label], i) => (
              <span key={label} className="mode" style={{ "--delay": `${i * 60}ms` } as React.CSSProperties}><Icon name={icon} size={18} />{label}</span>
            ))}
          </div>
          <Story steps={STEPS} />
        </div>
      </section>

      {/* Coach */}
      <section className="section section-tint" id="coach">
        <div className="container split">
          <div className="split-copy">
            <SectionHead eyebrow="Adaptiver Coach" title="Er schlägt vor. Du entscheidest." text="Stagniert dein Gewicht, senkt Vitalo nicht einfach dein Budget. Der Coach sucht die Ursache in deinen Daten und bietet zwei, drei kleine Änderungen an." />
            <ul className="feature-list" data-reveal>
              <li><Icon name="bulb" /><div><strong>Erkennt Muster</strong><span>Protein, Hunger am Abend, Wochenenden, Tempo: über Wochen, nicht über einen Tag.</span></div></li>
              <li><Icon name="check" /><div><strong>Nichts ändert sich automatisch</strong><span>Jede Anpassung bestätigst du selbst. Oder du sagst „Nicht jetzt“.</span></div></li>
              <li><Icon name="chart" /><div><strong>Begründet jeden Vorschlag</strong><span>Mit deinen echten Zahlen, ohne Fachchinesisch und ohne Vorwürfe.</span></div></li>
            </ul>
          </div>
          <div className="coach-demo" data-reveal>
            <div className="coach-card">
              <div className="coach-top"><span className="coach-label"><Icon name="bulb" size={18} />Coach</span><span className="coach-x" aria-hidden>×</span></div>
              <h3>Mehr Protein am Abend</h3>
              <p>Dein Protein lag an 5 der letzten 7 Tage unter 80 % deines Ziels (im Schnitt 69 g von 116 g). Ein proteinreiches Abendessen oder ein Snack schliesst die Lücke und hält länger satt.</p>
              <div className="coach-bars" aria-hidden>
                {[62, 71, 58, 96, 66, 74, 101].map((v, i) => (
                  <span key={i} style={{ "--h": `${v}%`, "--i": i } as React.CSSProperties} data-low={v < 80} />
                ))}
              </div>
              <p className="coach-basis">Auf Basis deiner Daten der letzten 7 Tage</p>
              <div className="coach-actions">
                <span className="btn btn-primary btn-sm">Proteinreiche Ideen zeigen</span>
                <span className="btn btn-ghost btn-sm">Nicht jetzt</span>
              </div>
            </div>
            <div className="coach-phone"><Phone screen="today" /></div>
          </div>
        </div>
      </section>

      {/* Progress */}
      <section className="section" id="fortschritt">
        <div className="container">
          <SectionHead eyebrow="Fortschritt" title="Trend statt Tageslaune." text="Wasser, Salz und Zyklus lassen die Waage täglich schwanken. Vitalo glättet die Messungen zu einem Trend und zeigt Prognosen als ehrlichen Bereich." center />
          <div className="progress-grid">
            <div className="card card-chart"><TrendChart /></div>
            <div className="card card-phone" data-reveal style={{ "--delay": "100ms" } as React.CSSProperties}>
              <Phone screen="progress" />
            </div>
          </div>

          <div className="body-row">
            <div className="body-copy" data-reveal>
              <p className="eyebrow">Körpermodell</p>
              <h3>Sieh, wohin dein Weg führt.</h3>
              <p>Eine Silhouette von heute neben deinem Ziel, geschätzt aus Grösse, Gewicht und Massen. Ziehe den Regler und sieh die Etappen dazwischen.</p>
              <ul className="ticks">
                <li><Icon name="check" size={16} />Auf deinem iPhone berechnet, nie hochgeladen</li>
                <li><Icon name="check" size={16} />Veranschaulichung mit Schätzbereich, kein Abbild</li>
                <li><Icon name="check" size={16} />Taille, Hüfte und Verhältnis im Verlauf</li>
              </ul>
            </div>
            <div className="body-phones" data-reveal style={{ "--delay": "80ms" } as React.CSSProperties}>
              <Phone screen="body" className="tilt-left" />
              <Phone screen="ob-plan" className="tilt-right" />
            </div>
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="section section-tint" id="community">
        <div className="container split split-reverse">
          <div className="split-copy">
            <SectionHead eyebrow="Community" title="Gemeinsam fällt es leichter. Freiwillig." text="Teile Meilensteine, mach bei Challenges mit und finde Menschen mit ähnlichen Zielen. Erst wenn du willst, und nur so viel, wie du willst." />
            <ul className="feature-list" data-reveal>
              <li><Icon name="person" /><div><strong>Mit Pseudonym</strong><span>Dein echter Name und deine E-Mail-Adresse werden nie angezeigt.</span></div></li>
              <li><Icon name="eyeOff" /><div><strong>Zahlen bleiben verborgen</strong><span>Gewicht, Kalorien und Masse erscheinen nur, wenn du sie selbst teilst.</span></div></li>
              <li><Icon name="people" /><div><strong>Challenges ohne Druck</strong><span>Gemüse, Wasser, Frühstück, Schritte. Abnehm-Wettbewerbe gibt es bewusst nicht.</span></div></li>
              <li><Icon name="shield" /><div><strong>Moderiert</strong><span>Kein Body-Shaming, keine extremen Diäten, keine Werbung. Meldungen werden geprüft.</span></div></li>
            </ul>
            <Link href="/community-richtlinien" className="text-link" data-reveal>Community-Richtlinien lesen <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="split-media" data-reveal>
            <Phone screen="community" />
          </div>
        </div>
      </section>

      {/* Apple */}
      <section className="section">
        <div className="container">
          <SectionHead eyebrow="Für iPhone gebaut" title="Fühlt sich an wie ein Teil von iOS." text="Vitalo ist nativ in SwiftUI entwickelt und nutzt, was dein iPhone kann. Keine Web-Hülle, keine Kompromisse." center />
          <div className="tiles">
            {APPLE.map((item, i) => (
              <article key={item.title} className="tile" data-reveal style={{ "--delay": `${i * 70}ms` } as React.CSSProperties}>
                <span className="tile-icon"><Icon name={item.icon} /></span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <div className="languages" data-reveal aria-label="Begrüssung in fünf Sprachen">
            <span className="lang-label">Vitalo sagt</span>
            <span className="rotator" aria-hidden>
              <span>Grüezi</span><span>Hello</span><span>Bonjour</span><span>Ciao</span><span>Hola</span><span>Grüezi</span>
            </span>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="section section-ink" id="datenschutz">
        <div className="container">
          <SectionHead eyebrow="Datenschutz und Sicherheit" title="Deine Gesundheit. Deine Daten." text="Gesundheitsdaten sind besonders schützenswert. Deshalb sind Datenschutz und Schutzmechanismen bei Vitalo Teil des Produkts, nicht das Kleingedruckte." />
          <div className="privacy-grid">
            {PRIVACY.map((item, i) => (
              <article key={item.title} className="privacy-item" data-reveal style={{ "--delay": `${(i % 3) * 70}ms` } as React.CSSProperties}>
                <Icon name={item.icon} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <Link href="/datenschutz" className="text-link" data-reveal>Zur Datenschutzerklärung <Icon name="arrow" size={16} /></Link>
        </div>
      </section>

      {/* Pricing */}
      <section className="section" id="preise">
        <div className="container">
          <SectionHead eyebrow="Preise" title="Gratis starten. Plus, wenn es passt." text="Keine Werbung, kein Datenverkauf. Vitalo Plus finanziert die KI und den Coach." center />
          <Pricing />
        </div>
      </section>

      {/* FAQ */}
      <section className="section section-tint" id="fragen">
        <div className="container narrow">
          <SectionHead eyebrow="Fragen" title="Gut zu wissen." center />
          <div className="faq">
            {FAQ.map(([q, a], i) => (
              <details key={q} className="faq-item" data-reveal style={{ "--delay": `${i * 40}ms` } as React.CSSProperties}>
                <summary>{q}<span className="faq-sign" aria-hidden /></summary>
                <div className="faq-body"><p>{a}</p></div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Download */}
      <section className="section final" id="laden">
        <div className="container final-inner">
          <div className="final-copy" data-reveal>
            <img src="/site/icon.png" alt="" width={88} height={88} className="final-icon" />
            <h2>Dein Ernährungscoach wartet.</h2>
            <p className="lead">Lade Vitalo auf dein iPhone, beantworte acht kurze Fragen und erfasse deine erste Mahlzeit in unter drei Minuten.</p>
            <div className="cta-row center"><AppStoreButton size="lg" /></div>
            <p className="hero-note">Ab 18 Jahren · iPhone mit iOS 26</p>
          </div>
          <div className="final-phones" data-reveal style={{ "--delay": "120ms" } as React.CSSProperties}>
            <Phone screen="ob-welcome" />
            <Phone screen="profile" />
          </div>
        </div>
      </section>
    </>
  );
}
