import type { Metadata } from "next";
import { LegalPage } from "../components/Legal";
import { COMPANY } from "../site";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <LegalPage
      title="Impressum"
      intro="Angaben zum Anbieter der App Vitalo und dieser Website."
      sections={[
        {
          id: "anbieter",
          title: "Anbieter",
          body: (
            <address>
              <p>
                {COMPANY.name} {COMPANY.legalForm}<br />
                {COMPANY.street}<br />
                {COMPANY.city}<br />
                {COMPANY.country}
              </p>
            </address>
          ),
        },
        {
          id: "kontakt",
          title: "Kontakt",
          body: (
            <p>
              E-Mail: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a><br />
              Support: <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a><br />
              Datenschutz: <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
            </p>
          ),
        },
        {
          id: "register",
          title: "Handelsregister",
          body: (
            <p>
              Eingetragen im {COMPANY.register}<br />
              Unternehmens-Identifikationsnummer (UID): {COMPANY.uid}<br />
              Vertretungsberechtigt: {COMPANY.representative}
            </p>
          ),
        },
        {
          id: "haftung",
          title: "Haftungsausschluss",
          body: (
            <>
              <p>Die Inhalte dieser Website werden mit grösster Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität übernehmen wir jedoch keine Gewähr. Vitalo und diese Website ersetzen keine ärztliche oder ernährungsmedizinische Beratung.</p>
              <p>Für Inhalte externer Links sind ausschliesslich deren Betreiber verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstösse erkennbar.</p>
            </>
          ),
        },
        {
          id: "rechte",
          title: "Urheber- und Markenrechte",
          body: <p>Texte, Bilder, Screenshots und Gestaltung dieser Website gehören {COMPANY.name} oder den jeweiligen Rechteinhabern. Apple, das Apple Logo, iPhone und App Store sind Marken der Apple Inc., eingetragen in den USA und weiteren Ländern.</p>,
        },
      ]}
    />
  );
}
