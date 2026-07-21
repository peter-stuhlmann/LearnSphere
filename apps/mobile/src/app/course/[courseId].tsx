import { Pressable, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@elearning/tokens/primitives";
import { ApiError } from "../../api/client";
import { buyCourse } from "../../api/iap";
import { enrollCourse, fetchOutline } from "../../api/learning";
import { resolveDeviceLocale } from "../../i18n";
import { Body, Button, Card, Muted, Screen, Title } from "../../ui";
import { RatingSection } from "../../ui/RatingSection";

/** Kurs-Gliederung: Abschnitte, Lektionen, Zwischen- und Abschlussprüfung. */
export default function CourseScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("learn");
  const tCommon = useTranslations("common");
  const tCourse = useTranslations("course");
  const tErrors = useTranslations("auth.errors");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["outline", courseId],
    queryFn: () => fetchOutline(courseId, resolveDeviceLocale()),
    retry: false,
  });

  const enroll = useMutation({
    mutationFn: () => enrollCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      refetch();
    },
  });

  const purchase = useMutation({
    mutationFn: () => buyCourse(courseId),
    onSuccess: (result) => {
      if (result.status === "ok") {
        queryClient.invalidateQueries({ queryKey: ["enrollments"] });
        refetch();
      }
    },
  });

  const notEnrolled =
    error instanceof ApiError && error.code === "not_enrolled";
  const paymentRequired =
    enroll.error instanceof ApiError &&
    enroll.error.code === "payment_required";

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

        {isLoading ? <Muted>{tCommon("loading")}</Muted> : null}

        {notEnrolled ? (
          <Card>
            {paymentRequired ? (
              /* Bezahlkurs: nativer In-App-Kauf (Preis-Tier-Produkt) */
              <Button
                label={tCourse("buy", { price: "" }).replace(/\s+$/, "")}
                loading={purchase.isPending}
                onPress={() => purchase.mutate()}
              />
            ) : (
              <Button
                label={t("startCourse")}
                loading={enroll.isPending}
                onPress={() => enroll.mutate()}
              />
            )}
            {purchase.data?.status === "error" || purchase.error ? (
              <Muted>{tErrors("generic")}</Muted>
            ) : null}
          </Card>
        ) : null}

        {data ? (
          <>
            <View style={styles.header}>
              <Title>{data.course.title}</Title>
              <Muted>
                {t("progress")}: {Math.round(data.course.watchPercent)} %
              </Muted>
            </View>

            {data.sections.map((section) => (
              <View key={section.id} style={styles.section}>
                <Body style={styles.sectionTitle}>{section.title}</Body>
                {section.lessons.map((lesson) => (
                  <Pressable
                    key={lesson.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/player/${lesson.id}`)}
                  >
                    <Card style={styles.lessonRow}>
                      <Ionicons
                        name={
                          lesson.completed
                            ? "checkmark-circle"
                            : "play-circle-outline"
                        }
                        size={22}
                        color={
                          lesson.completed ? colors.success : colors.textMuted
                        }
                      />
                      <View style={styles.lessonText}>
                        <Body numberOfLines={2}>{lesson.title}</Body>
                        <Muted>
                          {Math.ceil(lesson.durationSeconds / 60)} min
                        </Muted>
                      </View>
                    </Card>
                  </Pressable>
                ))}
                {section.quiz ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/quiz/${section.quiz!.id}`)}
                  >
                    <Card style={styles.lessonRow}>
                      <Ionicons
                        name={
                          section.quiz.passed
                            ? "ribbon"
                            : "help-circle-outline"
                        }
                        size={22}
                        color={
                          section.quiz.passed
                            ? colors.success
                            : colors.violet
                        }
                      />
                      <View style={styles.lessonText}>
                        <Body>{t("sectionQuiz")}</Body>
                        <Muted>
                          {section.quiz.passed
                            ? t("quizPassed")
                            : t("quizNotPassed")}
                        </Muted>
                      </View>
                    </Card>
                  </Pressable>
                ) : null}
              </View>
            ))}

            {data.finalQuiz ? (
              <View style={styles.exam}>
                <Muted>
                  {t("examRequirement", {
                    percent: data.course.requiredWatchPercent,
                  })}
                </Muted>
                <Button
                  label={
                    data.finalQuiz.passed ? t("quizPassed") : t("startExam")
                  }
                  disabled={!data.finalQuiz.eligible && !data.finalQuiz.passed}
                  onPress={() => router.push(`/quiz/${data.finalQuiz!.id}`)}
                />
                {!data.finalQuiz.eligible && !data.finalQuiz.passed ? (
                  <Muted>{t("examLocked")}</Muted>
                ) : null}
              </View>
            ) : null}

            <RatingSection courseId={courseId} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
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
  header: { gap: theme.spacing(1.5) },
  section: { gap: theme.spacing(2) },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 17,
    marginTop: theme.spacing(2),
  },
  lessonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(3),
  },
  lessonText: { flex: 1, gap: 2 },
  exam: { gap: theme.spacing(2), marginTop: theme.spacing(4) },
}));
