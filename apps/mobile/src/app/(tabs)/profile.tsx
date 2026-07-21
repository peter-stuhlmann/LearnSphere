import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import { updateProfile } from "../../api/community";
import { useAuth } from "../../auth/auth-context";
import { Body, Button, Card, Muted, Screen, TextField, Title } from "../../ui";

export default function ProfileScreen() {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const tProfile = useTranslations("profile");
  const tCertificate = useTranslations("certificate");
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? "");

  const saveName = useMutation({
    mutationFn: () => updateProfile({ name: name.trim() }),
  });

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Title>{t("profile")}</Title>

        <Card>
          <Muted>{tProfile("accountEmail")}</Muted>
          <Body style={styles.name}>{user?.email}</Body>
          <Muted>
            {tAuth("totp")}: {user?.totpEnabled ? "✓" : "–"}
          </Muted>
        </Card>

        <Card>
          <TextField
            label={tProfile("nameLabel")}
            value={name}
            onChangeText={setName}
            autoComplete="name"
          />
          <Button
            label={
              saveName.isSuccess ? tProfile("saved") : tProfile("nameTitle")
            }
            variant="ghost"
            disabled={name.trim().length < 2 || name === (user?.name ?? "")}
            loading={saveName.isPending}
            onPress={() => saveName.mutate()}
          />
        </Card>

        <Button
          label={tCertificate("title")}
          variant="ghost"
          onPress={() => router.push("/certificates")}
        />
        {user?.role === "CREATOR" || user?.role === "ADMIN" ? (
          <Button
            label={t("dashboard")}
            variant="ghost"
            onPress={() => router.push("/creator")}
          />
        ) : null}
        <Button label={t("logout")} variant="ghost" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: { gap: theme.spacing(5), paddingVertical: theme.spacing(5) },
  name: { fontWeight: "700", fontSize: 18 },
}));
