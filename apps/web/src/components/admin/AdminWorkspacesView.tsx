"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { useRouter } from "@/i18n/navigation";
import { setWorkspaceStatus } from "@/app/actions/admin-actions";
import {
  Badge,
  Card,
  GhostButton,
  Muted,
  SectionTitle,
} from "@/components/ui/primitives";

const Table = styled.div`
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const Row = styled(Card)`
  display: grid;
  gap: 0.75rem 1rem;
  align-items: center;
  padding: 1rem 1.25rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 1.4fr 1.6fr auto auto;
  }
`;

const Brand = styled.div`
  strong {
    display: block;
    font-size: 1rem;
  }

  span {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.textFaint};
  }
`;

const Hosts = styled.div`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};

  code {
    font-family: ${({ theme }) => theme.fonts.mono};
  }
`;

interface AdminWorkspace {
  id: string;
  slug: string;
  brandName: string;
  customDomain: string | null;
  domainVerified: boolean;
  status: "ACTIVE" | "SUSPENDED";
  ownerEmail: string;
  createdAt: string;
}

export function AdminWorkspacesView({
  workspaces,
}: {
  workspaces: AdminWorkspace[];
}) {
  const t = useTranslations("adminWorkspaces");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function toggle(ws: AdminWorkspace) {
    setBusyId(ws.id);
    startTransition(async () => {
      await setWorkspaceStatus({
        workspaceId: ws.id,
        status: ws.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      });
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div>
      <SectionTitle as="h1">{t("title")}</SectionTitle>
      <Muted style={{ marginTop: "0.5rem" }}>{t("intro")}</Muted>

      {workspaces.length === 0 ? (
        <Muted style={{ marginTop: "2rem" }}>{t("empty")}</Muted>
      ) : (
        <Table>
          {workspaces.map((ws) => (
            <Row key={ws.id} as="div">
              <Brand>
                <strong>{ws.brandName}</strong>
                <span>{ws.ownerEmail}</span>
              </Brand>
              <Hosts>
                <code>{ws.slug}</code>
                {ws.customDomain ? (
                  <>
                    {" · "}
                    <code>{ws.customDomain}</code>{" "}
                    {ws.domainVerified ? "✓" : "⏳"}
                  </>
                ) : null}
                <div style={{ fontSize: "0.75rem", marginTop: "0.2rem" }}>
                  {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                    new Date(ws.createdAt)
                  )}
                </div>
              </Hosts>
              <Badge $tone={ws.status === "ACTIVE" ? "success" : "muted"}>
                {ws.status === "ACTIVE" ? t("active") : t("suspended")}
              </Badge>
              <GhostButton
                type="button"
                disabled={pending && busyId === ws.id}
                onClick={() => toggle(ws)}
              >
                {ws.status === "ACTIVE" ? t("suspend") : t("activate")}
              </GhostButton>
            </Row>
          ))}
        </Table>
      )}
    </div>
  );
}
