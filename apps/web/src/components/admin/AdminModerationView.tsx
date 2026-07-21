"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { useRouter } from "@/i18n/navigation";
import { reviewMedia } from "@/app/actions/admin-actions";
import {
  Badge,
  Card,
  DangerButton,
  Muted,
  PrimaryButton,
} from "@/components/ui/primitives";

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Entry = styled(Card)`
  padding: 1.1rem 1.3rem;
  display: grid;
  gap: 0.9rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 300px 1fr;
    align-items: start;
  }
`;

const Preview = styled.div`
  video,
  img {
    display: block;
    width: 100%;
    max-height: 200px;
    object-fit: contain;
    background: #000;
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
  }

  audio {
    width: 100%;
  }
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Reason = styled.p`
  margin-top: 0.4rem;
  font-size: 0.92rem;
  color: #ffb84d;
`;

const Actions = styled.div`
  margin-top: 0.8rem;
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
`;

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|m4a|ogg|wav|weba)$/i;

function MediaPreview({ url }: { url: string }) {
  if (VIDEO_EXTENSIONS.test(url)) {
    return <video src={url} controls preload="metadata" />;
  }
  if (AUDIO_EXTENSIONS.test(url)) {
    return <audio src={url} controls preload="metadata" />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- eigener Upload-Pfad
  return <img src={url} alt="" loading="lazy" />;
}

export interface ModerationEntry {
  id: string;
  url: string;
  kind: string;
  status: "PENDING" | "APPROVED" | "FLAGGED" | "REJECTED";
  reason: string;
  createdAt: string;
  owner: string;
}

export function AdminModerationView({
  entries,
}: {
  entries: ModerationEntry[];
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function review(id: string, approve: boolean) {
    setBusyId(id);
    startTransition(async () => {
      await reviewMedia({ id, approve });
      router.refresh();
    });
  }

  if (entries.length === 0) {
    return <Muted>{t("moderationEmpty")}</Muted>;
  }

  return (
    <List>
      {entries.map((entry) => (
        <Entry key={entry.id}>
          <Preview>
            <MediaPreview url={entry.url} />
          </Preview>
          <div>
            <MetaRow>
              <Badge
                $tone={entry.status === "FLAGGED" ? "accent" : undefined}
              >
                {t(`status.${entry.status}` as never)}
              </Badge>
              <Badge $tone="violet">{entry.kind}</Badge>
              <Muted style={{ fontSize: "0.82rem" }}>
                {entry.owner} ·{" "}
                {new Date(entry.createdAt).toLocaleDateString(locale)}
              </Muted>
            </MetaRow>
            <Muted
              style={{
                fontSize: "0.78rem",
                marginTop: "0.35rem",
                wordBreak: "break-all",
              }}
            >
              {entry.url}
            </Muted>
            {entry.reason ? <Reason>⚠ {entry.reason}</Reason> : null}
            {entry.status !== "APPROVED" ? (
              <Actions>
                <PrimaryButton
                  type="button"
                  disabled={pending && busyId === entry.id}
                  onClick={() => review(entry.id, true)}
                >
                  ✓ {t("approve")}
                </PrimaryButton>
                {entry.status !== "REJECTED" ? (
                  <DangerButton
                    type="button"
                    disabled={pending && busyId === entry.id}
                    onClick={() => review(entry.id, false)}
                  >
                    ✕ {t("reject")}
                  </DangerButton>
                ) : null}
              </Actions>
            ) : null}
          </div>
        </Entry>
      ))}
    </List>
  );
}
