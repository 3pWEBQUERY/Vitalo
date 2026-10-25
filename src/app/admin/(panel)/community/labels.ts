export const POST_KINDS = { text: "Text", photo: "Foto", meal: "Mahlzeit", progress: "Fortschritt", milestone: "Meilenstein", recipe: "Rezept" } as const;
export const POST_STATUS = { published: ["Veröffentlicht", "tag ok"], held: ["Zurückgehalten", "tag warn"], removed: ["Ausgeblendet", "tag danger"], pending: ["In Prüfung", "tag info"] } as const;
export const VISIBILITY = { followers: "Follower", public: "Öffentlich", group: "Gruppe", private: "Privat", invite: "Nur auf Einladung" } as const;
export const GROUP_STATUS = { active: ["Aktiv", "tag ok"], suspended: ["Gesperrt", "tag warn"], removed: ["Entfernt", "tag danger"] } as const;
export const GROUP_ROLES = { admin: "Gruppen-Admin", moderator: "Moderation", member: "Mitglied" } as const;
export const CHALLENGE_KINDS = { veggies: "Gemüse", water: "Wasser", protein: "Protein", breakfast: "Frühstück", steps: "Schritte", custom: "Eigene" } as const;

/** Running, upcoming or finished, relative to today (Europe/Zurich). */
export function challengePhase(startsOn: string, endsOn: string): [string, string] {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
  if (today < startsOn) return ["Geplant", "tag info"];
  if (today > endsOn) return ["Beendet", "tag"];
  return ["Läuft", "tag ok"];
}
