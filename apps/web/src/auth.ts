import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { verifyCredentials } from "@/lib/services/auth-service";

export class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}

export class TwoFactorRequiredError extends CredentialsSignin {
  code = "2fa_required";
}

export class TwoFactorInvalidError extends CredentialsSignin {
  code = "2fa_invalid";
}

export class TooManyAttemptsError extends CredentialsSignin {
  code = "too_many_attempts";
}

export class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

const useSecureCookies = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  cookies: {
    // Eigener Cookie-Name, damit Sessions anderer localhost-Apps
    // (Standardname "authjs.session-token") nicht kollidieren.
    sessionToken: {
      name: `${useSecureCookies ? "__Secure-" : ""}learnsphere.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  pages: {
    signIn: "/de/login",
  },
  providers: [
    // OAuth: Client-IDs/Secrets kommen aus AUTH_GOOGLE_ID/-SECRET bzw.
    // AUTH_LINKEDIN_ID/-SECRET (Auth.js-Konvention). Beide Provider
    // verifizieren E-Mail-Adressen, daher ist das automatische Verknüpfen
    // mit einem bestehenden Passwort-Konto gleicher E-Mail vertretbar.
    Google({ allowDangerousEmailAccountLinking: true }),
    LinkedIn({ allowDangerousEmailAccountLinking: true }),
    Credentials({
      credentials: {
        email: {},
        password: {},
        totp: {},
      },
      async authorize(credentials) {
        // Gemeinsame Prüfung mit der Mobile-API (lib/services/auth-service)
        const result = await verifyCredentials(credentials);
        if (!result.ok) {
          switch (result.error) {
            case "too_many_attempts":
              throw new TooManyAttemptsError();
            case "email_not_verified":
              throw new EmailNotVerifiedError();
            case "2fa_required":
              throw new TwoFactorRequiredError();
            case "2fa_invalid":
              throw new TwoFactorInvalidError();
            default:
              throw new InvalidCredentialsError();
          }
        }

        // Kein image: Avatare sind Data-URLs und würden den JWT-Cookie
        // sprengen – der Header lädt das Bild frisch aus der DB.
        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        };
      },
    }),
  ],
  events: {
    // OAuth-Provider (Google/LinkedIn) verifizieren die E-Mail selbst –
    // beim ersten OAuth-Login gilt das Konto damit als bestätigt
    async signIn({ user, account }) {
      if (account?.provider !== "credentials" && user?.id) {
        await db.user.updateMany({
          where: { id: user.id, emailVerified: null },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      // Sicherstellen, dass nie ein (großes) Bild im Token landet
      delete token.picture;
      if (user?.id) {
        token.sub = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true, locale: true },
        });
        token.role = dbUser?.role ?? "CLIENT";
        token.locale = dbUser?.locale ?? "de";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as string) ?? "CLIENT";
      }
      return session;
    },
  },
});
