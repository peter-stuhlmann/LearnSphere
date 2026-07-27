"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import styled, { ThemeProvider, useTheme } from "styled-components";
import { useRouter } from "@/i18n/navigation";
import {
  removeWorkspaceDomain,
  saveWorkspace,
  saveWorkspaceLegal,
  setWorkspaceDomain,
  verifyWorkspaceDomain,
} from "@/app/actions/workspace-actions";
import type { WorkspaceData } from "@/lib/services/workspace-service";
import {
  hasTenantPalette,
  tenantColorOverride,
  withAlpha,
} from "@/lib/tenant-theme";
import {
  Badge,
  GhostButton,
  Muted,
  PrimaryButton,
} from "@/components/ui/primitives";
import { Field } from "@/components/ui/Field";
import { FormAlert } from "@/components/auth/AuthShell";

/* ------------------------------------------------------------------ Layout */

const Studio = styled.div`
  display: grid;
  gap: 1.5rem;
  align-items: start;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
    gap: 2rem;
  }
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
`;

const PreviewCol = styled.div`
  min-width: 0;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    position: sticky;
    top: 5.5rem;
  }
`;

const Group = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.bgElevated};
  padding: 1.25rem;
`;

const GroupHead = styled.header`
  margin-bottom: 1rem;

  h2 {
    font-size: 1.1rem;
    margin: 0;
  }

  p {
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.textMuted};
    margin: 0.3rem 0 0;
  }
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

/* ------------------------------------------------------------- Farb-Presets */

const PresetGroups = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-bottom: 1.25rem;
`;

const PresetCaption = styled.p`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
  margin: 0 0 0.5rem;
`;

const PresetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const PresetChip = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.7rem 0.4rem 0.45rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.accent : theme.colors.border};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accentSoft : theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.82rem;

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }
`;

const Dots = styled.span`
  display: inline-flex;
  border-radius: ${({ theme }) => theme.radii.pill};
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25) inset;

  i {
    width: 14px;
    height: 14px;
    display: block;
  }
`;

/* -------------------------------------------------------------- Farb-Regler */

const ColorRowEl = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
`;

const Swatch = styled.label`
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;

  input {
    position: absolute;
    inset: -4px;
    width: calc(100% + 8px);
    height: calc(100% + 8px);
    border: none;
    padding: 0;
    cursor: pointer;
    background: none;
  }

  &:focus-within {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const ColorMeta = styled.div`
  min-width: 0;

  strong {
    display: block;
    font-size: 0.92rem;
  }

  span {
    display: block;
    font-size: 0.78rem;
    color: ${({ theme }) => theme.colors.textFaint};
  }
`;

const HexBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const HexInput = styled.input`
  width: 6.5rem;
  padding: 0.5rem 0.6rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.82rem;
  text-transform: uppercase;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 1px;
  }
`;

const ResetBtn = styled.button`
  font-size: 0.72rem;
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

/* --------------------------------------------------------------- Anrede-Toggle */

const FieldLabel = styled.span`
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 0.4rem;
`;

const Segmented = styled.div`
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.bg};
`;

const SegButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 0.5rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.88rem;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accent : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.onAccent : theme.colors.textMuted};

  &:hover {
    color: ${({ theme, $active }) =>
      $active ? theme.colors.onAccent : theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

/* ------------------------------------------------------------- Portal-Adresse */

const UrlPreview = styled.p`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.accent};
  word-break: break-all;

  a {
    color: inherit;
  }
`;

const DnsTable = styled.dl`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1rem;
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bg};
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
  margin-top: 1rem;
`;

const SaveBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
`;

const LegalWarn = styled.p`
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.business};
  background: ${({ theme }) => theme.colors.businessSoft};
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.86rem;
`;

const LegalGrid = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr 1fr;
  }
