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
import { TenantHeader } from "@/components/tenant/TenantHeader";
import { TenantFooter } from "@/components/tenant/TenantFooter";
import { getRequestWorkspace } from "@/lib/services/workspace-service";
import { hasTenantPalette, tenantColorOverride } from "@/lib/tenant-theme";
import { NoScriptNotice } from "@/components/layout/NoScriptNotice";
import { CartSync } from "@/components/cart/CartSync";
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
  // Auf einem Whitelabel-Mandanten-Host darf „LearnSphere" nirgends auftauchen –
  // auch nicht im Tab-Titel: Default und Template tragen die Marke des Portals.
  const workspace = await getRequestWorkspace();
  if (workspace) {
    return {
      title: {
        default: workspace.brandName,
        template: `%s · ${workspace.brandName}`,
      },
      robots: { index: false, follow: false },
    };
  }
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

  const [messages, session, workspace] = await Promise.all([
    getMessages(),
    auth(),
    getRequestWorkspace(),
  ]);

  // Anrede (du/Sie) wird bereits serverseitig in i18n/request.ts aufgelöst –
  // getMessages() liefert hier also schon die passenden (ggf. formalen) Texte.

  // Whitelabel-Theme: aus den Kernfarben des Portals die Theme-Tokens ableiten
  // und das gesamte Portal (Header/Inhalt/Footer/Hintergrund) umfärben.
  const palette = workspace
    ? {
        accent: workspace.brandColor,
        background: workspace.colorBackground,
        text: workspace.colorText,
        secondary: workspace.colorSecondary,
      }
    : null;
  const colorOverride =
    palette && hasTenantPalette(palette)
      ? tenantColorOverride(palette)
      : undefined;

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
          <Providers colorOverride={colorOverride}>
            {workspace ? (
              <TenantHeader
                brandName={workspace.brandName}
                brandColor={workspace.brandColor}
                user={
                  freshUser
                    ? { name: freshUser.name, image: freshUser.image }
                    : null
                }
              />
            ) : (
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
            )}
            <NoScriptNotice locale={locale} />
            <PageTransition>{children}</PageTransition>
            {workspace ? (
              <TenantFooter brandName={workspace.brandName} />
            ) : (
              <Footer />
            )}
            {/* eingeloggt: localStorage-Korb mit dem DB-Korb synchronisieren */}
            {session?.user?.id ? <CartSync /> : null}
            <UnsavedChangesGuard />
            <ViewTransitionBridge />
            <CookieConsent brand={workspace ? workspace.brandName : "LearnSphere"} />
            <GoogleAnalytics />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
