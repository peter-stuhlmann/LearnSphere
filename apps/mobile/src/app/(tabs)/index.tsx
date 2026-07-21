import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import {
  publicCourseListSchema,
  type PublicCourse,
} from "@elearning/api-contracts/mobile/v1/catalog";
import { API_URL } from "../../api/client";
import { resolveDeviceLocale } from "../../i18n";
import { Body, Card, Muted, Screen, Title } from "../../ui";

async function fetchCourses(): Promise<PublicCourse[]> {
  const response = await fetch(
    `${API_URL}/api/public/v1/courses?lang=${resolveDeviceLocale()}`
  );
  if (!response.ok) throw new Error(`catalog ${response.status}`);
  return publicCourseListSchema.parse(await response.json()).data;
}

export default function CatalogScreen() {
  const t = useTranslations("catalog");
  const tCommon = useTranslations("common");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["catalog"],
    queryFn: fetchCourses,
  });

  return (
    <Screen edges={["top"]}>
      <FlatList
        data={data ?? []}
        keyExtractor={(course) => course.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Title>{t("title")}</Title>
            <Muted>{t("subtitle")}</Muted>
          </View>
        }
        ListEmptyComponent={
          <Muted style={styles.empty}>
            {isLoading
              ? tCommon("loading")
              : isError
                ? tCommon("error")
                : t("empty")}
          </Muted>
        }
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        renderItem={({ item }) => <CourseCard course={item} />}
      />
    </Screen>
  );
}

function CourseCard({ course }: { course: PublicCourse }) {
  const t = useTranslations("catalog");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const price =
    course.priceCents === 0
      ? tCommon("free")
      : new Intl.NumberFormat("de-DE", {
          style: "currency",
          currency: course.currency || "EUR",
        }).format(course.priceCents / 100);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/course/${course.id}`)}
    >
      <Card style={styles.card}>
        <Body style={styles.cardTitle}>{course.title}</Body>
        {course.subtitle ? <Muted>{course.subtitle}</Muted> : null}
        <View style={styles.cardMeta}>
          <Muted>{t("by", { name: course.creatorName })}</Muted>
          <Body style={styles.price}>{price}</Body>
        </View>
        {course.reviewCount > 0 && course.averageRating !== null ? (
          <Muted>
            {"★".repeat(Math.round(course.averageRating))} (
            {course.reviewCount})
          </Muted>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { gap: theme.spacing(3), paddingBottom: theme.spacing(8) },
  header: { gap: theme.spacing(1.5), paddingVertical: theme.spacing(5) },
  empty: { textAlign: "center", paddingVertical: theme.spacing(10) },
  card: { gap: theme.spacing(1.5) },
  cardTitle: { fontWeight: "700", fontSize: 18 },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing(1),
  },
  price: { color: theme.colors.accent, fontWeight: "700" },
}));
