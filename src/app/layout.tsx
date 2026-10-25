import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_URL ?? "http://localhost:3000"),
  title: { default: "Vitalo – Der Ernährungscoach für dein iPhone", template: "%s · Vitalo" },
  description: "Mahlzeiten in Sekunden erfassen, Muster erkennen, kleine Änderungen, die du durchhältst. Vitalo ist der adaptive Ernährungscoach für iPhone.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

/** Light is the default; a stored choice is applied before the first paint so nothing flashes. */
const themeScript = `try{var t=localStorage.getItem("vitalo-theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
