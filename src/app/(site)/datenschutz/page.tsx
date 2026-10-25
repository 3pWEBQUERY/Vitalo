import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../components/Legal";
import { COMPANY } from "../site";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

export default function DatenschutzPage() {
  const mail = <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>;
  return (
    <LegalPage
      title="Datenschutzerklärung"
      intro="Wie Vitalo mit deinen Daten umgeht: welche wir bearbeiten, wozu, wie lange und welche Rechte du hast. Sie gilt für die App Vitalo und für diese Website."
      note={<p><strong>Kurz gesagt:</strong> Wir bearbeiten nur Daten, die eine Funktion braucht. Gesundheitsdaten nur mit deiner ausdrücklichen Einwilligung. Kein Werbe-Tracking, kein Verkauf von Daten. Export und Löschung jederzeit direkt in der App.</p>}
      sections={[
        {
          id: "verantwortlich",
          title: "Verantwortliche Stelle",
          body: (
            <>
              <p>Verantwortlich für die Bearbeitung deiner Personendaten ist:</p>
              <address><p>{COMPANY.name} {COMPANY.legalForm}<br />{COMPANY.street}<br />{COMPANY.city}<br />{COMPANY.country}<br />E-Mail: {mail}</p></address>
              <p>Für Personen in der EU und im EWR: {COMPANY.euRepresentative}.</p>
              <p>Diese Erklärung richtet sich nach dem Schweizer Bundesgesetz über den Datenschutz (DSG) und, soweit anwendbar, nach der Datenschutz-Grundverordnung der EU (DSGVO).</p>
            </>
          ),
        },
        {
          id: "daten",
          title: "Welche Daten wir bearbeiten",
          body: (
            <>
              <table>
                <thead><tr><th>Kategorie</th><th>Beispiele</th><th>Woher</th></tr></thead>
                <tbody>
                  <tr><td>Konto</td><td>Kennung von „Mit Apple anmelden“, auf Wunsch eine (auch anonymisierte) E-Mail-Adresse, Sprache</td><td>Von dir über Apple</td></tr>
                  <tr><td>Profil</td><td>Geburtsjahr, Berechnungsgrundlage (weiblich/männlich), Grösse, Aktivitätsniveau, Ernährungsform, Allergene</td><td>Von dir</td></tr>
                  <tr><td>Gesundheitsdaten</td><td>Gewicht, Körpermasse, Mahlzeiten und Nährwerte, Wasser, Check-ins (Hunger, Stimmung, Schlaf), Ziele</td><td>Von dir, optional aus Apple Health</td></tr>
                  <tr><td>Fotos</td><td>Mahlzeiten- und Etikettfotos für die Erkennung, Fortschrittsfotos, Bilder in Beiträgen</td><td>Von dir</td></tr>
                  <tr><td>Community</td><td>Pseudonym, Profiltext, Beiträge, Kommentare, Reaktionen, Gruppen, Meldungen</td><td>Von dir</td></tr>
                  <tr><td>Abonnement</td><td>Produkt, Transaktionskennung, Status und Ablaufdatum. Keine Zahlungsdaten.</td><td>Von Apple</td></tr>
                  <tr><td>Technische Daten</td><td>Gerätename, App-Version, Push-Token, Zeitpunkte von Anmeldungen, IP-Adresse in Server-Logs</td><td>Von deinem Gerät</td></tr>
                  <tr><td>Einwilligungen</td><td>Zweck, Version, Zeitpunkt und ein Fingerabdruck des angezeigten Texts</td><td>Von dir</td></tr>
                </tbody>
              </table>
              <p>Gesundheitsdaten gelten als besonders schützenswerte Personendaten. Wir bearbeiten sie nur mit deiner ausdrücklichen Einwilligung, die du in der App einzeln erteilst und jederzeit widerrufen kannst.</p>
            </>
          ),
        },
        {
          id: "zwecke",
          title: "Zwecke und Rechtsgrundlagen",
          body: (
            <ul>
              <li><strong>Bereitstellung der App</strong> (Konto, Tagebuch, Synchronisierung, Berechnung deines Plans): zur Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO).</li>
              <li><strong>Gesundheitsfunktionen</strong> (Kalorienbudget, Trend, Körpermodell, Coach): mit deiner ausdrücklichen Einwilligung (Art. 6 Abs. 1 lit. a und Art. 9 Abs. 2 lit. a DSGVO, Art. 6 Abs. 7 DSG).</li>
              <li><strong>KI-Erkennung</strong> von Text, Fotos und Etiketten: mit deiner gesonderten Einwilligung zur KI-Verarbeitung.</li>
              <li><strong>Community</strong> und Moderation: mit deiner Einwilligung beim Beitritt und zur Erfüllung des Vertrags; der Schutz anderer Nutzerinnen und Nutzer ist zudem unser berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).</li>
              <li><strong>Abonnements</strong>: zur Vertragserfüllung und zur Erfüllung gesetzlicher Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO).</li>
              <li><strong>Sicherheit und Missbrauchsschutz</strong> (Rate-Limits, Prüfung von Anmeldungen, Fehleranalyse ohne Gesundheitswerte): berechtigtes Interesse.</li>
              <li><strong>Mitteilungen</strong> (Erinnerungen, Wochenrückblick): mit deiner Einwilligung in iOS. Mitteilungen enthalten keine Körperwerte.</li>
            </ul>
          ),
        },
        {
          id: "ki",
          title: "Künstliche Intelligenz",
          body: (
            <>
              <p>Wenn du eine Mahlzeit beschreibst oder fotografierst, senden wir den Text oder das Foto über unseren Server an das Sprachmodell Claude der Anthropic PBC (USA). Mit dem Ergebnis schätzen wir Zutaten, Mengen und Nährwerte. Anthropic erhält dabei weder deinen Namen noch deine E-Mail-Adresse. Fotos werden vor der Übermittlung von Standortdaten befreit.</p>
              <p>Nach den Vertragsbedingungen für die Anthropic-API werden die Inhalte nicht zum Training von Modellen verwendet und nur für eine begrenzte Dauer zur Missbrauchserkennung aufbewahrt. Wir selbst speichern zu jeder KI-Anfrage nur Art, Zeitpunkt, Dauer, Tokenzahl und Kosten, nicht den Inhalt.</p>
              <p>Texte in der Community werden vor der Veröffentlichung automatisch auf Verstösse gegen die <Link href="/community-richtlinien">Community-Richtlinien</Link> geprüft. Auffällige Inhalte werden zurückgehalten und von einem Menschen beurteilt. Der Coach erstellt Vorschläge nach festen Regeln aus deinen Daten; Änderungen an deinen Zielen nimmt er nie ohne deine Bestätigung vor.</p>
            </>
          ),
        },
        {
          id: "health",
          title: "Apple Health",
          body: <p>Mit deiner Erlaubnis liest Vitalo Gewicht und Aktivität aus Apple Health und schreibt Gewicht, Wasser und Mahlzeiten dorthin. Daten aus Apple Health verwenden wir ausschliesslich für die Funktionen der App. Sie werden nicht für Werbung genutzt, nicht verkauft und nicht an Datenhändler weitergegeben. Den Zugriff steuerst du jederzeit in der Health-App.</p>,
        },
        {
          id: "empfaenger",
          title: "Empfänger und Auftragsbearbeiter",
          body: (
            <>
              <p>Wir geben Personendaten nur weiter, wenn es für eine Funktion nötig ist, und nur an sorgfältig ausgewählte Dienstleister, die vertraglich an unsere Weisungen gebunden sind:</p>
              <table>
                <thead><tr><th>Empfänger</th><th>Zweck</th><th>Ort</th></tr></thead>
                <tbody>
                  <tr><td>Railway Corp.</td><td>Hosting von Server, Datenbank und Dateispeicher</td><td>[Region prüfen]</td></tr>
                  <tr><td>Anthropic PBC</td><td>KI-Erkennung und Moderation</td><td>USA</td></tr>
                  <tr><td>Apple Inc. und Apple Distribution International</td><td>Anmeldung, Mitteilungen, In-App-Käufe</td><td>Irland, USA</td></tr>
                </tbody>
              </table>
              <p>Für Barcodes fragt unser Server die freie Datenbank Open Food Facts ab, für Markenlogos den Dienst Brandfetch. Dabei werden nur der Barcode beziehungsweise der Markenname übermittelt, keine Daten über dich.</p>
              <p>Bei Übermittlungen in Länder ohne angemessenes Datenschutzniveau, etwa die USA, stützen wir uns auf eine Zertifizierung des Empfängers nach dem Swiss-U.S. bzw. EU-U.S. Data Privacy Framework oder auf die Standardvertragsklauseln der EU-Kommission, die vom Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) anerkannt sind.</p>
            </>
          ),
        },
        {
          id: "speicherdauer",
          title: "Speicherdauer",
          body: (
            <ul>
              <li>Konto-, Profil- und Gesundheitsdaten: bis du dein Konto löschst. Die Löschung in der App erfolgt sofort; Sicherungskopien laufen spätestens nach 30 Tagen aus.</li>
              <li>Fortschrittsfotos und Bilder: bis du sie oder dein Konto löschst.</li>
              <li>Von der Moderation zurückgehaltene Beiträge ohne Entscheid: 30 Tage.</li>
              <li>Protokolle zu KI-Anfragen (ohne Inhalte): 13 Monate.</li>
              <li>Abgemeldete oder abgelaufene Geräte-Sitzungen: 30 Tage.</li>
              <li>Abrechnungsrelevante Angaben zu Abonnements: solange gesetzliche Aufbewahrungspflichten bestehen, in der Regel 10 Jahre.</li>
              <li>Von dir beigetragene öffentliche Lebensmitteleinträge bleiben nach der Konto-Löschung ohne Bezug zu deiner Person erhalten.</li>
            </ul>
          ),
        },
        {
          id: "rechte",
          title: "Deine Rechte",
          body: (
            <>
              <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Bearbeitung, Datenherausgabe und -übertragung sowie Widerspruch. Erteilte Einwilligungen kannst du jederzeit mit Wirkung für die Zukunft widerrufen, in der App unter Profil › Datenschutz.</p>
              <p>Vieles erledigst du direkt in der App: Datenexport als JSON oder CSV, Löschung einzelner Einträge und Fotos, Löschung des ganzen Kontos. Für alles andere schreib an {mail}. Wir antworten innerhalb von 30 Tagen.</p>
              <p>Du kannst dich bei einer Aufsichtsbehörde beschweren, in der Schweiz beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB), in der EU bei der Behörde deines Wohnsitzlandes.</p>
            </>
          ),
        },
        {
          id: "sicherheit",
          title: "Sicherheit",
          body: <p>Alle Verbindungen sind mit TLS verschlüsselt. Jede Abfrage ist an dein Konto gebunden, und automatisierte Tests prüfen, dass keine Schnittstelle Daten anderer Personen liefert. Dateien liegen in einem privaten Speicher und werden nur nach einer Berechtigungsprüfung ausgeliefert. Protokolle und Absturzberichte enthalten keine Gesundheitswerte, Fotos oder Freitexte. Der Zugang unseres Teams ist mit Zwei-Faktor-Anmeldung geschützt und wird protokolliert.</p>,
        },
        {
          id: "website",
          title: "Diese Website",
          body: (
            <>
              <p>Die Website verwendet keine Cookies, keine Analyse- und keine Werbedienste. Deine Wahl zwischen hellem und dunklem Design speichert dein Browser lokal; sie wird nicht an uns übertragen.</p>
              <p>Beim Aufruf verarbeitet unser Hosting-Anbieter technisch notwendige Daten wie IP-Adresse, Zeitpunkt, aufgerufene Seite und Browsertyp in Server-Logs, um die Website sicher auszuliefern. Diese Logs werden nach kurzer Zeit automatisch gelöscht.</p>
            </>
          ),
        },
        {
          id: "alter",
          title: "Mindestalter",
          body: <p>Vitalo richtet sich an Erwachsene ab 18 Jahren. Wir bearbeiten wissentlich keine Daten von Minderjährigen. Erfahren wir davon, löschen wir das Konto.</p>,
        },
        {
          id: "aenderungen",
          title: "Änderungen",
          body: <p>Wir passen diese Erklärung an, wenn sich unsere Datenbearbeitung oder das Recht ändern. Bei wesentlichen Änderungen informieren wir dich in der App und holen, wo nötig, deine Einwilligung erneut ein.</p>,
        },
      ]}
    />
  );
}
