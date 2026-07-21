"use client";

import Image from "next/image";
import { useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import { updateCertificateTheme } from "@/app/actions/course-actions";
import {
  CERTIFICATE_FONTS,
  CERTIFICATE_FRAMES,
  CERTIFICATE_LAYOUTS,
  CERTIFICATE_ORIENTATIONS,
  CERTIFICATE_PALETTES,
  DEFAULT_CERTIFICATE_THEME,
  isValidLogoPath,
  paletteForMode,
  type CertificateFontId,
  type CertificateMode,
  type CertificatePalette,
  type CertificateTheme,
} from "@elearning/core/certificate/theme";
import { certificateDecor } from "@elearning/core/certificate/decor";
import {
  Card,
  Container,
  GhostButton,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { Field } from "@/components/ui/Field";
import { FormAlert } from "@/components/auth/AuthShell";
import { useUnsavedMarker } from "@/components/ui/UnsavedChangesGuard";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const HeadRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
`;

const Layout = styled.div`
  display: grid;
  gap: 1.5rem;
  margin-top: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 380px 1fr;
    align-items: start;
  }
`;

const ControlsCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
`;

const Group = styled.fieldset`
  border: 0;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  legend {
    font-size: 0.85rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    margin-bottom: 0.6rem;
  }
`;

/* Unsichtbarer Radio-Input – der sichtbare Zustand liegt auf dem Label */
const HiddenRadio = styled.input`
  position: absolute;
  opacity: 0;
  pointer-events: none;
`;

const OptionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const OptionLabel = styled.label<{ $selected: boolean }>`
  cursor: pointer;
  padding: 0.5rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.85rem;
  border: 1px solid
    ${({ theme, $selected }) =>
      $selected ? "rgba(200, 255, 77, 0.45)" : theme.colors.border};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentSoft : theme.colors.bgElevated};
  transition: border-color 150ms ease, background 150ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:has(input:focus-visible) {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.9rem;
  cursor: pointer;

  input {
    width: 18px;
    height: 18px;
    accent-color: ${({ theme }) => theme.colors.accent};
  }
`;

const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
`;

const SavedNote = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  font-size: 0.85rem;
  font-weight: 600;
`;

/* ---------- Live-Vorschau (HTML-Replik des PDFs, skaliert per cqw) ---------- */

/**
 * PDF-Punkte → Vorschau-Größe. --pt wird auf dem Sheet je Format gesetzt
 * (A4 quer = 842pt Breite, hoch = 595pt ≙ jeweils 100cqw).
 */
function pt(n: number): string {
  return `calc(var(--pt) * ${n})`;
}

const PreviewShell = styled.div<{ $portrait: boolean }>`
  container-type: inline-size;
  /* Hochformat: schmaler halten, sonst wird der Bogen riesig hoch */
  max-width: ${({ $portrait }) => ($portrait ? "480px" : "none")};
  margin-inline: ${({ $portrait }) => ($portrait ? "auto" : "0")};
`;

const Sheet = styled.div<{ $bg: string; $ink: string; $portrait: boolean }>`
  --pt: ${({ $portrait }) =>
    $portrait ? "calc(100cqw / 595)" : "calc(100cqw / 842)"};
  aspect-ratio: ${({ $portrait }) => ($portrait ? "595 / 842" : "842 / 595")};
  position: relative;
  overflow: hidden;
  background: ${({ $bg }) => $bg};
  color: ${({ $ink }) => $ink};
  border-radius: 6px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: ${pt(48)};
  display: flex;
  font-family: Helvetica, Arial, sans-serif;
`;

const BackdropSvg = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

/** HTML-Spiegel des PDF-Backdrops – identische Geometrie aus decor.ts */
function PreviewBackdrop({
  portrait,
  colors,
}: {
  portrait: boolean;
  colors: CertificatePalette;
}) {
  const decor = certificateDecor(portrait ? "portrait" : "landscape");

  return (
    <BackdropSvg
      viewBox={`0 0 ${decor.width} ${decor.height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        {decor.glows.map((glow, i) => (
          <radialGradient
            key={i}
            id={`pv-glow-${i}`}
            cx={glow.cx}
            cy={glow.cy}
            r={glow.r}
          >
            <stop
              offset="0"
              stopColor={colors[glow.color]}
              stopOpacity={glow.opacity}
            />
            <stop offset="1" stopColor={colors[glow.color]} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>
      {decor.glows.map((_, i) => (
        <rect
          key={i}
          width={decor.width}
          height={decor.height}
          fill={`url(#pv-glow-${i})`}
        />
      ))}
      {decor.mesh.edges.map((edge, i) => (
        <line
          key={i}
          x1={edge.x1}
          y1={edge.y1}
          x2={edge.x2}
          y2={edge.y2}
          stroke={colors[decor.mesh.edgeColor]}
          strokeOpacity={decor.mesh.edgeOpacity}
          strokeWidth={0.6}
        />
      ))}
      {decor.mesh.nodes.map((node, i) => (
        <circle
          key={i}
          cx={node.cx}
          cy={node.cy}
          r={node.r}
          fill={colors[decor.mesh.nodeColor]}
          fillOpacity={decor.mesh.nodeOpacity}
        />
      ))}
    </BackdropSvg>
  );
}

const LogoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.7rem;

  img {
    height: 44px;
    max-width: 150px;
    object-fit: contain;
    padding: 0.3rem 0.5rem;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.md};
    background: ${({ theme }) => theme.colors.bgElevated};
  }
`;

const SheetFrame = styled.div<{ $border: string }>`
  flex: 1;
  display: flex;
  ${({ $border }) => $border};
`;

const SheetInner = styled.div<{ $border: string }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: ${pt(30)};
  ${({ $border }) => $border};
`;

const SheetTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const SheetMain = styled.div<{ $left: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: ${({ $left }) => ($left ? "flex-start" : "center")};
  text-align: ${({ $left }) => ($left ? "left" : "center")};
`;

const SheetBottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

interface DesignerProps {
  courseId: string;
  courseTitle: string;
  creatorName: string;
  initialTheme: CertificateTheme;
}

export function CertificateDesigner({
  courseId,
  courseTitle,
  creatorName,
  initialTheme,
}: DesignerProps) {
  const t = useTranslations("certDesigner");
  const tCert = useTranslations("certificate");
  const locale = useLocale();
  const [theme, setTheme] = useState<CertificateTheme>(initialTheme);
  const [savedTheme, setSavedTheme] = useState<CertificateTheme>(initialTheme);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  /* Nur für die Vorschau – Lernende bekommen immer beide Varianten */
  const [previewMode, setPreviewMode] = useState<CertificateMode>("light");

  const dirty = useMemo(
    () => JSON.stringify(theme) !== JSON.stringify(savedTheme),
    [theme, savedTheme]
  );
  useUnsavedMarker(dirty);

  const colors = CERTIFICATE_PALETTES[paletteForMode(previewMode)];
  const font = CERTIFICATE_FONTS[theme.font];
  const isDefault =
    JSON.stringify(theme) === JSON.stringify(DEFAULT_CERTIFICATE_THEME);

  function patch(partial: Partial<CertificateTheme>) {
    setJustSaved(false);
    setTheme((prev) => ({ ...prev, ...partial }));
  }

  /* Gleicher Upload-Pfad wie das Kurs-Cover: /api/uploads moderiert Bilder
     synchron; nur PNG/JPG, weil der PDF-Renderer kein WebP/GIF versteht. */
  async function onLogoFile() {
    const file = logoFileRef.current?.files?.[0];
    if (logoFileRef.current) logoFileRef.current.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("logo_format");
      return;
    }
    setError(null);
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", "image");
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          body?.error === "content_flagged" ? "content_flagged" : "upload_failed"
        );
        return;
      }
      const { url } = (await res.json()) as { url: string };
      if (!isValidLogoPath(url)) {
        setError("upload_failed");
        return;
      }
      patch({ logo: url });
    } catch {
      setError("upload_failed");
    } finally {
      setLogoUploading(false);
    }
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateCertificateTheme(courseId, theme);
      if (!result.ok) {
        setError(result.error ?? "generic");
        return;
      }
      setSavedTheme(theme);
      setJustSaved(true);
    });
  }

  /* CSS-Rahmen analog zu den PDF-Varianten (theme.ts: CERTIFICATE_FRAMES) */
  const outerBorder =
    theme.frame === "single" || theme.frame === "double"
      ? `border: ${pt(1.5)} solid ${colors.ink};`
      : theme.frame === "accent"
        ? `border: ${pt(3)} solid ${colors.accent};`
        : "";
  const innerBorder =
    theme.frame === "double"
      ? `border: ${pt(0.75)} solid ${colors.ink}; margin: ${pt(5)};`
      : "";

  const previewFontFamily =
    theme.font === "classic"
      ? "Georgia, 'Times New Roman', serif"
      : theme.font === "typewriter"
        ? "'Courier New', monospace"
        : "Helvetica, Arial, sans-serif";
  const displayFontFamily =
    theme.font === "elegant"
      ? "Georgia, 'Times New Roman', serif"
      : previewFontFamily;
  const displayItalic = font.display.includes("Italic");

  const dateFormatted = new Intl.DateTimeFormat(
    locale === "de" ? "de-DE" : "en-GB",
    { day: "2-digit", month: "long", year: "numeric" }
  ).format(new Date());
  const sampleName = locale === "de" ? "Maxi Musterfrau" : "Sam Sample";

  const previewUrl = `/api/certificates/preview?courseId=${courseId}&lang=${locale}&mode=${previewMode}&theme=${encodeURIComponent(JSON.stringify(theme))}`;

  return (
    <Wrap id="main">
      <Container>
        <HeadRow>
          <div>
            <Kicker>{courseTitle}</Kicker>
            <SectionTitle as="h1">{t("title")}</SectionTitle>
            <Muted style={{ marginTop: "0.5rem", maxWidth: "60ch" }}>
              {t("intro")}
            </Muted>
          </div>
          <GhostButton
            as={Link}
            href={{
              pathname: "/creator/courses/[id]",
              params: { id: courseId },
            }}
          >
            ← {t("backToCourse")}
          </GhostButton>
        </HeadRow>

        <Layout>
          <ControlsCard as="section" aria-label={t("title")}>
            <Group>
              <legend>{t("font")}</legend>
              <OptionRow role="radiogroup" aria-label={t("font")}>
                {(
                  Object.entries(CERTIFICATE_FONTS) as [
                    CertificateFontId,
                    (typeof CERTIFICATE_FONTS)[CertificateFontId],
                  ][]
                ).map(([id, f]) => (
                  <OptionLabel key={id} $selected={theme.font === id}>
                    <HiddenRadio
                      type="radio"
                      name="font"
                      value={id}
                      checked={theme.font === id}
                      onChange={() => patch({ font: id })}
                    />
                    {f.name}
                  </OptionLabel>
                ))}
              </OptionRow>
            </Group>

            <Group>
              <legend>{t("frame")}</legend>
              <OptionRow role="radiogroup" aria-label={t("frame")}>
                {CERTIFICATE_FRAMES.map((id) => (
                  <OptionLabel key={id} $selected={theme.frame === id}>
                    <HiddenRadio
                      type="radio"
                      name="frame"
                      value={id}
                      checked={theme.frame === id}
                      onChange={() => patch({ frame: id })}
                    />
                    {t(`frames.${id}`)}
                  </OptionLabel>
                ))}
              </OptionRow>
            </Group>

            <Group>
              <legend>{t("layout")}</legend>
              <OptionRow role="radiogroup" aria-label={t("layout")}>
                {CERTIFICATE_LAYOUTS.map((id) => (
                  <OptionLabel key={id} $selected={theme.layout === id}>
                    <HiddenRadio
                      type="radio"
                      name="layout"
                      value={id}
                      checked={theme.layout === id}
                      onChange={() => patch({ layout: id })}
                    />
                    {t(`layouts.${id}`)}
                  </OptionLabel>
                ))}
              </OptionRow>
            </Group>

            <Group>
              <legend>{t("orientation")}</legend>
              <OptionRow role="radiogroup" aria-label={t("orientation")}>
                {CERTIFICATE_ORIENTATIONS.map((id) => (
                  <OptionLabel key={id} $selected={theme.orientation === id}>
                    <HiddenRadio
                      type="radio"
                      name="orientation"
                      value={id}
                      checked={theme.orientation === id}
                      onChange={() => patch({ orientation: id })}
                    />
                    {t(`orientations.${id}`)}
                  </OptionLabel>
                ))}
              </OptionRow>
            </Group>

            <Group>
              <legend>{t("logo")}</legend>
              {theme.logo ? (
                <LogoRow>
                  {/* Maße entsprechen dem LogoRow-CSS (150×44, contain) */}
                  <Image
                    src={theme.logo}
                    alt={t("logoAlt")}
                    width={150}
                    height={44}
                  />
                  <GhostButton
                    type="button"
                    onClick={() => patch({ logo: null })}
                  >
                    {t("logoRemove")}
                  </GhostButton>
                </LogoRow>
              ) : null}
              <input
                ref={logoFileRef}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                aria-label={t("logoUpload")}
                onChange={onLogoFile}
              />
              <div>
                <GhostButton
                  type="button"
                  disabled={logoUploading}
                  onClick={() => logoFileRef.current?.click()}
                >
                  {logoUploading
                    ? "…"
                    : theme.logo
                      ? t("logoReplace")
                      : t("logoUpload")}
                </GhostButton>
              </div>
              <Muted style={{ fontSize: "0.78rem" }}>{t("logoHint")}</Muted>
            </Group>

            <Group>
              <legend>{t("content")}</legend>
              <CheckboxLabel>
                <input
                  type="checkbox"
                  checked={theme.showScore}
                  onChange={(e) => patch({ showScore: e.target.checked })}
                />
                {t("showScore")}
              </CheckboxLabel>
              <Field
                label={t("signatureName")}
                value={theme.signatureName}
                maxLength={60}
                placeholder={t("signaturePlaceholder")}
                onChange={(e) => patch({ signatureName: e.target.value })}
              />
              <Field
                label={t("signatureRole")}
                value={theme.signatureRole}
                maxLength={60}
                placeholder={t("signatureRolePlaceholder")}
                onChange={(e) => patch({ signatureRole: e.target.value })}
              />
            </Group>

            {error ? (
              <FormAlert $tone="error" role="alert">
                {t(`errors.${error}` as never)}
              </FormAlert>
            ) : null}

            <ButtonRow>
              <PrimaryButton
                type="button"
                onClick={onSave}
                disabled={pending || !dirty}
              >
                {pending ? "…" : t("save")}
              </PrimaryButton>
              <GhostButton
                type="button"
                onClick={() => patch({ ...DEFAULT_CERTIFICATE_THEME })}
                disabled={isDefault}
              >
                {t("reset")}
              </GhostButton>
              {justSaved && !dirty ? (
                <SavedNote role="status">{t("saved")}</SavedNote>
              ) : null}
            </ButtonRow>
            <ButtonRow>
              <GhostButton
                as="a"
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
              >
                ⬇ {t("previewPdf")}
              </GhostButton>
            </ButtonRow>
          </ControlsCard>

          <section aria-label={t("preview")}>
            <OptionRow
              role="radiogroup"
              aria-label={t("previewMode")}
              style={{ marginBottom: "0.8rem" }}
            >
              {(["light", "dark"] as const).map((mode) => (
                <OptionLabel key={mode} $selected={previewMode === mode}>
                  <HiddenRadio
                    type="radio"
                    name="previewMode"
                    value={mode}
                    checked={previewMode === mode}
                    onChange={() => setPreviewMode(mode)}
                  />
                  {mode === "light" ? "☀ " : "☾ "}
                  {t(`modes.${mode}`)}
                </OptionLabel>
              ))}
            </OptionRow>
            <Muted style={{ marginBottom: "0.6rem", fontSize: "0.85rem" }}>
              {t("previewHint")}
            </Muted>
            <PreviewShell $portrait={theme.orientation === "portrait"}>
              <Sheet
                $bg={colors.background}
                $ink={colors.ink}
                $portrait={theme.orientation === "portrait"}
                style={{ fontFamily: previewFontFamily }}
                aria-hidden
              >
                <PreviewBackdrop
                  portrait={theme.orientation === "portrait"}
                  colors={colors}
                />
                <SheetFrame $border={outerBorder}>
                  <SheetInner $border={innerBorder}>
                    <SheetTop>
                      <span
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            fontSize: pt(14),
                            fontWeight: 700,
                            letterSpacing: pt(1),
                            /* Markenschriftzug: unabhängig von der Typografie */
                            fontFamily: "Helvetica, Arial, sans-serif",
                          }}
                        >
                          Learn
                          <span style={{ color: colors.accent }}>Sphere</span>
                        </span>
                        {theme.logo ? (
                          /* Anzeigegröße skaliert per pt() mit dem Bogen –
                             width/height dienen nur als Optimierungs-Maß */
                          <Image
                            src={theme.logo}
                            alt=""
                            width={120}
                            height={34}
                            style={{
                              marginTop: pt(10),
                              width: pt(120),
                              height: pt(34),
                              objectFit: "contain",
                              objectPosition: "left top",
                            }}
                          />
                        ) : null}
                      </span>
                      <span
                        style={{
                          fontSize: pt(8),
                          color: colors.muted,
                          letterSpacing: pt(1),
                        }}
                      >
                        {tCert("serial")} LS-2026-XK4F9
                      </span>
                    </SheetTop>

                    <SheetMain $left={theme.layout === "left"}>
                      <span
                        style={{
                          fontSize: pt(11),
                          letterSpacing: pt(6),
                          textTransform: "uppercase",
                          color: colors.accent2,
                          marginBottom: pt(22),
                        }}
                      >
                        {tCert("title")}
                      </span>
                      <span
                        style={{
                          fontSize: pt(11),
                          color: colors.muted,
                          marginBottom: pt(12),
                        }}
                      >
                        {tCert("certifies")}
                      </span>
                      <span
                        style={{
                          fontSize: pt(34),
                          fontFamily: displayFontFamily,
                          fontStyle: displayItalic ? "italic" : "normal",
                          fontWeight:
                            theme.font === "elegant" ? 400 : 700,
                          marginBottom: pt(14),
                        }}
                      >
                        {sampleName}
                      </span>
                      <svg
                        viewBox="0 0 150 9"
                        style={{
                          width: pt(150),
                          height: pt(9),
                          marginBottom: pt(14),
                          display: "block",
                        }}
                        aria-hidden
                      >
                        <line
                          x1="0"
                          y1="4.5"
                          x2="62"
                          y2="4.5"
                          stroke={colors.accent}
                          strokeOpacity={0.85}
                          strokeWidth={1}
                        />
                        <path
                          d="M75 0.5 L79.5 4.5 L75 8.5 L70.5 4.5 Z"
                          fill={colors.accent}
                        />
                        <line
                          x1="88"
                          y1="4.5"
                          x2="150"
                          y2="4.5"
                          stroke={colors.accent}
                          strokeOpacity={0.85}
                          strokeWidth={1}
                        />
                      </svg>
                      <span
                        style={{
                          fontSize: pt(11),
                          color: colors.muted,
                          marginBottom: pt(12),
                        }}
                      >
                        {tCert("completed")}
                      </span>
                      <span
                        style={{
                          fontSize: pt(20),
                          fontWeight: 700,
                          marginBottom: pt(8),
                          maxWidth: pt(480),
                        }}
                      >
                        {courseTitle}
                      </span>
                      <span
                        style={{
                          fontSize: pt(10),
                          color: colors.muted,
                          marginBottom: pt(20),
                        }}
                      >
                        {t("byCreator", { name: creatorName })}
                      </span>
                      {theme.showScore ? (
                        <span
                          style={{
                            fontSize: pt(11),
                            fontWeight: 700,
                            border: `${pt(1)} solid ${colors.accent}`,
                            padding: `${pt(6)} ${pt(14)}`,
                            borderRadius: pt(12),
                          }}
                        >
                          {tCert("withScore", { percent: 92 })}
                        </span>
                      ) : null}
                    </SheetMain>

                    <SheetBottom>
                      <span>
                        <span
                          style={{
                            display: "block",
                            height: pt(3),
                            background: colors.accent,
                            width: pt(64),
                            marginBottom: pt(10),
                          }}
                        />
                        <span
                          style={{ fontSize: pt(8.5), color: colors.muted }}
                        >
                          {tCert("issuedOn", { date: dateFormatted })}
                        </span>
                      </span>
                      {theme.signatureName ? (
                        <span
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              width: pt(150),
                              borderTop: `${pt(0.75)} solid ${colors.ink}`,
                              marginBottom: pt(6),
                            }}
                          />
                          <span
                            style={{ fontSize: pt(10), fontWeight: 700 }}
                          >
                            {theme.signatureName}
                          </span>
                          {theme.signatureRole ? (
                            <span
                              style={{
                                fontSize: pt(8.5),
                                color: colors.muted,
                                marginTop: pt(2),
                              }}
                            >
                              {theme.signatureRole}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      <span style={{ fontSize: pt(8.5), color: colors.muted }}>
                        {tCert("issuer")}
                      </span>
                    </SheetBottom>
                  </SheetInner>
                </SheetFrame>
              </Sheet>
            </PreviewShell>
          </section>
        </Layout>
      </Container>
    </Wrap>
  );
}
