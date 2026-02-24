import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import UtmCapture from "./components/UtmCapture";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TapSmart English - ちょうど楽しい難易度。だから、明日も読みたくなる。",
  description: "いつものメールボックスで、毎日タップするだけ。「気づけば継続している」に特化した、新しい英語学習。月額500円、初回7日間無料。",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gadsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {gadsId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gadsId}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer=window.dataLayer||[];
                function gtag(){dataLayer.push(arguments);}
                gtag('js',new Date());
                gtag('config','${gadsId}');
              `}
            </Script>
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UtmCapture />
        {children}
      </body>
    </html>
  );
}
