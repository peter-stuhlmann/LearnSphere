import * as Google from "expo-auth-session/providers/google";

/**
 * Google-Login (nativ): expo-auth-session liefert ein OIDC-id_token, das
 * der Server gegen unser Token-Paar tauscht (POST /auth/oauth).
 * Aktiviert sich nur, wenn Client-IDs konfiguriert sind:
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (Pflicht)
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID / EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
 * Dieselben IDs müssen serverseitig in GOOGLE_MOBILE_CLIENT_IDS stehen.
 */

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export const googleSignInAvailable = Boolean(WEB_CLIENT_ID);

export function useGoogleSignIn(onIdToken: (idToken: string) => void): {
  available: boolean;
  ready: boolean;
  prompt: () => void;
} {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(
    googleSignInAvailable
      ? {
          clientId: WEB_CLIENT_ID,
          iosClientId: IOS_CLIENT_ID,
          androidClientId: ANDROID_CLIENT_ID,
        }
      : { clientId: "unconfigured.apps.googleusercontent.com" }
  );

  return {
    available: googleSignInAvailable,
    ready: Boolean(request),
    prompt: () => {
      promptAsync().then((result) => {
        if (result.type === "success" && result.params.id_token) {
          onIdToken(result.params.id_token);
        }
      });
    },
  };
}
