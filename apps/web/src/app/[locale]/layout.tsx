import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { Archivo_Narrow, Courier_Prime } from "next/font/google";
import { routing } from "@/i18n/routing";
import "../globals.css";

const display = Archivo_Narrow({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600", "700"] });
const body = Archivo_Narrow({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600"] });
const mono = Courier_Prime({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "DocuMind",
  description: "De documento a datos, en un solo gesto",
};

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="min-h-dvh antialiased flex flex-col">
        <NextIntlClientProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
