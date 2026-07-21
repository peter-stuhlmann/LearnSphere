import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePreventScreenCapture } from "expo-screen-capture";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@elearning/tokens/primitives";
import type { QuizSubmitResponse } from "@elearning/api-contracts/mobile/v1/quiz";
import { ApiError } from "../../api/client";
import { fetchQuiz, submitQuiz } from "../../api/learning";
import { Body, Button, Card, ErrorText, Muted, Screen, TextField, Title } from "../../ui";

export default function QuizScreen() {
  const { quizId } = useLocalSearchParams<{ quizId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Anti-Schummeln: Screenshots/Bildschirmaufnahmen während der Prüfung
  // blockieren (Android) bzw. erkennen lassen (iOS)
  usePreventScreenCapture();
  const t = useTranslations("exam");
  const tLearn = useTranslations("learn");
  const tCommon = useTranslations("common");

  const { data, isLoading } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => fetchQuiz(quizId),
    // Uhr läuft serverseitig – kein Refetch, der den Stand verfälscht
    staleTime: Infinity,
    retry: false,
  });

  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizSubmitResponse | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (data?.quiz.remainingSeconds == null) return;
    setRemaining(data.quiz.remainingSeconds);
    const interval = setInterval(
      () => setRemaining((s) => (s !== null && s > 0 ? s - 1 : s)),
      1000
    );
    return () => clearInterval(interval);
  }, [data?.quiz.remainingSeconds]);

  const submit = useMutation({
    mutationFn: () => submitQuiz(quizId, answers),
    onSuccess: (response) => {
      setResult(response);
      queryClient.invalidateQueries({ queryKey: ["outline"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });

  function toggleAnswer(
    questionId: string,
    optionId: string,
    multiple: boolean
  ) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (!multiple) return { ...prev, [questionId]: [optionId] };
      return {
        ...prev,
        [questionId]: current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      };
    });
  }

  return (
    <Screen edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("backToCourse")}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Body>{t("backToCourse")}</Body>
        </Pressable>

        {isLoading ? <Muted>{tCommon("loading")}</Muted> : null}

        {result ? (
          <ResultView result={result} onRetry={() => setResult(null)} />
        ) : data ? (
          <>
            <Title>{t("title", { title: data.quiz.title })}</Title>
            <View style={styles.metaRow}>
              <Muted>{t("passPercent", { percent: data.quiz.passPercent })}</Muted>
              {remaining !== null ? (
                <Body
                  accessibilityLiveRegion="polite"
                  style={remaining < 60 ? styles.timerCritical : styles.timer}
                >
                  {Math.floor(remaining / 60)}:
                  {String(remaining % 60).padStart(2, "0")}
                </Body>
              ) : null}
            </View>

            {!data.attempt.allowed ? (
              <Card>
                <Body>
                  {data.attempt.reason === "already_passed"
                    ? tLearn("quizPassed")
                    : tCommon("error")}
                </Body>
                {data.attempt.nextAttemptAt ? (
                  <Muted>
                    {new Date(data.attempt.nextAttemptAt).toLocaleString()}
                  </Muted>
                ) : null}
              </Card>
            ) : (
              <>
                {data.questions.map((question, index) => (
                  <Card key={question.id}>
                    <Muted>
                      {t("question", {
                        current: index + 1,
                        total: data.questions.length,
                      })}{" "}
                      · {t("questionPoints", { points: question.points })}
                    </Muted>
                    <Body style={styles.questionText}>{question.text}</Body>

                    {question.kind === "FREE_TEXT" ? (
                      <TextField
                        label={t("yourAnswer")}
                        multiline
                        numberOfLines={4}
                        value={answers[question.id]?.[0] ?? ""}
                        onChangeText={(text) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [question.id]: [text],
                          }))
                        }
                      />
                    ) : (
                      question.options.map((option) => {
                        const selected = (
                          answers[question.id] ?? []
                        ).includes(option.id);
                        return (
                          <Pressable
                            key={option.id}
                            accessibilityRole={
                              question.kind === "MULTIPLE"
                                ? "checkbox"
                                : "radio"
                            }
                            accessibilityState={{ checked: selected }}
                            onPress={() =>
                              toggleAnswer(
                                question.id,
                                option.id,
                                question.kind === "MULTIPLE"
                              )
                            }
                            style={[
                              styles.option,
                              selected && styles.optionSelected,
                            ]}
                          >
                            <Ionicons
                              name={
                                question.kind === "MULTIPLE"
                                  ? selected
                                    ? "checkbox"
                                    : "square-outline"
                                  : selected
                                    ? "radio-button-on"
                                    : "radio-button-off"
                              }
                              size={20}
                              color={
                                selected ? colors.accent : colors.textMuted
                              }
                            />
                            <Body style={styles.optionText}>
                              {option.text}
                            </Body>
                          </Pressable>
                        );
                      })
                    )}
                  </Card>
                ))}

                {submit.error ? (
                  <ErrorText>
                    {submit.error instanceof ApiError
                      ? submit.error.code
                      : tCommon("error")}
                  </ErrorText>
                ) : null}

                <Button
                  label={t("submit")}
                  loading={submit.isPending}
                  onPress={() => submit.mutate()}
                />
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ResultView({
  result,
  onRetry,
}: {
  result: QuizSubmitResponse;
  onRetry: () => void;
}) {
  const t = useTranslations("exam");
  const router = useRouter();

  return (
    <View style={styles.result}>
      <Title>
        {result.passed ? t("resultPassedTitle") : t("resultFailedTitle")}
      </Title>
      <Body>{t("yourScore", { percent: result.scorePercent })}</Body>
      <Muted>
        {t("pointsEarned", {
          earned: result.earnedPoints,
          total: result.totalPoints,
        })}
      </Muted>
      {result.certificateSerial ? (
        <Button
          label={t("downloadCertificateLight")}
          onPress={() => router.push("/certificates")}
        />
      ) : null}
      {!result.passed ? (
        <Button label={t("tryAgain")} variant="ghost" onPress={onRetry} />
      ) : null}
      <Button
        label={t("backToCourse")}
        variant="ghost"
        onPress={() => router.back()}
      />
    </View>
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
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timer: { color: theme.colors.accent, fontVariant: ["tabular-nums"] },
  timerCritical: { color: theme.colors.danger, fontVariant: ["tabular-nums"] },
  questionText: { fontWeight: "600", marginBottom: theme.spacing(2) },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(2.5),
    paddingVertical: theme.spacing(2.5),
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing(1.5),
  },
  optionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  optionText: { flex: 1 },
  result: { gap: theme.spacing(4), paddingTop: theme.spacing(8) },
}));
