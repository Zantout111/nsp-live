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

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: 'swap',
});

const defaultMetadata: Metadata = {
  title: "سعر الليرة السورية | Syrian Pound Exchange Rate",
  description: "أحدث أسعار صرف الليرة السورية مقابل العملات الأجنبية وأسعار الذهب",
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
  const { verificationGoogle } = await getAdsenseLayoutData();
  if (!verificationGoogle) return defaultMetadata;
  return {
    ...defaultMetadata,
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
  const { scriptClient } = await getAdsenseLayoutData();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
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
