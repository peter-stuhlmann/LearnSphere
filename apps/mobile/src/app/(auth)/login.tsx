import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Link } from "expo-router";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import { useAuth } from "../../auth/auth-context";
import { useGoogleSignIn } from "../../auth/google";
import { Body, Button, ErrorText, Muted, Screen, TextField, Title } from "../../ui";

export default function LoginScreen() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("auth.errors");
  const tCommon = useTranslations("common");
  const { signIn, signInWithIdToken } = useAuth();

  const google = useGoogleSignIn(async (idToken) => {
    const result = await signInWithIdToken("google", idToken);
    if (result.status === "error") setError(result.code);
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await signIn({
        email: email.trim(),
        password,
        totp: needsTotp && totp ? totp : undefined,
      });
      if (result.status === "2fa_required") {
        setNeedsTotp(true);
      } else if (result.status === "error") {
        setError(result.code);
      }
    } catch {
      setError("internal_error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Muted style={styles.brand}>{tCommon("brand")}</Muted>
            <Title>{t("loginTitle")}</Title>
            <Muted>{t("loginSubtitle")}</Muted>
          </View>

          <View style={styles.form}>
            <TextField
              label={t("email")}
              autoCapitalize="none"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              label={t("password")}
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
            />
            {needsTotp ? (
              <View style={styles.totp}>
                <TextField
                  label={t("totp")}
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  value={totp}
                  onChangeText={setTotp}
                  onSubmitEditing={submit}
                />
                <Muted>{t("totpHint")}</Muted>
              </View>
            ) : null}

            {error ? (
              <ErrorText>
                {tErrors(KNOWN_ERROR_CODES.has(error) ? error : "generic")}
              </ErrorText>
            ) : null}

            <Button label={t("login")} onPress={submit} loading={busy} />

            {google.available ? (
              <>
                <Muted style={styles.divider}>{t("orWithEmail")}</Muted>
                <Button
                  label={t("continueWithGoogle")}
                  variant="ghost"
                  disabled={!google.ready}
                  onPress={google.prompt}
                />
              </>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Link href="/forgot-password">
              <Body style={styles.link}>{t("forgotPassword")}</Body>
            </Link>
            <View style={styles.switchRow}>
              <Muted>{t("noAccount")} </Muted>
              <Link href="/register">
                <Body style={styles.link}>{t("registerNow")}</Body>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Server-Codes, für die auth.errors eine eigene Übersetzung hat. */
const KNOWN_ERROR_CODES = new Set([
  "invalid_credentials",
  "2fa_invalid",
  "too_many_attempts",
  "email_not_verified",
]);

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: theme.spacing(8),
    paddingVertical: theme.spacing(10),
  },
  header: { gap: theme.spacing(2) },
  brand: {
    color: theme.colors.accent,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: 12,
  },
  form: { gap: theme.spacing(4) },
  totp: { gap: theme.spacing(1.5) },
  divider: { textAlign: "center" },
  footer: { gap: theme.spacing(3), alignItems: "center" },
  switchRow: { flexDirection: "row", alignItems: "center" },
  link: { color: theme.colors.accent, fontWeight: "600" },
}));
