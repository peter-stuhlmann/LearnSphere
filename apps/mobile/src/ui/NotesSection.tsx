import { useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@elearning/tokens/primitives";
import { addNote, deleteNote, fetchNotes } from "../api/community";
import { Body, Button, Card, Muted, TextField } from "./index";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Private Notizen einer Lektion; optionaler Zeitstempel der Wiedergabe. */
export function NotesSection({
  lessonId,
  currentTime,
}: {
  lessonId: string;
  /** aktuelle Abspielposition (Sekunden) für "Notiz bei 4:32" */
  currentTime?: () => number | null;
}) {
  const t = useTranslations("learn");
  const tCommunity = useTranslations("community");
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data } = useQuery({
    queryKey: ["notes", lessonId],
    queryFn: () => fetchNotes(lessonId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["notes", lessonId] });

  const add = useMutation({
    mutationFn: () => {
      const time = currentTime?.() ?? null;
      return addNote(lessonId, {
        content: draft.trim(),
        timeSeconds: time !== null ? Math.floor(time) : null,
      });
    },
    onSuccess: () => {
      setDraft("");
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onSuccess: invalidate,
  });

  return (
    <View style={styles.section}>
      <Body style={styles.title}>{t("notesTitle")}</Body>

      {(data ?? []).length === 0 ? <Muted>{t("notesEmpty")}</Muted> : null}
      {(data ?? []).map((note) => (
        <Card key={note.id} style={styles.noteRow}>
          <View style={styles.noteText}>
            {note.timeSeconds !== null ? (
              <Muted>▶ {formatTime(note.timeSeconds)}</Muted>
            ) : null}
            <Body>{note.content}</Body>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tCommunity("delete")}
            onPress={() => remove.mutate(note.id)}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
          </Pressable>
        </Card>
      ))}

      <TextField
        label={t("notesTitle")}
        placeholder={t("notesPlaceholder")}
        multiline
        value={draft}
        onChangeText={setDraft}
      />
      <Button
        label={t("notesAdd")}
        variant="ghost"
        disabled={!draft.trim()}
        loading={add.isPending}
        onPress={() => add.mutate()}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: { gap: theme.spacing(3), marginTop: theme.spacing(6) },
  title: { fontWeight: "700", fontSize: 17 },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing(3),
  },
  noteText: { flex: 1, gap: 2 },
}));
