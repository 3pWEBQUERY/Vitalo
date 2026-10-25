import type { Metadata } from "next";
import { LegalPage } from "../components/Legal";
import { COMPANY } from "../site";

export const metadata: Metadata = { title: "Community-Richtlinien" };

export default function CommunityRulesPage() {
  return (
    <LegalPage
      title="Community-Richtlinien"
      intro="Die Vitalo-Community ist ein Ort für Unterstützung, nicht für Vergleiche. Diese Regeln halten ihn freundlich und sicher."
      note={<p><strong>Brauchst du Hilfe?</strong> Wenn du mit deinem Essverhalten kämpfst, bist du nicht allein. In der Schweiz hilft die Dargebotene Hand unter Telefon 143, in Deutschland die Telefonseelsorge unter 0800 111 0 111, in Österreich die Telefonseelsorge unter 142. In einem Notfall wähle 144 (CH) oder 112.</p>}
      sections={[
        {
          id: "grundsatz",
          title: "Unser Grundsatz",
          body: <p>Jeder Körper und jeder Weg ist anders. Wir feiern Fortschritt in jeder Form, auch wenn er nichts mit der Waage zu tun hat: mehr Gemüse, besserer Schlaf, ein ruhigerer Umgang mit Essen.</p>,
        },
        {
          id: "erwuenscht",
          title: "Was wir uns wünschen",
          body: (
            <ul>
              <li>Ermutigen statt bewerten. Reagiere auf andere so, wie du dir Reaktionen auf deine eigenen Beiträge wünschst.</li>
              <li>Erfahrungen teilen, nicht Vorschriften machen. „Mir hilft …“ statt „Du musst …“.</li>
              <li>Zahlen nur, wenn du sie teilen willst. Gewicht, Kalorien und Masse sind standardmässig verborgen.</li>
              <li>Quellen nennen, wenn du über Ernährung informierst, und auf Fachpersonen verweisen, wo es um Gesundheit geht.</li>
            </ul>
          ),
        },
        {
          id: "verboten",
          title: "Was nicht erlaubt ist",
          body: (
            <ul>
              <li><strong>Body-Shaming</strong> und abwertende Kommentare über Körper, Gewicht oder Aussehen, auch über dich selbst als Aufforderung an andere.</li>
              <li><strong>Förderung von Essstörungen</strong>: Inhalte, die Hungern, Erbrechen, exzessiven Sport oder extremes Untergewicht verherrlichen oder anleiten.</li>
              <li><strong>Extreme Diäten</strong>: Empfehlungen unter den sicheren Grenzen, Fastenwettbewerbe oder „schnell X kg verlieren“.</li>
              <li><strong>Werbung und Verkauf</strong>, insbesondere für Nahrungsergänzungsmittel, Abnehmprodukte oder eigene Programme.</li>
              <li><strong>Belästigung</strong>, Drohungen, Hassrede und Diskriminierung.</li>
              <li><strong>Persönliche Daten</strong> anderer Personen sowie Fotos von Personen ohne deren Einverständnis.</li>
              <li><strong>Falsche Gesundheitsversprechen</strong> und gefährliche Ratschläge.</li>
              <li>Inhalte, die gegen Gesetze verstossen oder sexuell explizit sind.</li>
            </ul>
          ),
        },
        {
          id: "challenges",
          title: "Gruppen und Challenges",
          body: <p>Gruppen-Challenges drehen sich um Gewohnheiten wie Gemüse, Wasser, Frühstück, Protein oder Schritte. Challenges mit Abnehmzielen, Kalorienminima oder Fasten sind nicht möglich. Gruppenadmins sind für ihre Gruppenregeln mitverantwortlich und können Mitglieder entfernen.</p>,
        },
        {
          id: "moderation",
          title: "Wie wir moderieren",
          body: (
            <>
              <p>Beiträge und Kommentare werden vor der Veröffentlichung automatisch geprüft. Auffällige Inhalte halten wir zurück, bis ein Mensch sie angesehen hat. Erhält ein Beitrag mehrere Meldungen, wird er bis zur Prüfung ausgeblendet. Meldungen zu Essstörungen und Belästigung bearbeiten wir zuerst.</p>
              <table>
                <thead><tr><th>Massnahme</th><th>Wann</th></tr></thead>
                <tbody>
                  <tr><td>Entfernen des Inhalts</td><td>Bei jedem Verstoss</td></tr>
                  <tr><td>Verwarnung</td><td>Bei einem ersten, leichten Verstoss</td></tr>
                  <tr><td>Befristete Sperre</td><td>Bei wiederholten oder schweren Verstössen, 1 bis 30 Tage</td></tr>
                  <tr><td>Ausschluss aus der Community</td><td>Bei schweren oder anhaltenden Verstössen</td></tr>
                </tbody>
              </table>
              <p>Eine Sanktion betrifft nur die Community. Dein Tagebuch und alle anderen Funktionen bleiben nutzbar.</p>
            </>
          ),
        },
        {
          id: "melden",
          title: "Melden, blockieren, Einspruch",
          body: (
            <ul>
              <li>Jeden Beitrag, Kommentar, jedes Profil und jede Gruppe kannst du über „Melden“ mit einem Grund melden. Die gemeldete Person erfährt nicht, wer gemeldet hat.</li>
              <li>Blockierst du jemanden, seht ihr gegenseitig nichts mehr voneinander. Stummschalten blendet Beiträge nur für dich aus.</li>
              <li>Gegen eine Sanktion kannst du in der App Einspruch erheben. Ein Mitglied unseres Teams prüft ihn und begründet den Entscheid.</li>
              <li>Fragen an das Moderationsteam: <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.</li>
            </ul>
          ),
        },
      ]}
    />
  );
}
