import "./site.css";
import { Footer, Header } from "./components/Chrome";
import { Motion } from "./components/Motion";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <a href="#inhalt" className="skip-link">Zum Inhalt springen</a>
      <Header />
      <main id="inhalt">{children}</main>
      <Footer />
      <Motion />
    </div>
  );
}
