import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@elearning/tokens/primitives";
import { API_URL, ensureAccessToken } from "../api/client";
import { fetchCertificates } from "../api/learning";
import { resolveDeviceLocale } from "../i18n";
import { Body, Card, Muted, Screen, Title } from "../ui";

/** Zertifikate: Liste + PDF-Download (Bearer) mit System-Share-Sheet. */
export default function CertificatesScreen() {
  const t = useTranslations("certificate");
  const tExam = useTranslations("exam");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [busySerial, setBusySerial] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["certificates"],
    queryFn: fetchCertificates,
  });

  async function download(serial: string, mode: "light" | "dark") {
    setBusySerial(serial);
    try {
      const token = await ensureAccessToken();
      if (!token) return;
      const locale = resolveDeviceLocale();
      const response = await fetch(
        `${API_URL}/api/mobile/v1/certificates/${serial}/pdf?lang=${locale}&mode=${mode}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) return;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const file = new File(
        Paths.cache,
        `learnsphere-certificate-${serial}-${mode}.pdf`
      );
      if (file.exists) file.delete();
      file.write(bytes);
      await Sharing.shareAsync(file.uri, { mimeType: "application/pdf" });
    } catch {
      // Download-Fehler still – der Button bleibt für einen neuen Versuch
    } finally {
      setBusySerial(null);
    }
  }

  return (
    <Screen edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.serial}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tCommon("back")}
              onPress={() => router.back()}
              style={styles.back}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
              <Body>{tCommon("back")}</Body>
            </Pressable>
            <Title>{t("title")}</Title>
          </View>
        }
        ListEmptyComponent={
          <Muted style={styles.empty}>
            {isLoading ? tCommon("loading") : ""}
          </Muted>
        }
        renderItem={({ item }) => (
          <Card>
            <Body style={styles.courseTitle}>{item.courseTitle}</Body>
            <Muted>
              {t("withScore", { percent: Math.round(item.scorePercent) })}
            </Muted>
            <Muted>
              {t("serial")}: {item.serial}
            </Muted>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={busySerial === item.serial}
                onPress={() => download(item.serial, "light")}
                style={styles.downloadButton}
              >
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={colors.onAccent}
                />
                <Body style={styles.downloadLabel}>
                  {tExam("downloadCertificateLight")}
                </Body>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busySerial === item.serial}
                onPress={() => download(item.serial, "dark")}
                style={[styles.downloadButton, styles.downloadGhost]}
              >
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={colors.text}
                />
                <Body>{tExam("downloadCertificateDark")}</Body>
              </Pressable>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { gap: theme.spacing(3), paddingBottom: theme.spacing(8) },
  header: { gap: theme.spacing(2), paddingBottom: theme.spacing(3) },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1),
    paddingVertical: theme.spacing(3),
  },
  empty: { textAlign: "center", paddingVertical: theme.spacing(10) },
  courseTitle: { fontWeight: "700", fontSize: 17 },
  actions: { gap: theme.spacing(2), marginTop: theme.spacing(2) },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(2),
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing(2.5),
  },
  downloadGhost: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  downloadLabel: { color: theme.colors.onAccent, fontWeight: "600" },
}));
