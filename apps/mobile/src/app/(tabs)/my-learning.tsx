import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import type { EnrollmentItem } from "@elearning/api-contracts/mobile/v1/learning";
import { fetchEnrollments } from "../../api/learning";
import { resolveDeviceLocale } from "../../i18n";
import { Body, Card, Muted, Screen, Title } from "../../ui";

export default function MyLearningScreen() {
  const t = useTranslations("nav");
  const tLearn = useTranslations("learn");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["enrollments"],
    queryFn: () => fetchEnrollments(resolveDeviceLocale()),
  });

  return (
    <Screen edges={["top"]}>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.courseId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Title style={styles.header}>{t("myLearning")}</Title>
        }
        ListEmptyComponent={
          <Muted style={styles.empty}>
            {isLoading ? tCommon("loading") : isError ? tCommon("error") : ""}
          </Muted>
        }
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        renderItem={({ item }) => (
          <EnrollmentCard
            item={item}
            actionLabel={
              item.watchPercent > 0
                ? tLearn("continueCourse")
                : tLearn("startCourse")
            }
            onPress={() => router.push(`/course/${item.courseId}`)}
          />
        )}
      />
    </Screen>
  );
}

function EnrollmentCard({
  item,
  actionLabel,
  onPress,
}: {
  item: EnrollmentItem;
  actionLabel: string;
  onPress: () => void;
}) {
  /* Native Props (accessibilityValue.now) verlangen Ganzzahlen –
     der Server liefert Prozent mit zwei Nachkommastellen (z. B. 77.26) */
  const percent = Math.round(item.watchPercent);
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <Body style={styles.cardTitle}>{item.title}</Body>
        {item.subtitle ? <Muted>{item.subtitle}</Muted> : null}
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          style={styles.progressTrack}
        >
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
        <View style={styles.cardFooter}>
          <Muted>
            {item.completedLessons}/{item.lessonCount} · {percent} %
          </Muted>
          <Body style={styles.action}>{actionLabel}</Body>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { gap: theme.spacing(3), paddingBottom: theme.spacing(8) },
  header: { paddingVertical: theme.spacing(5) },
  empty: { textAlign: "center", paddingVertical: theme.spacing(10) },
  cardTitle: { fontWeight: "700", fontSize: 18 },
  progressTrack: {
    height: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
    marginTop: theme.spacing(2),
  },
  progressFill: {
    height: "100%",
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accent,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  action: { color: theme.colors.accent, fontWeight: "600" },
}));
