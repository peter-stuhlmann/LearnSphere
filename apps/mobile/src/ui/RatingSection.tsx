import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@elearning/tokens/primitives";
import { fetchOwnReview, submitReview } from "../api/community";
import { Body, Button, Card, Muted, TextField } from "./index";

/** Kurs bewerten: 1–5 Sterne + optionaler Text (nur eingeschrieben). */
export function RatingSection({ courseId }: { courseId: string }) {
  const t = useTranslations("rating");
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data } = useQuery({
    queryKey: ["own-review", courseId],
    queryFn: () => fetchOwnReview(courseId),
  });

  // Bestehende Bewertung vorbelegen
  useEffect(() => {
    if (data) {
      setRating(data.rating);
      setComment(data.comment ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => submitReview(courseId, { rating, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["own-review", courseId] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    },
  });

  return (
    <Card style={styles.card}>
      <Body style={styles.title}>{t("title")}</Body>
      <View
        style={styles.stars}
        accessibilityRole="radiogroup"
        accessibilityLabel={t("title")}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={t("star", { count: value })}
            accessibilityState={{ checked: rating === value }}
            onPress={() => setRating(value)}
            hitSlop={6}
          >
            <Ionicons
              name={value <= rating ? "star" : "star-outline"}
              size={30}
              color={value <= rating ? colors.accent : colors.textFaint}
            />
          </Pressable>
        ))}
      </View>
      {rating > 0 ? (
        <>
          <TextField
            label={t("reviewLabel")}
            placeholder={t("reviewPlaceholder")}
            multiline
            value={comment}
            onChangeText={setComment}
          />
          <Button
            label={t("reviewSave")}
            variant="ghost"
            loading={save.isPending}
            onPress={() => save.mutate()}
          />
          {save.isSuccess ? <Muted>{t("saved")}</Muted> : null}
          {save.isError ? <Muted>{t("reviewError")}</Muted> : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: { gap: theme.spacing(3), marginTop: theme.spacing(4) },
  title: { fontWeight: "700", fontSize: 17 },
  stars: { flexDirection: "row", gap: theme.spacing(2) },
}));
