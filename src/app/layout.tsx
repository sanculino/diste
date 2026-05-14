import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://www.distemanagement.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default:
      "DI.S.TE. MANAGEMENT S.a.s. | Consulenza, ISO, Formazione e Software",
    template: "%s | DI.S.TE. MANAGEMENT",
  },
  description:
    "Consulenza direzionale, sistemi di gestione ISO, formazione professionale e sviluppo di software, app e gestionali per imprese e pubbliche amministrazioni. Sedi in Italia e Spagna.",
  keywords: [
    "consulenza ISO",
    "sistemi di gestione",
    "formazione aziendale",
    "software gestionale",
    "Palermo",
    "pubblica amministrazione",
    "DI.S.TE. MANAGEMENT",
  ],
  authors: [{ name: "DI.S.TE. MANAGEMENT S.a.s." }],
  openGraph: {
    type: "website",
    locale: "it_IT",
    url: siteUrl,
    siteName: "DI.S.TE. MANAGEMENT S.a.s.",
    title:
      "DI.S.TE. MANAGEMENT | Consulenza, Innovazione e Soluzioni Digitali",
    description:
      "Affianciamo imprese ed enti pubblici in consulenza, sistemi di gestione, formazione e sviluppo software su misura.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: siteUrl },
  twitter: {
    card: "summary_large_image",
    title:
      "DI.S.TE. MANAGEMENT | Consulenza, Innovazione e Soluzioni Digitali",
    description:
      "Consulenza, sistemi di gestione ISO, formazione e sviluppo software per imprese e PA.",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DI.S.TE. MANAGEMENT S.a.s.",
  alternateName: "Dipartimento Studi Territoriali",
  url: siteUrl,
  email: "info@distemanagement.com",
  telephone: "+39-091-5751728",
  address: [
    {
      "@type": "PostalAddress",
      streetAddress: "Via del Bersagliere 45",
      postalCode: "90143",
      addressLocality: "Palermo",
      addressCountry: "IT",
    },
    {
      "@type": "PostalAddress",
      streetAddress: "C/ Lago Michigan 22",
      postalCode: "28529",
      addressLocality: "Rivas-Vaciamadrid",
      addressCountry: "ES",
    },
  ],
  sameAs: ["https://www.distemanagement.com"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        {children}
      </body>
    </html>
  );
}
