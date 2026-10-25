import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../components/Legal";
import { COMPANY, PRICES } from "../site";

export const metadata: Metadata = { title: "Allgemeine Geschäftsbedingungen" };

export default function AgbPage() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen"
      intro={`Diese Bedingungen regeln die Nutzung der App Vitalo und des Abonnements Vitalo Plus zwischen dir und ${COMPANY.name}.`}
      sections={[
        {
          id: "geltung",
          title: "Geltungsbereich",
          body: (
            <>
              <p>Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der iOS-App Vitalo und der damit verbundenen Dienste (zusammen „Vitalo“), angeboten von {COMPANY.name}, {COMPANY.street}, {COMPANY.city} („wir“).</p>
              <p>Mit dem Erstellen eines Kontos akzeptierst du diese AGB, die <Link href="/community-richtlinien">Community-Richtlinien</Link> und nimmst die <Link href="/datenschutz">Datenschutzerklärung</Link> zur Kenntnis.</p>
            </>
          ),
        },
        {
          id: "leistungen",
          title: "Leistungen",
          body: (
            <>
              <p>Vitalo unterstützt dich beim Erfassen deiner Ernährung, beim Verfolgen von Gewicht und Körpermassen und beim Erreichen selbst gesetzter Ziele. Dazu gehören unter anderem ein Ernährungstagebuch, eine Lebensmitteldatenbank, KI-gestützte Erkennung von Mahlzeiten, ein Coach mit Vorschlägen, ein Körpermodell und ein freiwilliger Community-Bereich.</p>
              <p>Nährwerte, KI-Ergebnisse, Prognosen und das Körpermodell sind Schätzungen. Sie können ungenau sein und werden in der App als Bereich dargestellt.</p>
            </>
          ),
        },
        {
          id: "gesundheit",
          title: "Keine medizinische Leistung",
          body: (
            <>
              <p>Vitalo ist kein Medizinprodukt und stellt keine Diagnosen, Therapien oder Behandlungen bereit. Die App ersetzt keine ärztliche oder ernährungsmedizinische Beratung.</p>
              <p>Bei Erkrankungen, der Einnahme von Medikamenten, Schwangerschaft, Stillzeit oder einer bestehenden oder vermuteten Essstörung sprich vor der Nutzung mit einer Fachperson. Angaben zu Allergenen und Unverträglichkeiten in der Datenbank stammen teilweise von der Community und sind keine Garantie; massgeblich bleibt die Verpackung.</p>
              <p>Zu deinem Schutz setzt Vitalo Grenzen: Das Kalorienziel liegt nie unter 1'200 kcal (weibliche und neutrale Berechnung) beziehungsweise 1'500 kcal (männliche Berechnung), und Zielgewichte unter einem BMI von 18.5 werden nicht angeboten.</p>
            </>
          ),
        },
        {
          id: "konto",
          title: "Konto und Mindestalter",
          body: (
            <ul>
              <li>Die Nutzung ist ab 18 Jahren erlaubt. Mit der Registrierung bestätigst du dein Alter.</li>
              <li>Die Anmeldung erfolgt mit „Mit Apple anmelden“. Pro Person ist ein Konto erlaubt; es ist nicht übertragbar.</li>
              <li>Halte deine Angaben aktuell, soweit sie für die Berechnung deines Plans nötig sind. Für die Sicherheit deines Apple-Accounts bist du selbst verantwortlich.</li>
            </ul>
          ),
        },
        {
          id: "plus",
          title: "Vitalo Plus",
          body: (
            <>
              <p>Grundfunktionen von Vitalo sind kostenlos. Zusätzliche Funktionen bietet das Abonnement Vitalo Plus, derzeit für {PRICES.monthly} {PRICES.currency} pro Monat oder {PRICES.yearly} {PRICES.currency} pro Jahr. Massgeblich sind die Preise, die dir im App Store vor dem Kauf angezeigt werden; sie können je nach Land abweichen.</p>
              <ul>
                <li><strong>Kauf und Abrechnung</strong> erfolgen ausschliesslich über deinen Apple-Account. Es gelten zusätzlich die Bedingungen von Apple für Medienangebote.</li>
                <li><strong>Testphase:</strong> Neue Abonnentinnen und Abonnenten können Vitalo Plus {PRICES.trialDays} Tage kostenlos testen. Kündigst du nicht mindestens 24 Stunden vor Ende der Testphase, beginnt das kostenpflichtige Abonnement.</li>
                <li><strong>Verlängerung:</strong> Das Abonnement verlängert sich automatisch um die gewählte Laufzeit, sofern es nicht mindestens 24 Stunden vor Ablauf gekündigt wird.</li>
                <li><strong>Kündigung</strong> jederzeit in den iPhone-Einstellungen unter deinem Namen › Abonnements, mit Wirkung zum Ende der laufenden Periode.</li>
                <li><strong>Erstattungen</strong> richten sich nach den Regeln von Apple und werden bei Apple beantragt.</li>
                <li><strong>Preisänderungen</strong> teilen wir rechtzeitig über Apple mit. Wo nötig, gelten sie erst nach deiner Zustimmung.</li>
              </ul>
              <p>Sicherheitsfunktionen, der Datenexport und die Löschung deines Kontos sind nie kostenpflichtig.</p>
            </>
          ),
        },
        {
          id: "ki",
          title: "KI-Funktionen und Kontingente",
          body: <p>Die KI-Erkennung steht im Rahmen eines täglichen Kontingents zur Verfügung, das in der App angezeigt wird. In Vitalo Plus gilt ein höheres Kontingent nach dem Grundsatz der fairen Nutzung. Fehlgeschlagene Anfragen zählen nicht zum Kontingent. Bei technischen Störungen können KI-Funktionen vorübergehend nicht verfügbar sein; die manuelle Erfassung, der Barcode-Scan und die Suche bleiben nutzbar.</p>,
        },
        {
          id: "inhalte",
          title: "Deine Inhalte",
          body: (
            <>
              <p>Inhalte, die du erstellst, bleiben deine. Für Inhalte, die du in der Community veröffentlichst, räumst du uns ein nicht exklusives, unentgeltliches Recht ein, sie innerhalb von Vitalo im Rahmen der von dir gewählten Sichtbarkeit anzuzeigen. Das Recht endet, wenn du den Inhalt oder dein Konto löschst.</p>
              <p>Lebensmitteleinträge, die du öffentlich beiträgst, stellst du der Community dauerhaft zur Verfügung. Sie bleiben nach einer Konto-Löschung ohne Bezug zu deiner Person erhalten, damit die Datenbank vollständig bleibt.</p>
              <p>Du stellst sicher, dass deine Inhalte keine Rechte Dritter verletzen und den Community-Richtlinien entsprechen.</p>
            </>
          ),
        },
        {
          id: "community",
          title: "Community und Moderation",
          body: <p>Der Community-Bereich ist freiwillig. Wir dürfen Inhalte, die gegen diese AGB, die <Link href="/community-richtlinien">Community-Richtlinien</Link> oder geltendes Recht verstossen, zurückhalten oder entfernen und Verwarnungen, befristete Sperren oder einen Ausschluss aus der Community aussprechen. Gegen eine Sanktion kannst du in der App Einspruch erheben; ein Mensch prüft ihn. Die übrigen Funktionen der App bleiben dir dabei erhalten.</p>,
        },
        {
          id: "pflichten",
          title: "Was nicht erlaubt ist",
          body: (
            <ul>
              <li>Vitalo automatisiert auszulesen, zu überlasten oder Sicherheitsmassnahmen zu umgehen.</li>
              <li>Konten anderer zu nutzen oder sich als andere Person auszugeben.</li>
              <li>Vitalo für Werbung, Verkauf oder gewerbliche Zwecke ohne unsere Zustimmung zu nutzen.</li>
              <li>Absichtlich falsche Nährwerte in die Datenbank einzutragen.</li>
            </ul>
          ),
        },
        {
          id: "verfuegbarkeit",
          title: "Verfügbarkeit und Änderungen am Dienst",
          body: <p>Wir bemühen uns um einen unterbrechungsfreien Betrieb, können ihn aber nicht garantieren. Wartungen, Störungen bei Dienstleistern oder höhere Gewalt können zu Ausfällen führen. Wir entwickeln Vitalo weiter und dürfen Funktionen ändern, sofern der vertragliche Kern, insbesondere für laufende Abonnements, gewahrt bleibt.</p>,
        },
        {
          id: "haftung",
          title: "Haftung",
          body: (
            <>
              <p>Wir haften unbeschränkt für Schäden aus absichtlichem oder grobfahrlässigem Verhalten sowie für Personenschäden. Für leichte Fahrlässigkeit haften wir, soweit gesetzlich zulässig, nur bei Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, typischen Schaden. Eine weitergehende Haftung ist ausgeschlossen, soweit das Gesetz dies erlaubt.</p>
              <p>Für Entscheidungen, die du auf Grundlage von Schätzungen, Prognosen oder Vorschlägen in Vitalo triffst, bist du selbst verantwortlich. Zwingende Bestimmungen des Konsumentenschutzes bleiben vorbehalten.</p>
            </>
          ),
        },
        {
          id: "ende",
          title: "Kündigung und Konto-Löschung",
          body: <p>Du kannst dein Konto jederzeit in der App löschen. Ein laufendes Abonnement kündigst du separat bei Apple. Wir können den Vertrag aus wichtigem Grund, etwa bei schweren oder wiederholten Verstössen gegen diese AGB, kündigen und das Konto sperren. Bei einer Kündigung durch uns ohne dein Verschulden erstatten wir bereits bezahlte, nicht genutzte Beträge anteilig, soweit dies nicht über Apple erfolgt.</p>,
        },
        {
          id: "apple",
          title: "Hinweise zu Apple",
          body: <p>Diese AGB werden zwischen dir und uns geschlossen, nicht mit Apple. Apple ist nicht verantwortlich für Vitalo, dessen Inhalte, Wartung oder Support und hat keine Gewährleistungspflichten in Bezug auf Vitalo, ausser einer allfälligen Rückerstattung des Kaufpreises nach den Regeln von Apple. Für Ansprüche im Zusammenhang mit Vitalo, einschliesslich Produkthaftung, Verletzung von Rechten Dritter oder Verbraucherschutz, sind wir und nicht Apple verantwortlich. Apple und ihre Tochtergesellschaften sind Drittbegünstigte dieser AGB und können sie dir gegenüber durchsetzen.</p>,
        },
        {
          id: "aenderungen",
          title: "Änderungen dieser AGB",
          body: <p>Wir können diese AGB mit Wirkung für die Zukunft anpassen. Über wesentliche Änderungen informieren wir dich mindestens 30 Tage im Voraus in der App. Nutzt du Vitalo danach weiter, gelten die neuen AGB; du kannst stattdessen dein Konto löschen.</p>,
        },
        {
          id: "recht",
          title: "Anwendbares Recht und Gerichtsstand",
          body: <p>Es gilt Schweizer Recht unter Ausschluss des UN-Kaufrechts. Gerichtsstand ist der Sitz von {COMPANY.name}. Für Konsumentinnen und Konsumenten gelten die zwingenden Gerichtsstände und Schutzvorschriften ihres Wohnsitzstaates.</p>,
        },
        {
          id: "schluss",
          title: "Schlussbestimmungen",
          body: <p>Sollte eine Bestimmung dieser AGB unwirksam sein, bleiben die übrigen Bestimmungen gültig. An die Stelle der unwirksamen Bestimmung tritt eine Regelung, die ihrem Zweck am nächsten kommt. Fragen zu diesen AGB beantworten wir unter <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>,
        },
      ]}
    />
  );
}
