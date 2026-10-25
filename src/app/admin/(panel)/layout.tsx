import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { canAccess, requireAdmin, ROLE_NAMES, twoFactorRequired, type Area } from "@/lib/admin";
import type { IconName } from "@/components/Icon";
import { ThemeToggle } from "@/app/(site)/components/ThemeToggle";
import { signOutAction } from "../login/actions";
import { AccountMenu } from "../components/AccountMenu";
import { CommandPalette, SearchButton, type Command } from "../components/CommandPalette";
import { ToastProvider } from "../components/ui";
import { CurrentArea, SideNav, type NavSection } from "./SideNav";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Vitalo Admin" } };

async function openWork() {
  const [[reports], [held], [appeals], [foods], [revisions]] = await Promise.all([
    db.select({ n: count() }).from(schema.reports).where(eq(schema.reports.status, "open")),
    db.select({ n: count() }).from(schema.posts).where(and(eq(schema.posts.status, "held"), isNull(schema.posts.deletedAt))),
    db.select({ n: count() }).from(schema.appeals).where(eq(schema.appeals.status, "open")),
    db.select({ n: count() }).from(schema.foods).where(eq(schema.foods.quality, "suspect")),
    db.select({ n: count() }).from(schema.foodRevisions).where(eq(schema.foodRevisions.status, "pending")),
  ]);
  return { moderation: reports.n + held.n + appeals.n, foods: foods.n + revisions.n };
}

type Entry = { area: Area; href: string; label: string; icon: IconName; section: string; badge?: number; keywords?: string };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin("account");
  const work = await openWork();
  const entries: Entry[] = [
    { area: "overview", href: "/admin", label: "Übersicht", icon: "home", section: "", keywords: "start dashboard" },
    { area: "moderation", href: "/admin/moderation", label: "Moderation", icon: "flag", section: "Community", badge: work.moderation, keywords: "meldungen einsprüche sanktionen" },
    { area: "moderation", href: "/admin/community/posts", label: "Beiträge", icon: "message", section: "Community", keywords: "posts kommentare" },
    { area: "moderation", href: "/admin/community/groups", label: "Gruppen", icon: "people", section: "Community" },
    { area: "moderation", href: "/admin/community/challenges", label: "Challenges", icon: "trophy", section: "Community" },
    { area: "foods", href: "/admin/foods", label: "Lebensmittel", icon: "leaf", section: "Datenbank", badge: work.foods, keywords: "produkte barcode nährwerte" },
    { area: "brands", href: "/admin/brands", label: "Marken", icon: "tag", section: "Datenbank", keywords: "logos" },
    { area: "users", href: "/admin/users", label: "Nutzer", icon: "person", section: "Support", keywords: "konten abo" },
    { area: "ai", href: "/admin/ai", label: "KI & Kosten", icon: "sparkles", section: "Betrieb", keywords: "claude kosten notabschaltung" },
    { area: "settings", href: "/admin/settings", label: "Einstellungen", icon: "gear", section: "Betrieb", keywords: "funktionen flags grenzwerte version" },
    { area: "audit", href: "/admin/audit", label: "Protokoll", icon: "list", section: "Betrieb", keywords: "audit log" },
    { area: "team", href: "/admin/team", label: "Team", icon: "key", section: "Betrieb", keywords: "admins rollen" },
  ];
  const allowed = entries.filter((e) => canAccess(admin.role, e.area));
  const sections: NavSection[] = [];
  for (const entry of allowed) {
    const title = entry.section || undefined;
    let section = sections.find((s) => s.title === title);
    if (!section) sections.push((section = { title, items: [] }));
    section.items.push({ href: entry.href, label: entry.label, icon: entry.icon, badge: entry.badge });
  }
  const tasks: (Command & { area: Area })[] = [
    { area: "foods", group: "Aktionen", label: "Lebensmittel anlegen", href: "/admin/foods/new", icon: "plus" },
    { area: "brands", group: "Aktionen", label: "Marke anlegen", href: "/admin/brands/new", icon: "plus" },
    { area: "moderation", group: "Aktionen", label: "Challenge anlegen", href: "/admin/community/challenges/new", icon: "plus" },
    { area: "team", group: "Aktionen", label: "Person ins Team aufnehmen", href: "/admin/team/new", icon: "plus" },
    { area: "settings", group: "Aktionen", label: "Funktion anlegen", href: "/admin/settings#neue-funktion", icon: "plus" },
  ];
  const commands: Command[] = [
    ...allowed.map((e) => ({ group: "Seiten", label: e.label, href: e.href, icon: e.icon, keywords: e.keywords })),
    ...tasks.filter((t) => canAccess(admin.role, t.area)),
    { group: "Konto", label: "Mein Konto", href: "/admin/account", icon: "person", keywords: "passwort zwei-faktor" },
  ];

  return (
    <ToastProvider>
      <div className="shell">
        <aside className="sidebar">
          <Link href="/admin" className="brand-mark">
            <img src="/site/icon.png" alt="" width={28} height={28} />
            <span>Vitalo</span>
            <span className="env">Admin</span>
          </Link>
          <SideNav sections={sections} />
          <div className="side-foot">
            <span>{ROLE_NAMES[admin.role]}</span>
            <span className="dot" />
            <span>{process.env.NODE_ENV === "production" ? "Produktiv" : "Lokal"}</span>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <CurrentArea sections={sections} />
            <div className="topbar-actions">
              <SearchButton />
              <ThemeToggle />
              <AccountMenu name={admin.name} email={admin.email} role={ROLE_NAMES[admin.role]} signOut={signOutAction} />
            </div>
          </header>
          {!admin.totpEnabled && (
            <div className="banner">
              <span><strong>Zwei-Faktor-Anmeldung ist nicht eingerichtet.</strong> {twoFactorRequired() ? "Im Produktivbetrieb ist sie Pflicht." : "Lokal optional, im Produktivbetrieb Pflicht."}</span>
              <Link href="/admin/account" className="btn secondary small">Jetzt einrichten</Link>
            </div>
          )}
          <div className="content">{children}</div>
        </div>
      </div>
      <CommandPalette commands={commands} />
    </ToastProvider>
  );
}