`;

/* ------------------------------------------------------------- Live-Vorschau */

const Viewport = styled.div`
  border-radius: ${({ theme }) => theme.radii.lg};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const Chrome = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.9rem;
  background: ${({ theme }) => theme.colors.bgDeep};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  .dots {
    display: flex;
    gap: 0.35rem;
  }
  .dots i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.surfaceHover};
    display: block;
  }
  .url {
    flex: 1;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.72rem;
    color: ${({ theme }) => theme.colors.textFaint};
    background: ${({ theme }) => theme.colors.surface};
    border-radius: ${({ theme }) => theme.radii.pill};
    padding: 0.25rem 0.7rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

/* Der gefärbte Bereich – liest die (Vorschau-)Theme-Farben. */
const PortalStage = styled.div`
  padding: 1.25rem;
  background-color: ${({ theme }) => theme.colors.bg};
  background-image:
    radial-gradient(
      ellipse 80% 60% at 50% -10%,
      ${({ theme }) => withAlpha(theme.colors.violet, 0.18)},
      transparent
    ),
    radial-gradient(
      ellipse 70% 50% at 100% 110%,
      ${({ theme }) => withAlpha(theme.colors.accent, 0.08)},
      transparent
    );
  color: ${({ theme }) => theme.colors.text};
  min-height: 340px;
`;

const PHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.9rem;
  margin-bottom: 1.1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  .brand {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 600;
    font-size: 1.15rem;
    color: ${({ theme }) => theme.colors.accent};
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }
  .nav span {
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }
  .av {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.accentSoft};
    border: 1px solid ${({ theme }) => theme.colors.accent};
  }
`;

const PGreeting = styled.h3`
  font-size: 1.35rem;
  margin: 0 0 1rem;
  color: ${({ theme }) => theme.colors.text};
`;

const PCards = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
  margin-bottom: 1.1rem;
`;

const PCard = styled.div`
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  overflow: hidden;

  .cover {
    height: 62px;
    background-image: linear-gradient(
      135deg,
      ${({ theme }) => theme.colors.accent},
      ${({ theme }) => theme.colors.violet}
    );
  }
  .body {
    padding: 0.6rem 0.7rem 0.75rem;
  }
  .t {
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
`;

const PPill = styled.span`
  display: inline-block;
  padding: 0.32rem 0.7rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.72rem;
  font-weight: 600;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
`;

const PButtons = styled.div`
  display: flex;
  gap: 0.6rem;

  .primary {
    padding: 0.55rem 1rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    font-size: 0.82rem;
    font-weight: 600;
    background: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.onAccent};
  }
  .ghost {
    padding: 0.55rem 1rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    font-size: 0.82rem;
    border: 1px solid ${({ theme }) => theme.colors.borderStrong};
    color: ${({ theme }) => theme.colors.text};
  }
`;

/* ------------------------------------------------------------------ Presets */

interface Preset {
  key: string;
  mode: "dark" | "light";
  accent: string;
  background: string;
  text: string;
  secondary: string;
}

const PRESETS: Preset[] = [
  // --- Dunkel ---
  { key: "platform", mode: "dark", accent: "", background: "", text: "", secondary: "" },
  {
    key: "midnight",
    mode: "dark",
    accent: "#7C9CFF",
    background: "#0A0F1E",
    text: "#EDEFF7",
    secondary: "#B57CFF",
  },
  {
    key: "emerald",
    mode: "dark",
    accent: "#4DFFB0",
    background: "#07140F",
    text: "#E6F6EF",
    secondary: "#4DD8FF",
  },
  {
    key: "sunset",
    mode: "dark",
    accent: "#FF9E5C",
    background: "#1A0F0B",
    text: "#F8ECE3",
    secondary: "#FF5C8A",
  },
  {
    key: "grape",
    mode: "dark",
    accent: "#E45CFF",
    background: "#140A1A",
    text: "#F4E9F8",
    secondary: "#8B7CFF",
  },
  {
    key: "sand",
    mode: "dark",
    accent: "#E0B84D",
    background: "#17140D",
    text: "#F3EEE1",
    secondary: "#E08A4D",
  },
  // --- Hell (heller Hintergrund, dunkler Text) ---
  {
    key: "daylight",
    mode: "light",
    accent: "#3D5AFE",
    background: "#F4F6FC",
    text: "#16192B",
    secondary: "#7C4DFF",
  },
  {
    key: "mint",
    mode: "light",
    accent: "#12B981",
    background: "#F1F9F4",
    text: "#0F1F17",
    secondary: "#0EA5E9",
  },
  {
    key: "apricot",
    mode: "light",
    accent: "#F97316",
    background: "#FEF6F0",
    text: "#241511",
    secondary: "#EC4899",
  },
  {
    key: "lilac",
    mode: "light",
    accent: "#A21CAF",
    background: "#FAF4FC",
    text: "#1F1226",
    secondary: "#7C3AED",
  },
  {
    key: "linen",
    mode: "light",
    accent: "#B7791F",
    background: "#FAF6EE",
    text: "#221D12",
    secondary: "#C2680F",
  },
  {
    key: "mist",
    mode: "light",
    accent: "#4F46E5",
    background: "#F5F6F8",
    text: "#14161F",
    secondary: "#64748B",
  },
];

