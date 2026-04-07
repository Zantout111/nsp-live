import type { Metadata } from "next";
import Script from "next/script";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
import { getAdsenseLayoutData } from "@/lib/adsense-layout-data";
import { db, ensureSqliteSchema } from '@/lib/db';
import { DEFAULT_BRAND_LOGO, pickLogoStorageUrl } from '@/lib/resolve-logo-url';

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: 'swap',
});

const defaultMetadata: Metadata = {
  title: "سعر الليرة السورية | Syrian Pound Exchange Rate",
  description: "أحدث أسعار صرف الليرة السورية مقابل العملات الأجنبية وأسعار الذهب",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  keywords: [
    "سعر الليرة اليوم",
    "سعر الليرة السورية",
    "صرف العملات",
    "سعر الذهب",
    "سوريا",
    "SYP",
    "Syrian Pound",
  ],
  authors: [{ name: "SYP Rates" }],
};

export async function generateMetadata(): Promise<Metadata> {
  await ensureSqliteSchema();
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'ar';
  const settings = await db.siteSettings.findFirst({
    select: { logoUrl: true, logoUrlAr: true, logoUrlNonAr: true },
  });
  const picked = pickLogoStorageUrl(locale, settings);
  const iconUrl = (() => {
    const raw = (picked || DEFAULT_BRAND_LOGO).trim();
    if (!raw) return '/icon.svg';
    if (raw.startsWith('/')) return raw;
    try {
      const u = new URL(raw);
      const loopback =
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname === '[::1]' ||
        u.hostname === '::1' ||
        u.hostname === '0.0.0.0' ||
        u.hostname.endsWith('.localhost');
      return loopback ? `${u.pathname}${u.search}` : raw;
    } catch {
      return '/icon.svg';
    }
  })();

  const { verificationGoogle } = await getAdsenseLayoutData();
  if (!verificationGoogle) {
    return {
      ...defaultMetadata,
      icons: {
        icon: iconUrl,
        shortcut: iconUrl,
        apple: iconUrl,
      },
    };
  }
  return {
    ...defaultMetadata,
    icons: {
      icon: iconUrl,
      shortcut: iconUrl,
      apple: iconUrl,
    },
    verification: { google: verificationGoogle },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'ar';
  const messages = await getMessages();
  const { scriptClient, verificationGoogleExtra } = await getAdsenseLayoutData();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        {verificationGoogleExtra ? (
          <meta name="google-site-verification" content={verificationGoogleExtra} />
        ) : null}
      </head>
      <body
        className={`${cairo.variable} font-sans antialiased bg-background text-foreground`}
      >
        {scriptClient ? (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(scriptClient)}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        ) : null}
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
