"use client";

import { useState } from "react";
import { PRICES } from "../site";
import { Icon } from "./Icon";

const FREE = [
  "Erfassen per Suche, Barcode und Schnelleintrag",
  "Lebensmitteldatenbank mit Schweizer Produkten",
  "3 KI-Erfassungen pro Tag (Text und Foto)",
  "Wasser, Gewicht, Masse und Check-ins",
  "Makros, Tagebuch und einfacher Wochenrückblick",
  "Community: lesen, posten, Gruppen beitreten",
];

const PLUS = [
  "KI-Erfassung mit grossem Tageskontingent",
  "Voller Coach mit Ursachen und Vorschlägen",
  "Mikronährstoffe und Ernährungsscore",
  "Körpermodell mit Meilenstein-Vorschau",
  "Unbegrenzt Fortschrittsfotos mit Vergleich",
  "Eigene Gruppen mit Challenges, alle Widgets",
];

export function Pricing() {
  const [yearly, setYearly] = useState(true);
  const monthlyOfYear = (Number(PRICES.yearly) / 12).toFixed(2);
  const saving = Math.round((1 - Number(PRICES.yearly) / (Number(PRICES.monthly) * 12)) * 100);

  return (
    <div className="pricing">
      <div className="billing-switch" role="radiogroup" aria-label="Abrechnung">
        <button type="button" role="radio" aria-checked={!yearly} onClick={() => setYearly(false)}>Monatlich</button>
        <button type="button" role="radio" aria-checked={yearly} onClick={() => setYearly(true)}>
          Jährlich <span className="save">−{saving} %</span>
        </button>
        <span className="billing-thumb" data-yearly={yearly} aria-hidden />
      </div>

      <div className="plans">
        <article className="plan" data-reveal>
          <h3>Gratis</h3>
          <p className="plan-lead">Ein vollwertiger Kalorien- und Gewichtstracker. Für immer.</p>
          <div className="price"><span className="amount">0</span><span className="per">{PRICES.currency}</span></div>
          <ul className="ticks">{FREE.map((f) => <li key={f}><Icon name="check" size={16} />{f}</li>)}</ul>
        </article>

        <article className="plan plan-plus" data-reveal style={{ "--delay": "80ms" } as React.CSSProperties}>
          <div className="plan-head">
            <h3>Vitalo Plus</h3>
            <span className="pill">{PRICES.trialDays} Tage gratis</span>
          </div>
          <p className="plan-lead">Für alle, die schneller erfassen und gezielter vorankommen wollen.</p>
          <div className="price" aria-live="polite">
            <span className="amount" key={String(yearly)}>{yearly ? PRICES.yearly : PRICES.monthly}</span>
            <span className="per">{PRICES.currency} / {yearly ? "Jahr" : "Monat"}</span>
          </div>
          <p className="price-note">{yearly ? `Entspricht ${monthlyOfYear} ${PRICES.currency} pro Monat.` : "Monatlich kündbar in den iPhone-Einstellungen."}</p>
          <ul className="ticks">
            <li className="muted-tick"><Icon name="check" size={16} />Alles aus Gratis</li>
            {PLUS.map((f) => <li key={f}><Icon name="check" size={16} />{f}</li>)}
          </ul>
        </article>
      </div>
      <p className="pricing-foot">Sicherheitsfunktionen, Datenexport und Konto-Löschung sind nie kostenpflichtig. Abgerechnet wird über deinen Apple-Account; Preise inkl. MWST.</p>
    </div>
  );
}
