import { useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { StyleSheet } from "@/ui/styles";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@elearning/tokens/primitives";
import { htmlToPlainText } from "@elearning/core/html-text";
import type { CommentDto } from "@elearning/api-contracts/mobile/v1/community";
import { addComment, deleteComment, fetchComments } from "../api/community";
import { useAuth } from "../auth/auth-context";
import { Body, Button, Card, Muted, TextField } from "./index";

/** Community/Q&A einer Lektion (Threads bis Ebene 2, Soft-Delete). */
export function CommentsSection({ lessonId }: { lessonId: string }) {
  const t = useTranslations("community");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["comments", lessonId],
    queryFn: () => fetchComments(lessonId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["comments", lessonId] });

  const post = useMutation({
    mutationFn: () =>
      addComment(lessonId, { content: draft.trim(), parentId: replyTo }),
    onSuccess: () => {
      setDraft("");
      setReplyTo(null);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: invalidate,
  });

  const comments = data ?? [];
  const replyTarget = replyTo
    ? comments.find((comment) => comment.id === replyTo)
    : null;

  return (
    <View style={styles.section}>
      <Body style={styles.title}>{t("title")}</Body>

      {isLoading ? <Muted>{t("loading")}</Muted> : null}
      {!isLoading && comments.length === 0 ? <Muted>{t("empty")}</Muted> : null}

      {comments.map((comment) => (
        <CommentRow
          key={comment.id}
          comment={comment}
          canDelete={!comment.deleted && comment.userId === user?.id}
          onReply={comment.depth < 2 ? () => setReplyTo(comment.id) : undefined}
          onDelete={() => remove.mutate(comment.id)}
        />
      ))}

      {replyTarget ? (
        <View style={styles.replyBanner}>
          <Muted>
            {t("replyLabel")}: {replyTarget.userName}
          </Muted>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("cancel")}
            onPress={() => setReplyTo(null)}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={colors.textFaint} />
          </Pressable>
        </View>
      ) : null}

      <TextField
        label={replyTo ? t("replyLabel") : t("composeLabel")}
        placeholder={replyTo ? t("replyPlaceholder") : t("placeholder")}
        multiline
        value={draft}
        onChangeText={setDraft}
      />
      <Button
        label={t("post")}
        variant="ghost"
        disabled={!draft.trim()}
        loading={post.isPending}
        onPress={() => post.mutate()}
      />
    </View>
  );
}

function CommentRow({
  comment,
  canDelete,
  onReply,
  onDelete,
}: {
  comment: CommentDto;
  canDelete: boolean;
  onReply?: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("community");

  return (
    <Card
      style={[
        styles.comment,
        { marginLeft: comment.depth * 16 },
      ]}
    >
      <View style={styles.commentHeader}>
        <Body style={styles.author}>
          {comment.userName}
          {comment.isCreator ? `  · ${t("creatorBadge")}` : ""}
        </Body>
        <Muted>
          {new Date(comment.createdAt).toLocaleDateString()}
        </Muted>
      </View>
      {comment.deleted ? (
        <Muted>{t("deletedPlaceholder")}</Muted>
      ) : (
        <Body>{htmlToPlainText(comment.content)}</Body>
      )}
      <View style={styles.commentActions}>
        {onReply ? (
          <Pressable accessibilityRole="button" onPress={onReply}>
            <Muted style={styles.action}>{t("reply")}</Muted>
          </Pressable>
        ) : null}
        {canDelete ? (
          <Pressable accessibilityRole="button" onPress={onDelete}>
            <Muted style={styles.action}>{t("delete")}</Muted>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: { gap: theme.spacing(3), marginTop: theme.spacing(6) },
  title: { fontWeight: "700", fontSize: 17 },
  comment: { gap: theme.spacing(1.5) },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  author: { fontWeight: "600" },
  commentActions: {
    flexDirection: "row",
    gap: theme.spacing(4),
    marginTop: theme.spacing(1),
  },
  action: { color: theme.colors.accent },
  replyBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
  },
}));
