import { useEffect, useMemo, useRef } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@elearning/tokens/primitives";
import { htmlToPlainText } from "@elearning/core/html-text";
import type { LessonBlockDto } from "@elearning/api-contracts/mobile/v1/learning";
import { API_URL } from "../../api/client";
import { fetchLesson, markVisited, saveProgress } from "../../api/learning";
import { resolveDeviceLocale } from "../../i18n";
import { Body, Button, Card, Muted, Screen, Title } from "../../ui";
import { NotesSection } from "../../ui/NotesSection";
import { CommentsSection } from "../../ui/CommentsSection";

/** relative URLs (signierte Medien, Uploads) auf den API-Host auflösen */
function absoluteUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

export default function PlayerScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("learn");
  const tCommon = useTranslations("common");

  const { data, isLoading } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => fetchLesson(lessonId, resolveDeviceLocale()),
    // Signierte Medien-URLs laufen nach 10 min ab – nicht aus dem Cache leben
    staleTime: 5 * 60 * 1000,
  });

  // Wiedereinstiegspunkt setzen + gesammelten Fortschritt beim Verlassen sichern
  const watchedRef = useRef(0);
  const positionsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    markVisited(lessonId).catch(() => undefined);
    return () => {
      flushProgress(lessonId, watchedRef, positionsRef, data?.progress.watchedSeconds ?? 0);
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["outline"] });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

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

        {data ? (
          <>
            <Title>{data.lesson.title}</Title>
            {data.blocks.map((block) => (
              <BlockView
                key={block.id}
                block={block}
                lessonId={lessonId}
                initialPosition={data.progress.positions[block.id] ?? 0}
                watchedRef={watchedRef}
                positionsRef={positionsRef}
                baseWatched={data.progress.watchedSeconds}
              />
            ))}
            {data.progress.completed ? (
              <Muted>✓ {t("completed")}</Muted>
            ) : (
              <Button
                label={t("markComplete")}
                variant="ghost"
                onPress={() =>
                  saveProgress(lessonId, {
                    watchedSeconds:
                      data.progress.watchedSeconds + watchedRef.current,
                    forceComplete: true,
                  }).then(() =>
                    queryClient.invalidateQueries({
                      queryKey: ["lesson", lessonId],
                    })
                  )
                }
              />
            )}
            <View style={styles.nav}>
              {data.neighbors.prevLessonId ? (
                <Button
                  label={tCommon("back")}
                  variant="ghost"
                  onPress={() =>
                    router.replace(`/player/${data.neighbors.prevLessonId}`)
                  }
                />
              ) : (
                <View />
              )}
              {data.neighbors.nextLessonId ? (
                <Button
                  label={tCommon("next")}
                  onPress={() =>
                    router.replace(`/player/${data.neighbors.nextLessonId}`)
                  }
                />
              ) : null}
            </View>

            <NotesSection
              lessonId={lessonId}
              currentTime={() => {
                const values = Object.values(positionsRef.current);
                return values.length > 0 ? values[values.length - 1] : null;
              }}
            />
            <CommentsSection lessonId={lessonId} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** Beim Verlassen: Sehstand + Positionen einmalig speichern. */
function flushProgress(
  lessonId: string,
  watchedRef: { current: number },
  positionsRef: { current: Record<string, number> },
  baseWatched: number
) {
  if (watchedRef.current <= 0 && !Object.keys(positionsRef.current).length) {
    return;
  }
  saveProgress(lessonId, {
    watchedSeconds: baseWatched + Math.floor(watchedRef.current),
    positions: positionsRef.current,
  }).catch(() => undefined);
}

function BlockView({
  block,
  lessonId,
  initialPosition,
  watchedRef,
  positionsRef,
  baseWatched,
}: {
  block: LessonBlockDto;
  lessonId: string;
  initialPosition: number;
  watchedRef: { current: number };
  positionsRef: { current: Record<string, number> };
  baseWatched: number;
}) {
  const t = useTranslations("learn");

  switch (block.type) {
    case "VIDEO":
    case "AUDIO":
      return (
        <MediaBlock
          block={block}
          lessonId={lessonId}
          initialPosition={initialPosition}
          watchedRef={watchedRef}
          positionsRef={positionsRef}
          baseWatched={baseWatched}
        />
      );
    case "IMAGE":
      return (
        <Image
          source={{ uri: absoluteUrl(block.url) ?? undefined }}
          style={styles.image}
          contentFit="contain"
          accessibilityLabel={block.title ?? ""}
        />
      );
    case "FILE":
      return (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            const url = absoluteUrl(block.url);
            if (url) Linking.openURL(url).catch(() => undefined);
          }}
        >
          <Card style={styles.fileRow}>
            <Ionicons
              name="document-attach-outline"
              size={22}
              color={colors.accent}
            />
            <Body>{block.fileName ?? block.title ?? t("downloadFile")}</Body>
          </Card>
        </Pressable>
      );
    case "TEXT":
      return <Body style={styles.text}>{block.content ?? ""}</Body>;
    case "HTML":
      /* V1: HTML als Klartext (gleicher Strip wie TTS); Rich-Rendering folgt */
      return (
        <Body style={styles.text}>{htmlToPlainText(block.content ?? "")}</Body>
      );
    default:
      return null;
  }
}

function MediaBlock({
  block,
  lessonId,
  initialPosition,
  watchedRef,
  positionsRef,
  baseWatched,
}: {
  block: LessonBlockDto;
  lessonId: string;
  initialPosition: number;
  watchedRef: { current: number };
  positionsRef: { current: Record<string, number> };
  baseWatched: number;
}) {
  const url = useMemo(() => absoluteUrl(block.url), [block.url]);
  const lastTimeRef = useRef(initialPosition);

  const player = useVideoPlayer(url, (p) => {
    p.timeUpdateEventInterval = 1;
    if (initialPosition > 0) p.currentTime = initialPosition;
  });

  // Sehzeit zählen: nur echte Wiedergabe-Sekunden (keine Sprünge)
  useEffect(() => {
    const sub = player.addListener("timeUpdate", ({ currentTime }) => {
      const delta = currentTime - lastTimeRef.current;
      if (delta > 0 && delta < 2) watchedRef.current += delta;
      lastTimeRef.current = currentTime;
      positionsRef.current[block.id] = Math.floor(currentTime);
    });
    return () => sub.remove();
  }, [player, block.id, watchedRef, positionsRef]);

  // Periodischer Autosave alle 15 s Wiedergabe
  const savedRef = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      if (watchedRef.current - savedRef.current >= 15) {
        savedRef.current = watchedRef.current;
        saveProgress(lessonId, {
          watchedSeconds: baseWatched + Math.floor(watchedRef.current),
          positions: positionsRef.current,
        }).catch(() => undefined);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [lessonId, baseWatched, watchedRef, positionsRef]);

  return (
    <VideoView
      player={player}
      style={block.type === "AUDIO" ? styles.audio : styles.video}
      allowsFullscreen
      allowsPictureInPicture
      contentFit="contain"
      nativeControls
    />
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
  video: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgDeep,
    overflow: "hidden",
  },
  audio: {
    width: "100%",
    height: 72,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgDeep,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgDeep,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(3),
  },
  text: { paddingVertical: theme.spacing(1) },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing(3),
    marginTop: theme.spacing(4),
  },
}));
