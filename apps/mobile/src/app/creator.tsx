import { Pressable, ScrollView, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@elearning/tokens/primitives";
import {
  creatorDashboardSchema,
  type CreatorDashboard,
} from "@elearning/api-contracts/mobile/v1/creator";
import { apiRequest } from "../api/client";
import { Body, Card, Muted, Screen, Title } from "../ui";

async function fetchDashboard(): Promise<CreatorDashboard> {
  const raw = await apiRequest<unknown>("/api/mobile/v1/creator/dashboard");
  return creatorDashboardSchema.parse(raw);
}

function euro(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Creator-Studio (read-only): KPIs, Guthaben, Kurse. Authoring bleibt Web. */
export default function CreatorScreen() {
  const t = useTranslations("stats");
  const tDashboard = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["creator-dashboard"],
    queryFn: fetchDashboard,
  });

  return (
    <Screen edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tCommon("back")}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Body>{tCommon("back")}</Body>
        </Pressable>

        <Title>{tDashboard("title")}</Title>
        {isLoading ? <Muted>{tCommon("loading")}</Muted> : null}

        {data ? (
          <>
            <View style={styles.kpiGrid}>
              <Kpi label={t("revenue")} value={euro(data.totals.revenueCents)} />
              <Kpi label={t("sales")} value={String(data.totals.sales)} />
              <Kpi label={t("learners")} value={String(data.totals.learners)} />
              <Kpi
                label={t("completion")}
                value={`${data.totals.completion} %`}
              />
              <Kpi
                label={t("avgRating")}
                value={
                  data.totals.avgRating !== null
                    ? `★ ${data.totals.avgRating}`
                    : "–"
                }
              />
            </View>

            <Card>
              <Body style={styles.sectionTitle}>{t("revenue")}</Body>
              <View style={styles.row}>
                <Muted>{euro(data.payout.balanceCents)}</Muted>
                <Muted>
                  {euro(data.payout.pendingCents)} · 30d
                </Muted>
              </View>
            </Card>

            <Body style={styles.sectionTitle}>{t("topCourses")}</Body>
            {data.courses.map((course) => (
              <Card key={course.id} style={styles.courseRow}>
                <View style={styles.courseText}>
                  <Body numberOfLines={1}>{course.title}</Body>
                  <Muted>
                    {course.published
                      ? tDashboard("statusPublished")
                      : tDashboard("statusDraft")}{" "}
                    · {course.enrollmentCount} · {euro(course.revenueCents)}
                  </Muted>
                </View>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.kpi}>
      <Muted>{label}</Muted>
      <Body style={styles.kpiValue}>{value}</Body>
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: { gap: theme.spacing(4), paddingBottom: theme.spacing(10) },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1),
    paddingVertical: theme.spacing(3),
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing(3),
  },
  kpi: { flexGrow: 1, minWidth: "45%" },
  kpiValue: { fontSize: 22, fontWeight: "700", color: theme.colors.accent },
  sectionTitle: { fontWeight: "700", fontSize: 17 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  courseRow: { flexDirection: "row", alignItems: "center" },
  courseText: { flex: 1, gap: 2 },
}));
