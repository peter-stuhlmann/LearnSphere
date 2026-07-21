import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useLocale, useTranslations } from "use-intl";
import {
  createRule,
  hasNumber,
  minLength,
  validatePassword,
  en as pvrEn,
} from "pwd-validator-react";
import { de as pvrDe } from "pwd-validator-react/locales";
import { StyleSheet } from "@/ui/styles";
import { PasswordFeedback } from "@/ui/PasswordFeedback";
import { API_URL } from "../../api/client";
import { Body, Button, ErrorText, Muted, Screen, TextField, Title } from "../../ui";

export default function RegisterScreen() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("auth.errors");
  const locale = useLocale();

  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pvrLocale = locale === "de" ? pvrDe : pvrEn;
  // Exakt die Server-Regeln (packages/core passwordSchema): 8+ Zeichen,
  // Zahl, Buchstabe – live angezeigt, der Server bleibt die Wahrheit
  const rules = useMemo(
    () => [
      minLength(8, pvrLocale),
      hasNumber(1, pvrLocale),
      createRule("hasLetter", /\p{L}/u, tErrors("password_needs_letter")),
    ],
    [pvrLocale, tErrors]
  );
  const confirmMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  async function submit() {
    // Tippfehler-Schutz schon vor dem Request melden (wie im Web)
    if (password !== confirmPassword) {
      setError("passwords_mismatch");
      return;
    }
    const failedRule = validatePassword(password, rules).errors[0];
    if (failedRule) {
      setError(RULE_ERROR_CODES[failedRule.rule] ?? "generic");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/mobile/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          acceptTerms,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.details?.[0] ?? body?.error?.code ?? "generic");
        return;
      }
      // Double-Opt-In: erst die E-Mail bestätigen, dann anmelden –
      // kein Auto-Login mehr
      setDone(true);
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    // Registrierung ok → E-Mail bestätigen, dann anmelden
    return (
      <Screen>
        <View style={styles.doneWrap}>
          <Title>✉ {t("verifyTitle")}</Title>
          <Body>{t("registeredCheckInbox")}</Body>
          <Link href="/login">
            <Body style={styles.link}>{t("loginNow")}</Body>
          </Link>
        </View>
      </Screen>
    );
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
            <Title>{t("registerTitle")}</Title>
            <Muted>{t("registerSubtitle")}</Muted>
          </View>

          <View style={styles.form}>
            <TextField
              label={t("name")}
              autoComplete="name"
              value={name}
              onChangeText={setName}
            />
            <TextField
              label={t("email")}
              autoCapitalize="none"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChangeText={setEmail}
            />
            <View style={styles.fieldGroup}>
              <TextField
                label={t("password")}
                secureTextEntry
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
              />
              <PasswordFeedback
                password={password}
                rules={rules}
                locale={pvrLocale}
              />
            </View>
            <View style={styles.fieldGroup}>
              <TextField
                label={t("confirmPassword")}
                secureTextEntry
                autoComplete="new-password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              {confirmMismatch ? (
                <ErrorText>{pvrLocale.confirmError}</ErrorText>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: acceptTerms }}
              onPress={() => setAcceptTerms((v) => !v)}
              style={styles.termsRow}
            >
              <Switch value={acceptTerms} onValueChange={setAcceptTerms} />
              <Body style={styles.termsText}>
                {t.markup("acceptTerms", { terms: (chunk) => chunk })}
              </Body>
            </Pressable>

            {error ? (
              <ErrorText>
                {tErrors(KNOWN_ERROR_CODES.has(error) ? error : "generic")}
              </ErrorText>
            ) : null}

            <Button label={t("register")} onPress={submit} loading={busy} />
          </View>

          <View style={styles.footer}>
            <Muted>{t("hasAccount")} </Muted>
            <Link href="/login">
              <Body style={styles.link}>{t("loginNow")}</Body>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** pwd-validator-react-Regelnamen → Server-Fehlercodes (auth.errors.*) */
const RULE_ERROR_CODES: Record<string, string> = {
  minLength: "password_too_short",
  hasNumber: "password_needs_digit",
  hasLetter: "password_needs_letter",
};

const KNOWN_ERROR_CODES = new Set([
  "email_taken",
  "terms_required",
  "too_many_attempts",
  "password_too_short",
  "password_needs_digit",
  "password_needs_letter",
  "passwords_mismatch",
  "name_too_short",
  "email_invalid",
  "invalid_credentials",
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
  form: { gap: theme.spacing(4) },
  fieldGroup: { gap: theme.spacing(1.5) },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(3),
  },
  termsText: { flex: 1 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  link: { color: theme.colors.accent, fontWeight: "600" },
  doneWrap: {
    flex: 1,
    justifyContent: "center",
    gap: theme.spacing(4),
  },
}));
