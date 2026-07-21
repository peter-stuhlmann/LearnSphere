import { useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import { API_URL } from "../../api/client";
import { resolveDeviceLocale } from "../../i18n";
import { Body, Button, Muted, Screen, TextField, Title } from "../../ui";

export default function ForgotPasswordScreen() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/mobile/v1/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale: resolveDeviceLocale() }),
      });
    } finally {
      // Immer Erfolg zeigen – Antwort ist bewusst nicht unterscheidbar
      setSent(true);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Title>{t("forgotTitle")}</Title>
          <Muted>{t("forgotSubtitle")}</Muted>
        </View>

        {sent ? (
          <Body>{t("resetSent")}</Body>
        ) : (
          <View style={styles.form}>
            <TextField
              label={t("email")}
              autoCapitalize="none"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={submit}
            />
            <Button label={t("sendResetLink")} onPress={submit} loading={busy} />
          </View>
        )}

        <Link href="/login" style={styles.backLink}>
          <Body style={styles.link}>{t("loginNow")}</Body>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    flex: 1,
    justifyContent: "center",
    gap: theme.spacing(8),
  },
  header: { gap: theme.spacing(2) },
  form: { gap: theme.spacing(4) },
  backLink: { alignSelf: "center" },
  link: { color: theme.colors.accent, fontWeight: "600" },
}));
