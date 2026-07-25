"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { useRouter } from "@/i18n/navigation";
import {
  removeWorkspaceDomain,
  saveWorkspace,
  setWorkspaceDomain,
  verifyWorkspaceDomain,
} from "@/app/actions/workspace-actions";
import type { WorkspaceData } from "@/lib/services/workspace-service";
import {
  Badge,
  Card,
  GhostButton,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { Field } from "@/components/ui/Field";
import { FormAlert } from "@/components/auth/AuthShell";

const Section = styled.section`
  margin-top: 1.5rem;
`;

const FormStack = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 560px;
`;

const RowSplit = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr 200px;
  }
`;

const UrlPreview = styled.p`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.accent};
  word-break: break-all;

  a {
    color: inherit;
  }
`;

const SubHead = styled.h3`
  font-size: 1.05rem;
  margin: 1.75rem 0 0.5rem;
`;

const DnsTable = styled.dl`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1rem;
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  font-size: 0.82rem;

  dt {
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
  }

  dd {
    margin: 0;
    font-family: ${({ theme }) => theme.fonts.mono};
    word-break: break-all;
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
`;

const KNOWN_ERRORS = [
  "slug_invalid",
  "slug_reserved",
  "slug_taken",
  "brand_name_too_short",
  "color_invalid",
  "domain_invalid",
  "domain_taken",
  "no_workspace",
  "no_domain",
  "dns_not_found",
  "dns_mismatch",
];

export function WorkspacePortalCard({
  workspace,
  baseDomain,
  appHost,
}: {
  workspace: WorkspaceData | null;
  baseDomain: string;
  appHost: string;
}) {
  const t = useTranslations("workspace");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [slug, setSlug] = useState(workspace?.slug ?? "");
  const [brandName, setBrandName] = useState(workspace?.brandName ?? "");
  const [brandColor, setBrandColor] = useState(workspace?.brandColor ?? "");
  const [emailFromName, setEmailFromName] = useState(
    workspace?.emailFromName ?? ""
  );
  const [domainInput, setDomainInput] = useState("");

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const errorText = (code: string) =>
    KNOWN_ERRORS.includes(code)
      ? t(`errors.${code}` as never)
      : t("errors.generic");

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    successKey: string
  ) {
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "generic");
        return;
      }
      setNotice(t(successKey as never));
      router.refresh();
    });
  }

  function onSaveWorkspace(event: FormEvent) {
    event.preventDefault();
    run(
      () => saveWorkspace({ slug, brandName, brandColor, emailFromName }),
      "saved"
    );
  }

  function onAddDomain(event: FormEvent) {
    event.preventDefault();
    run(() => setWorkspaceDomain({ customDomain: domainInput }), "domainAdded");
  }

  const subdomainUrl = slug ? `https://${slug}.${baseDomain}` : null;

  return (
    <Card as="section" style={{ marginTop: "1.5rem" }}>
      <SectionTitle as="h2" style={{ fontSize: "1.5rem" }}>
        {t("title")}
      </SectionTitle>
      <Muted style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
        {t("intro")}
      </Muted>

      {notice ? (
        <FormAlert $tone="success" role="status" style={{ marginTop: "1rem" }}>
          {notice}
        </FormAlert>
      ) : null}
      {error ? (
        <FormAlert $tone="error" role="alert" style={{ marginTop: "1rem" }}>
          {errorText(error)}
        </FormAlert>
      ) : null}

      {/* --- Grunddaten: Slug + Branding --- */}
      <Section>
        <FormStack onSubmit={onSaveWorkspace}>
          <RowSplit>
            <Field
              label={t("slugLabel")}
              hint={t("slugHint")}
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              required
              minLength={3}
              maxLength={40}
            />
            <Field
              label={t("brandColor")}
              type="color"
              value={brandColor || "#4dd8ff"}
              onChange={(e) => setBrandColor(e.target.value)}
            />
          </RowSplit>
          {subdomainUrl ? (
            <UrlPreview>
              {t("portalUrl")}:{" "}
              <a href={subdomainUrl} target="_blank" rel="noreferrer">
                {subdomainUrl}
              </a>
            </UrlPreview>
          ) : null}
          <Field
            label={t("brandName")}
            hint={t("brandNameHint")}
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
          />
          <Field
            label={t("emailFromName")}
            hint={t("emailFromNameHint")}
            value={emailFromName}
            onChange={(e) => setEmailFromName(e.target.value)}
            maxLength={80}
          />
          <PrimaryButton type="submit" disabled={pending}>
            {tc("save")}
          </PrimaryButton>
        </FormStack>
      </Section>

      {/* --- Eigene Domain (nur wenn Workspace existiert) --- */}
      {workspace ? (
        <Section>
          <SubHead>{t("domainTitle")}</SubHead>
          <Muted style={{ fontSize: "0.85rem" }}>{t("domainIntro")}</Muted>

          {!workspace.customDomain ? (
            <FormStack onSubmit={onAddDomain} style={{ marginTop: "1rem" }}>
              <Field
                label={t("domainLabel")}
                placeholder="academy.deine-firma.de"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                required
              />
              <PrimaryButton
                type="submit"
                disabled={pending || !domainInput}
                style={{ alignSelf: "flex-start" }}
              >
                {t("addDomain")}
              </PrimaryButton>
            </FormStack>
          ) : (
            <div style={{ marginTop: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <strong style={{ fontFamily: "var(--font-mono)" }}>
                  {workspace.customDomain}
                </strong>
                {workspace.domainVerified ? (
                  <Badge $tone="success">{t("verified")}</Badge>
                ) : (
                  <Badge $tone="muted">{t("pending")}</Badge>
                )}
              </div>

              {!workspace.domainVerified && workspace.dns ? (
                <>
                  <Muted style={{ fontSize: "0.85rem", marginTop: "0.75rem" }}>
                    {t("dnsInstructions")}
                  </Muted>
                  <DnsTable>
                    <dt>CNAME</dt>
                    <dd>
                      {workspace.customDomain} → {workspace.dns.cnameTarget}
                    </dd>
                    <dt>TXT</dt>
                    <dd>
                      {workspace.dns.txtHost} → {workspace.dns.txtValue}
                    </dd>
                  </DnsTable>
                </>
              ) : null}

              <Actions>
                {!workspace.domainVerified ? (
                  <PrimaryButton
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => verifyWorkspaceDomain(), "domainVerified")
                    }
                  >
                    {t("verifyDomain")}
                  </PrimaryButton>
                ) : (
                  <a
                    href={`https://${workspace.customDomain}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <GhostButton type="button">{t("openPortal")}</GhostButton>
                  </a>
                )}
                <GhostButton
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => removeWorkspaceDomain(), "domainRemoved")
                  }
                >
                  {t("removeDomain")}
                </GhostButton>
              </Actions>
            </div>
          )}
        </Section>
      ) : null}

      <Muted style={{ fontSize: "0.78rem", marginTop: "1.5rem" }}>
        {t("hostHint", { appHost })}
      </Muted>
    </Card>
  );
}
