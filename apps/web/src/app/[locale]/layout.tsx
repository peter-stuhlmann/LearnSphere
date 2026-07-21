import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Sora } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { routing } from "@/i18n/routing";
import { Providers } from "@/app/providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/layout/PageTransition";
import { UnsavedChangesGuard } from "@/components/ui/UnsavedChangesGuard";
import { ViewTransitionBridge } from "@/components/navigation/ViewTransitionBridge";
import { CookieConsent } from "@/components/consent/CookieConsent";
import { GoogleAnalytics } from "@/components/consent/GoogleAnalytics";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT", "WONK"],
});

const body = Sora({
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  return {
    title: {
      default: "LearnSphere",
      template: "%s · LearnSphere",
    },
    description: t("heroSubtitle"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const [messages, session] = await Promise.all([getMessages(), auth()]);

  // Name/Avatar frisch aus der DB, damit Profil-Änderungen sofort greifen
  const freshUser = session?.user?.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, image: true, role: true },
      })
    : null;

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <Header
              user={
                freshUser
                  ? {
                      name: freshUser.name,
                      image: freshUser.image,
                      role: freshUser.role,
                    }
                  : null
              }
            />
            <PageTransition>{children}</PageTransition>
            <Footer />
            <UnsavedChangesGuard />
            <ViewTransitionBridge />
            <CookieConsent />
            <GoogleAnalytics />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