const PRESET_MODES = ["dark", "light"] as const;

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
  "legal_operator_required",
  "legal_street_required",
  "legal_zip_required",
  "legal_city_required",
  "legal_country_required",
  "legal_representative_required",
  "email_invalid",
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/* ----------------------------------------------------------- Farb-Regler-UI */

function ColorControl({
  label,
  hint,
  value,
  fallback,
  onChange,
  resetLabel,
}: {
  label: string;
  hint: string;
  value: string;
  fallback: string;
  onChange: (next: string) => void;
  resetLabel: string;
}) {
  const swatchValue = HEX_RE.test(value) ? value : fallback;
  const onHex = (raw: string) => {
    let v = raw.trim().toLowerCase();
    if (v && !v.startsWith("#")) v = `#${v}`;
    onChange(v.replace(/[^#0-9a-f]/g, "").slice(0, 7));
  };
  return (
    <ColorRowEl>
      <Swatch>
        <input
          type="color"
          value={swatchValue}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
      </Swatch>
      <ColorMeta>
        <strong>{label}</strong>
        <span>{hint}</span>
      </ColorMeta>
      <HexBox>
        <HexInput
          value={value}
          placeholder={fallback}
          onChange={(e) => onHex(e.target.value)}
          spellCheck={false}
          aria-label={label}
        />
        {value ? (
          <ResetBtn type="button" onClick={() => onChange("")}>
            {resetLabel}
          </ResetBtn>
        ) : null}
      </HexBox>
    </ColorRowEl>
  );
}

/* ------------------------------------------------------------------ Studio */

export function PortalStudio({
  workspace,
  baseDomain,
  appHost,
  portalProtocol,
  portalPort,
}: {
  workspace: WorkspaceData | null;
  baseDomain: string;
  appHost: string;
  portalProtocol: string;
  portalPort: string;
}) {
  const t = useTranslations("workspace");
  const ts = useTranslations("portalStudio");
  const tc = useTranslations("common");
  const router = useRouter();
  const baseTheme = useTheme();
  const [pending, startTransition] = useTransition();

  const [slug, setSlug] = useState(workspace?.slug ?? "");
  const [brandName, setBrandName] = useState(workspace?.brandName ?? "");
  const [emailFromName, setEmailFromName] = useState(
    workspace?.emailFromName ?? ""
  );
  const [addressForm, setAddressForm] = useState<"INFORMAL" | "FORMAL">(
    workspace?.addressForm ?? "INFORMAL"
  );
  const [accent, setAccent] = useState(workspace?.brandColor ?? "");
  const [background, setBackground] = useState(workspace?.colorBackground ?? "");
  const [text, setText] = useState(workspace?.colorText ?? "");
  const [secondary, setSecondary] = useState(workspace?.colorSecondary ?? "");
  const [domainInput, setDomainInput] = useState("");

  // Rechtsangaben (Impressum + DSGVO-Verantwortlicher)
  const wl = workspace?.legal ?? null;
  const [legalOperator, setLegalOperator] = useState(wl?.operator ?? "");
  const [legalForm, setLegalForm] = useState(wl?.legalForm ?? "");
  const [legalStreet, setLegalStreet] = useState(wl?.street ?? "");
  const [legalZip, setLegalZip] = useState(wl?.zip ?? "");
  const [legalCity, setLegalCity] = useState(wl?.city ?? "");
  const [legalCountry, setLegalCountry] = useState(wl?.country ?? "Deutschland");
  const [legalEmail, setLegalEmail] = useState(wl?.email ?? "");
  const [legalPhone, setLegalPhone] = useState(wl?.phone ?? "");
  const [legalRepresentative, setLegalRepresentative] = useState(
    wl?.representative ?? ""
  );
  const [legalVatId, setLegalVatId] = useState(wl?.vatId ?? "");
  const [legalRegister, setLegalRegister] = useState(wl?.register ?? "");

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

  function onSave(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        saveWorkspace({
          slug,
          brandName,
          brandColor: accent,
          colorBackground: background,
          colorText: text,
          colorSecondary: secondary,
          emailFromName,
          addressForm,
        }),
      "saved"
    );
  }

  function onAddDomain(event: FormEvent) {
    event.preventDefault();
    run(() => setWorkspaceDomain({ customDomain: domainInput }), "domainAdded");
  }

  function onSaveLegal(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        saveWorkspaceLegal({
          operator: legalOperator,
          legalForm,
          street: legalStreet,
          zip: legalZip,
          city: legalCity,
          country: legalCountry,
          email: legalEmail,
          phone: legalPhone,
          representative: legalRepresentative,
          vatId: legalVatId,
          register: legalRegister,
        }),
      "legalSaved"
    );
  }

  const palette = { accent, background, text, secondary };
  const activePreset =
    PRESETS.find(
      (p) =>
        p.accent === accent &&
        p.background === background &&
        p.text === text &&
        p.secondary === secondary
    )?.key ?? null;

  // Vorschau-Theme: Basis-Palette + abgeleitete Mandantenfarben.
  const previewTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      ...tenantColorOverride(palette),
    },
  };

  const portPart = portalPort ? `:${portalPort}` : "";
  const subdomainHost = slug ? `${slug}.${baseDomain}` : null;
  const subdomainUrl = subdomainHost
    ? `${portalProtocol}//${subdomainHost}${portPart}`
    : null;
  const previewUrl = `${subdomainHost ?? `portal.${baseDomain}`}${portPart}`;
  const previewBrand = brandName || ts("previewBrandFallback");

  const applyPreset = (p: Preset) => {
    setAccent(p.accent);
    setBackground(p.background);
    setText(p.text);
    setSecondary(p.secondary);
  };

  const swatchOf = (p: Preset, key: keyof Preset, fallback: string) =>
    (p[key] as string) || fallback;

  return (
    <>
      {notice ? (
        <FormAlert $tone="success" role="status" style={{ marginBottom: "1rem" }}>
          {notice}
        </FormAlert>
      ) : null}
      {error ? (
        <FormAlert $tone="error" role="alert" style={{ marginBottom: "1rem" }}>
          {errorText(error)}
        </FormAlert>
      ) : null}

      <Studio>
        <Controls>
          {/* --- Marke --- */}
          <Group as="form" onSubmit={onSave}>
            <GroupHead>
              <h2>{ts("brandGroup")}</h2>
              <p>{ts("brandGroupHint")}</p>
            </GroupHead>
            <Stack>
              <Field
                label={t("slugLabel")}
                hint={t("slugHint")}
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  )
                }
                required
                minLength={3}
                maxLength={40}
              />
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
              <div>
                <FieldLabel as="label">{t("addressFormLabel")}</FieldLabel>
                <Segmented role="group" aria-label={t("addressFormLabel")}>
                  <SegButton
                    type="button"
                    $active={addressForm === "INFORMAL"}
                    aria-pressed={addressForm === "INFORMAL"}
                    onClick={() => setAddressForm("INFORMAL")}
                  >
                    {t("addressFormInformal")}
                  </SegButton>
                  <SegButton
                    type="button"
                    $active={addressForm === "FORMAL"}
                    aria-pressed={addressForm === "FORMAL"}
                    onClick={() => setAddressForm("FORMAL")}
                  >
                    {t("addressFormFormal")}
                  </SegButton>
                </Segmented>
                <Muted style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
                  {t("addressFormHint")}
                </Muted>
              </div>
            </Stack>
          </Group>

          {/* --- Farben --- */}
          <Group>
            <GroupHead>
              <h2>{ts("colorGroup")}</h2>
              <p>{ts("colorGroupHint")}</p>
            </GroupHead>

            <PresetGroups>
              {PRESET_MODES.map((mode) => (
                <div key={mode}>
                  <PresetCaption>{ts(`presetMode.${mode}` as never)}</PresetCaption>
                  <PresetRow role="group" aria-label={ts(`presetMode.${mode}` as never)}>
                    {PRESETS.filter((p) => p.mode === mode).map((p) => (
                      <PresetChip
                        key={p.key}
                        type="button"
                        $active={activePreset === p.key}
                        aria-pressed={activePreset === p.key}
                        onClick={() => applyPreset(p)}
                      >
                        <Dots aria-hidden="true">
                          <i
                            style={{
                              background: swatchOf(
                                p,
                                "background",
                                baseTheme.colors.bg
                              ),
                            }}
                          />
                          <i
                            style={{
                              background: swatchOf(
                                p,
                                "accent",
                                baseTheme.colors.accent
                              ),
                            }}
                          />
                          <i
                            style={{
                              background: swatchOf(
                                p,
                                "secondary",
                                baseTheme.colors.violet
                              ),
                            }}
                          />
                        </Dots>
                        {ts(`presets.${p.key}` as never)}
                      </PresetChip>
                    ))}
                  </PresetRow>
                </div>
              ))}
            </PresetGroups>

            <Stack>
              <ColorControl
                label={ts("colorAccent")}
                hint={ts("colorAccentHint")}
                value={accent}
                fallback={baseTheme.colors.accent}
                onChange={setAccent}
                resetLabel={ts("reset")}
              />
              <ColorControl
                label={ts("colorBackground")}
                hint={ts("colorBackgroundHint")}
                value={background}
                fallback={baseTheme.colors.bg}
                onChange={setBackground}
                resetLabel={ts("reset")}
              />
              <ColorControl
                label={ts("colorText")}
                hint={ts("colorTextHint")}
                value={text}
                fallback={baseTheme.colors.text}
                onChange={setText}
                resetLabel={ts("reset")}
              />
              <ColorControl
                label={ts("colorSecondary")}
                hint={ts("colorSecondaryHint")}
                value={secondary}
                fallback={baseTheme.colors.violet}
                onChange={setSecondary}
                resetLabel={ts("reset")}
              />
            </Stack>
          </Group>

          <SaveBar>
            <PrimaryButton type="button" onClick={onSave} disabled={pending}>
              {tc("save")}
            </PrimaryButton>
            {hasTenantPalette(palette) ? (
              <Muted style={{ fontSize: "0.82rem" }}>{ts("liveHint")}</Muted>
            ) : null}
          </SaveBar>

          {/* --- Rechtliches (Impressum + Datenschutz) --- */}
          <Group as="form" onSubmit={onSaveLegal}>
            <GroupHead>
              <h2>{ts("legalGroup")}</h2>
              <p>{ts("legalGroupHint")}</p>
            </GroupHead>
            {!workspace?.legal ? (
              <LegalWarn role="status">{ts("legalMissing")}</LegalWarn>
            ) : null}
            <Stack>
              <Field
                label={ts("legalOperator")}
                hint={ts("legalOperatorHint")}
                value={legalOperator}
                onChange={(e) => setLegalOperator(e.target.value)}
                required
                maxLength={150}
              />
              <LegalGrid>
                <Field
                  label={ts("legalForm")}
                  placeholder={ts("legalFormPlaceholder")}
                  value={legalForm}
                  onChange={(e) => setLegalForm(e.target.value)}
                  maxLength={80}
                />
                <Field
                  label={ts("legalVatId")}
                  value={legalVatId}
                  onChange={(e) => setLegalVatId(e.target.value)}
                  maxLength={30}
                />
              </LegalGrid>
              <Field
                label={ts("legalStreet")}
                value={legalStreet}
                onChange={(e) => setLegalStreet(e.target.value)}
                required
                maxLength={200}
              />
              <LegalGrid>
                <Field
                  label={ts("legalZip")}
                  value={legalZip}
                  onChange={(e) => setLegalZip(e.target.value)}
                  required
                  maxLength={20}
                />
                <Field
                  label={ts("legalCity")}
                  value={legalCity}
                  onChange={(e) => setLegalCity(e.target.value)}
                  required
                  maxLength={100}
                />
              </LegalGrid>
              <Field
                label={ts("legalCountry")}
                value={legalCountry}
                onChange={(e) => setLegalCountry(e.target.value)}
                required
                maxLength={100}
              />
              <LegalGrid>
                <Field
                  label={ts("legalEmail")}
                  type="email"
                  value={legalEmail}
                  onChange={(e) => setLegalEmail(e.target.value)}
                  required
                  maxLength={150}
                />
                <Field
                  label={ts("legalPhone")}
                  value={legalPhone}
                  onChange={(e) => setLegalPhone(e.target.value)}
                  maxLength={40}
                />
              </LegalGrid>
              <Field
                label={ts("legalRepresentative")}
                hint={ts("legalRepresentativeHint")}
                value={legalRepresentative}
                onChange={(e) => setLegalRepresentative(e.target.value)}
                required
                maxLength={150}
              />
              <Field
                label={ts("legalRegister")}
                placeholder={ts("legalRegisterPlaceholder")}
                value={legalRegister}
                onChange={(e) => setLegalRegister(e.target.value)}
                maxLength={150}
              />
              <PrimaryButton type="submit" disabled={pending}>
                {tc("save")}
              </PrimaryButton>
            </Stack>
          </Group>

          {/* --- Eigene Domain --- */}
          {workspace ? (
            <Group>
              <GroupHead>
                <h2>{t("domainTitle")}</h2>
                <p>{t("domainIntro")}</p>
              </GroupHead>

              {!workspace.customDomain ? (
                <form onSubmit={onAddDomain}>
                  <Stack>
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
                  </Stack>
                </form>
              ) : (
                <div>
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

              <Muted style={{ fontSize: "0.78rem", marginTop: "1.25rem" }}>
                {t("hostHint", { appHost })}
              </Muted>
            </Group>
          ) : null}
        </Controls>

        {/* --- Live-Vorschau --- */}
        <PreviewCol>
          <Viewport>
            <Chrome>
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="url">{previewUrl}</span>
            </Chrome>
            <ThemeProvider theme={previewTheme}>
              <PortalStage aria-label={ts("previewLabel")}>
                <PHeader>
                  <span className="brand">{previewBrand}</span>
                  <span className="nav">
                    <span>{ts("previewNav")}</span>
                    <span className="av" aria-hidden="true" />
                  </span>
                </PHeader>
                <PGreeting>{ts("previewGreeting")}</PGreeting>
                <PCards>
                  <PCard>
                    <div className="cover" />
                    <div className="body">
                      <div className="t">{ts("previewCourseA")}</div>
                      <PPill>{ts("previewContinue")}</PPill>
                    </div>
                  </PCard>
                  <PCard>
                    <div className="cover" />
                    <div className="body">
                      <div className="t">{ts("previewCourseB")}</div>
                      <PPill>{ts("previewStart")}</PPill>
                    </div>
                  </PCard>
                </PCards>
                <PButtons>
                  <span className="primary">{ts("previewPrimary")}</span>
                  <span className="ghost">{ts("previewSecondary")}</span>
                </PButtons>
              </PortalStage>
            </ThemeProvider>
          </Viewport>
        </PreviewCol>
      </Studio>
    </>
  );
}
