import Link from "next/link";
import { APP_STORE_URL, COMPANY } from "../site";
import { Icon } from "./Icon";
import { MobileMenu } from "./MobileMenu";
import { ThemeToggle } from "./ThemeToggle";

export function AppStoreButton({ size = "md" }: { size?: "md" | "lg" }) {
  const content = (
    <>
      <Icon name="apple" size={size === "lg" ? 22 : 18} />
      <span>{APP_STORE_URL ? "Im App Store laden" : "Bald im App Store"}</span>
    </>
  );
  return APP_STORE_URL ? (
    <a className={`btn btn-primary btn-${size}`} href={APP_STORE_URL}>{content}</a>
  ) : (
    <span className={`btn btn-primary btn-${size} is-soon`} aria-disabled>{content}</span>
  );
}

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Vitalo Startseite">
      <img src="/site/icon.png" alt="" width={30} height={30} />
      <span>Vitalo</span>
    </Link>
  );
}

const NAV = [
  ["/#erfassen", "Erfassen"],
  ["/#coach", "Coach"],
  ["/#fortschritt", "Fortschritt"],
  ["/#datenschutz", "Datenschutz"],
  ["/#preise", "Preise"],
  ["/#fragen", "Fragen"],
] as const;

export function Header() {
  return (
    <header className="site-header">
      <div className="container header-row">
        <Brand />
        <nav className="header-nav" aria-label="Hauptnavigation">
          {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <a className="btn btn-primary btn-sm" href="/#laden">Laden</a>
          <MobileMenu links={NAV} />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Brand />
            <p>Der Ernährungscoach, der sich deinem Leben anpasst. Für iPhone mit iOS 26.</p>
          </div>
          <div>
            <h3>App</h3>
            <Link href="/#erfassen">Erfassen</Link>
            <Link href="/#coach">Coach</Link>
            <Link href="/#fortschritt">Fortschritt</Link>
            <Link href="/#community">Community</Link>
            <Link href="/#preise">Preise</Link>
          </div>
          <div>
            <h3>Rechtliches</h3>
            <Link href="/agb">AGB</Link>
            <Link href="/datenschutz">Datenschutz</Link>
            <Link href="/community-richtlinien">Community-Richtlinien</Link>
            <Link href="/impressum">Impressum</Link>
          </div>
          <div>
            <h3>Kontakt</h3>
            <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
            <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
          </div>
        </div>
        <div className="footer-note">
          <p>Vitalo ersetzt keine ärztliche oder ernährungsmedizinische Beratung. Bei Erkrankungen, Medikamenten, Schwangerschaft oder Essstörungen wende dich an eine Fachperson.</p>
          <p>© {year} {COMPANY.name}. Apple, das Apple Logo, iPhone und App Store sind Marken der Apple Inc.</p>
        </div>
      </div>
    </footer>
  );
}
