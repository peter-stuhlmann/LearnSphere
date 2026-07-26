"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/** Bild mittig quadratisch zuschneiden und auf AVATAR_SIZE verkleinern. */
async function downscaleAvatar(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const scale = Math.max(
      AVATAR_SIZE / img.naturalWidth,
      AVATAR_SIZE / img.naturalHeight
    );
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (AVATAR_SIZE - w) / 2, (AVATAR_SIZE - h) / 2, w, h);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
import { useLocale, useTranslations } from "next-intl";
import styled, { keyframes } from "styled-components";
import { useRouter } from "@/i18n/navigation";
import {
  removeAvatar,
  saveBillingAddress,
  saveCreatorBio,
  updateAvatar,
  updateProfileName,
} from "@/app/actions/profile-actions";
import { savePayoutAccount } from "@/app/actions/payout-actions";
import { RichTextEditor } from "@/components/ui/RichTextEditorLazy";
import { AVATAR_SIZE, MAX_AVATAR_BYTES } from "@elearning/core/avatar";
import { SUPPORTED_COUNTRIES } from "@elearning/core/validation";
import { isValidIban } from "@elearning/core/payout";
import {
  Card,
  Container,
  Kicker,
  Muted,
  SectionTitle,
} from "@/components/ui/primitives";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { FormAlert } from "@/components/auth/AuthShell";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Header = styled.div`
  display: grid;
  gap: 1.5rem;
  margin-top: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 360px 1fr;
    align-items: start;
  }
`;

const CardTitle = styled.h2`
  font-size: 1.25rem;
  margin-bottom: 1rem;
`;

/** Kamera-Icon als echtes SVG (currentColor) – browserunabhängig statt Emoji. */
function CameraIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1 1 0 0 0 .82-.43l.96-1.37A1.5 1.5 0 0 1 9.73 4.5h4.54a1.5 1.5 0 0 1 1.25.7l.96 1.37a1 1 0 0 0 .82.43h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

const AvatarRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
`;

/** Bezugsrahmen fürs Overlay-Clipping + das (nicht geclippte) Kamera-Badge. */
const AvatarField = styled.div`
  position: relative;
  width: 148px;
  height: 148px;
`;

/**
 * Das Profilbild ist selbst der Auslöser: klick-/tastaturbedienbar, öffnet den
 * Datei-Dialog. Das Overlay erscheint beim Hover/Fokus, das Kamera-Badge bleibt
 * als dezenter Hinweis dauerhaft sichtbar (auch auf Touch).
 */
const AvatarButton = styled.button`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 3.4rem;
  background: ${({ theme }) => theme.colors.violetSoft};
  color: ${({ theme }) => theme.colors.violet};
  border: 2px solid ${({ theme }) => theme.colors.borderStrong};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 3px;
  }

  &:disabled {
    cursor: progress;
  }
`;

const AvatarOverlay = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  background: linear-gradient(
    to top,
    rgba(7, 8, 15, 0.78),
    rgba(7, 8, 15, 0.5)
  );
  color: #f2f3fa;
  /* NICHT die Display-Serifenschrift des Buttons erben – klares UI-Label */
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  opacity: 0;
  transition: opacity 160ms ease;

  ${AvatarButton}:hover &,
  ${AvatarButton}:focus-visible & {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/** Kleines Kamera-Badge unten rechts – signalisiert „bearbeitbar", auch ohne Hover. */
const AvatarBadge = styled.span`
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1rem;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  border: 3px solid ${({ theme }) => theme.colors.bgDeep};
  pointer-events: none;
`;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

/** Lade-Overlay während des Uploads – verdeckt das Bild mit einem Spinner. */
const AvatarSpinner = styled.span`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(7, 8, 15, 0.62);

  &::after {
    content: "";
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid rgba(242, 243, 250, 0.25);
    border-top-color: ${({ theme }) => theme.colors.accent};
    animation: ${spin} 0.7s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation-duration: 1.6s;
    }
  }
`;

/** Dezenter Entfernen-Link statt zweitem Button. */
const RemoveLink = styled.button`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: underline;
  text-underline-offset: 3px;

  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.danger};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }

  &:disabled {
    opacity: 0.5;
  }
`;

const FormStack = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const RowSplit = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr 1fr;
  }
`;

const ZipCityRow = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 140px 1fr;
  }
`;

const LabelText = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  display: block;
  margin-bottom: 0.4rem;
`;

/* ---------- Bereichs-Tabs ---------- */

const TabList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 2.5rem 0 1.5rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const TabButton = styled.button<{ $active: boolean }>`
  position: relative;
  padding: 0.7rem 1.1rem;
  font-size: 0.95rem;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.text : theme.colors.textMuted};
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;

  &::after {
    content: "";
    position: absolute;
    left: 0.6rem;
    right: 0.6rem;
    bottom: -1px;
    height: 2px;
    border-radius: 2px;
    background: ${({ theme, $active }) =>
      $active ? theme.colors.accent : "transparent"};
  }

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }
`;

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

interface BillingDraft {
  firstName: string;
  lastName: string;
  street: string;
  addressExtra: string;
  zip: string;
  city: string;
  country: string;
  email: string;
}

type BillingErrors = Partial<Record<keyof BillingDraft, string>>;

interface PayoutDraft {
  holder: string;
  iban: string;
}

type PayoutErrors = Partial<Record<keyof PayoutDraft, string>>;

type TabId = "learner" | "creator" | "partner" | "business";

const TAB_ORDER: TabId[] = ["learner", "creator", "partner", "business"];

/** E-Mail-Grobprüfung fürs Frontend – die echte Prüfung macht der Server (zod). */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateBilling(a: BillingDraft): BillingErrors {
  const e: BillingErrors = {};
  if (!a.firstName.trim()) e.firstName = "first_name_required";
  if (!a.lastName.trim()) e.lastName = "last_name_required";
  if (a.street.trim().length < 3) e.street = "street_required";
  if (a.zip.trim().length < 3) e.zip = "zip_invalid";
  if (!a.city.trim()) e.city = "city_required";
  if (!looksLikeEmail(a.email)) e.email = "email_invalid";
  return e;
}

function validatePayout(p: PayoutDraft): PayoutErrors {
  const e: PayoutErrors = {};
  if (p.holder.trim().length < 3) e.holder = "holder_required";
  if (!isValidIban(p.iban)) e.iban = "iban_invalid";
  return e;
}

type AutosaveState = "idle" | "saving" | "saved" | "invalid" | "error";

/**
 * Autosave: übernimmt Änderungen nach kurzer Tipppause automatisch. Es wird
 * nur gespeichert, wenn `validate` keine Fehler meldet – sonst bleibt es
 * „invalid". Der zuletzt persistierte Stand steckt in einer Ref, damit
 * unveränderte Werte (auch der Anfangszustand) keinen Speichervorgang auslösen.
 */
function useAutosave<T>({
  value,
  serialize,
  validate,
  save,
  onSaved,
  delay = 800,
}: {
  value: T;
  serialize: (value: T) => string;
  validate?: (value: T) => Record<string, string>;
  save: (value: T) => Promise<{ ok: boolean; error?: string }>;
  onSaved?: () => void;
  delay?: number;
}): AutosaveState {
  const [state, setState] = useState<AutosaveState>("idle");
  const savedRef = useRef(serialize(value));
  const serialized = serialize(value);

  useEffect(() => {
    if (serialized === savedRef.current) return;

    if (validate && Object.keys(validate(value)).length > 0) {
      // Ungültige Eingabe blockiert nur das Speichern – bewusst als State,
      // damit der Status („nicht gespeichert") sichtbar wird
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("invalid");
      return;
    }

    const snapshot = serialized;
    const timer = setTimeout(async () => {
      setState("saving");
      const result = await save(value);
      if (result.ok) {
        savedRef.current = snapshot;
        setState("saved");
        onSaved?.();
      } else {
        setState("error");
      }
    }, delay);

    return () => clearTimeout(timer);
    // Bewusst nur auf den serialisierten Wert reagieren; die Closures sind
    // beim jeweiligen Lauf aktuell (der Effekt läuft bei jeder Änderung neu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  // „Gespeichert ✓" nach kurzer Zeit wieder ausblenden
  useEffect(() => {
    if (state !== "saved") return;
    const timer = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  return state;
}

const StatusText = styled.span<{ $state: AutosaveState }>`
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  color: ${({ theme, $state }) =>
    $state === "saved"
      ? theme.colors.success
      : $state === "error"
        ? theme.colors.danger
        : $state === "invalid"
          ? theme.colors.textMuted
          : theme.colors.textMuted};
`;

/** Dezenter Autosave-Status in der Kartenüberschrift (aria-live für Screenreader). */
function SaveStatus({ state }: { state: AutosaveState }) {
  const t = useTranslations("profile");
  return (
    <StatusText $state={state} role="status" aria-live="polite">
      {state === "idle"
        ? ""
        : state === "saving"
          ? t("autosaveSaving")
          : state === "saved"
            ? t("autosaveSaved")
            : state === "invalid"
              ? t("autosaveInvalid")
              : t("autosaveError")}
    </StatusText>
  );
}

/** Kartenkopf mit Titel links und Autosave-Status rechts. */
const CardHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;

  h2 {
    margin-bottom: 0;
  }
`;

/**
 * Rechnungsadresse: bewusst eine gemeinsame Adresse für alle Bereiche – das
 * Formular erscheint in jedem Tab, bearbeitet aber denselben Datensatz.
 */
function BillingForm({
  address,
  errors,
  hint,
  status,
  onField,
}: {
  address: BillingDraft;
  errors: BillingErrors;
  hint: string;
  status: AutosaveState;
  onField: <K extends keyof BillingDraft>(key: K, value: BillingDraft[K]) => void;
}) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const countryNames = new Intl.DisplayNames([locale], { type: "region" });
  const err = (key: keyof BillingDraft) =>
    errors[key] ? t(`errors.${errors[key]}` as never) : null;

  return (
    <Card as="section" aria-labelledby="billing-title">
      <CardHead>
        <CardTitle id="billing-title">{t("billingTitle")}</CardTitle>
        <SaveStatus state={status} />
      </CardHead>
      <Muted style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
        {hint}
      </Muted>
      <FormStack onSubmit={(e) => e.preventDefault()} noValidate>
        <RowSplit>
          <Field
            label={t("firstName")}
            autoComplete="given-name"
            value={address.firstName}
            onChange={(e) => onField("firstName", e.target.value)}
            error={err("firstName")}
          />
          <Field
            label={t("lastName")}
            autoComplete="family-name"
            value={address.lastName}
            onChange={(e) => onField("lastName", e.target.value)}
            error={err("lastName")}
          />
        </RowSplit>
        <Field
          label={t("street")}
          autoComplete="street-address"
          value={address.street}
          onChange={(e) => onField("street", e.target.value)}
          error={err("street")}
        />
        <Field
          label={t("addressExtra")}
          value={address.addressExtra}
          onChange={(e) => onField("addressExtra", e.target.value)}
        />
        <ZipCityRow>
          <Field
            label={t("zip")}
            autoComplete="postal-code"
            value={address.zip}
            onChange={(e) => onField("zip", e.target.value)}
            maxLength={10}
            error={err("zip")}
          />
          <Field
            label={t("city")}
            autoComplete="address-level2"
            value={address.city}
            onChange={(e) => onField("city", e.target.value)}
            error={err("city")}
          />
        </ZipCityRow>
        <div>
          <LabelText as="label" htmlFor="billing-country">
            {t("country")}
          </LabelText>
          <Select
            id="billing-country"
            value={address.country}
            options={SUPPORTED_COUNTRIES.map((code) => ({
              value: code,
              label: countryNames.of(code) ?? code,
            }))}
            onChange={(country) => onField("country", country)}
          />
        </div>
        <Field
          label={t("billingEmail")}
          type="email"
          autoComplete="email"
          value={address.email}
          onChange={(e) => onField("email", e.target.value)}
          error={err("email")}
        />
      </FormStack>
    </Card>
  );
}

/**
 * Auszahlungsdaten (Kontoinhaber:in + IBAN): dieselben Daten für Creator- und
 * Partner-Auszahlungen. Werden hier gepflegt und auf der Vertriebsseite nur
 * noch maskiert angezeigt.
 */
function PayoutForm({
  payout,
  errors,
  status,
  onField,
}: {
  payout: PayoutDraft;
  errors: PayoutErrors;
  status: AutosaveState;
  onField: <K extends keyof PayoutDraft>(key: K, value: PayoutDraft[K]) => void;
}) {
  const t = useTranslations("profile");
  const err = (key: keyof PayoutDraft) =>
    errors[key] ? t(`errors.${errors[key]}` as never) : null;

  return (
    <Card as="section" aria-labelledby="payout-title">
      <CardHead>
        <CardTitle id="payout-title">{t("payoutTitle")}</CardTitle>
        <SaveStatus state={status} />
      </CardHead>
      <Muted style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
        {t("payoutHint")}
      </Muted>
      <FormStack onSubmit={(e) => e.preventDefault()} noValidate>
        <Field
          label={t("payoutHolder")}
          autoComplete="name"
          value={payout.holder}
          onChange={(e) => onField("holder", e.target.value)}
          error={err("holder")}
        />
        <Field
          label={t("payoutIban")}
          placeholder="DE89 3704 0044 0532 0130 00"
          value={payout.iban}
          onChange={(e) => onField("iban", e.target.value)}
          error={err("iban")}
        />
      </FormStack>
    </Card>
  );
}

interface ProfileViewProps {
  profile: {
    name: string;
    email: string;
    image: string | null;
    creatorBio: string;
  };
  billing: BillingDraft | null;
  payout: PayoutDraft;
  /** Whitelabel-Portal: nur Lernbereich – ohne Rechnungsadresse, Auszahlung
   *  und die Creator/Business/Partner-Tabs. */
  learnerOnly?: boolean;
}

export function ProfileView({
  profile,
  billing,
  payout,
  learnerOnly = false,
}: ProfileViewProps) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.creatorBio);
  const [address, setAddress] = useState<BillingDraft>(
    billing ?? {
      firstName: "",
      lastName: "",
      street: "",
      addressExtra: "",
      zip: "",
      city: "",
      country: "DE",
      email: profile.email,
    }
  );
  const [billingTouched, setBillingTouched] = useState<Set<keyof BillingDraft>>(
    () => new Set()
  );
  const [payoutDraft, setPayoutDraft] = useState<PayoutDraft>(payout);
  const [payoutTouched, setPayoutTouched] = useState<Set<keyof PayoutDraft>>(
    () => new Set()
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("learner");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabLabel: Record<TabId, string> = {
    learner: t("tabLearner"),
    creator: t("tabCreator"),
    partner: t("tabPartner"),
    business: t("tabBusiness"),
  };
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const idx = TAB_ORDER.indexOf(activeTab);
    let next = idx;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (idx + 1) % TAB_ORDER.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = TAB_ORDER.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setActiveTab(TAB_ORDER[next]);
    tabRefs.current[next]?.focus();
  }

  /** Avatar-Aktion mit sichtbarem Lade-Overlay (Spinner) statt Transition. */
  async function runAvatar(action: () => Promise<{ ok: boolean; error?: string }>) {
    setNotice(null);
    setError(null);
    setAvatarBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "generic");
        return;
      }
      setNotice(t("saved"));
      router.refresh();
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onAvatarChange() {
    const file = fileRef.current?.files?.[0];
    // Gleiche Datei erneut wählbar machen (change feuert sonst nicht nochmal)
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    // Zu große Originale abfangen, bevor wir sie in den Canvas laden. Die
    // interne Grenze (5 MB) wird bewusst nicht genannt – die Meldung nennt nur
    // den Richtwert 2 MB.
    if (file.size > MAX_AVATAR_BYTES) {
      setNotice(null);
      setError("avatar_too_large");
      return;
    }
    await runAvatar(async () => {
      // Vor dem Upload auf 256×256 verkleinern: Der Avatar landet als Data-URL
      // im Header jeder Seite – ein 2-MB-Original würde jedes HTML aufblähen.
      const small = await downscaleAvatar(file);
      const formData = new FormData();
      formData.set(
        "avatar",
        small ? new File([small], "avatar.jpg", { type: "image/jpeg" }) : file
      );
      return updateAvatar(formData);
    });
  }

  function setAddressField<K extends keyof BillingDraft>(
    key: K,
    value: BillingDraft[K]
  ) {
    setAddress((prev) => ({ ...prev, [key]: value }));
    setBillingTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }

  function setPayoutField<K extends keyof PayoutDraft>(
    key: K,
    value: PayoutDraft[K]
  ) {
    setPayoutDraft((prev) => ({ ...prev, [key]: value }));
    setPayoutTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }

  // --- Autosave je Formular: speichert nach kurzer Tipppause automatisch ---
  const nameStatus = useAutosave({
    value: name,
    serialize: (v) => v,
    validate: (v): Record<string, string> =>
      v.trim().length < 2 ? { name: "name_too_short" } : {},
    save: (v) => updateProfileName({ name: v }),
    // Name/Avatar erscheinen auch im Header – nach dem Speichern angleichen
    onSaved: () => router.refresh(),
  });
  const bioStatus = useAutosave({
    value: bio,
    serialize: (v) => v,
    save: (v) => saveCreatorBio({ html: v }),
  });
  const billingStatus = useAutosave({
    value: address,
    serialize: (v) => JSON.stringify(v),
    validate: validateBilling,
    save: (v) => saveBillingAddress(v),
  });
  const payoutStatus = useAutosave({
    value: payoutDraft,
    serialize: (v) => JSON.stringify(v),
    validate: validatePayout,
    save: (v) => savePayoutAccount({ holder: v.holder, iban: v.iban }),
  });

  // Feldfehler erst zeigen, sobald am Formular etwas geändert wurde – dann
  // aber vollständig, damit ohne Speichern-Button klar ist, was noch fehlt.
  const billingFieldErrors: BillingErrors =
    billingTouched.size > 0 ? validateBilling(address) : {};
  const payoutFieldErrors: PayoutErrors =
    payoutTouched.size > 0 ? validatePayout(payoutDraft) : {};
  const nameError = nameStatus === "invalid" ? t("errors.name_too_short") : null;

  const knownError = (code: string) =>
    [
      "avatar_invalid",
      "avatar_missing",
      "avatar_flagged",
      "avatar_too_large",
    ].includes(code)
      ? t(`errors.${code}` as never)
      : t("errors.generic");

  const billingCard = (
    <BillingForm
      address={address}
      errors={billingFieldErrors}
      hint={t("billingSharedNote")}
      status={billingStatus}
      onField={setAddressField}
    />
  );

  const payoutCard = (
    <PayoutForm
      payout={payoutDraft}
      errors={payoutFieldErrors}
      status={payoutStatus}
      onField={setPayoutField}
    />
  );

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{profile.email}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>

        {notice ? (
          <FormAlert
            $tone="success"
            role="status"
            style={{ marginTop: "1rem", maxWidth: "560px" }}
          >
            {notice}
          </FormAlert>
        ) : null}
        {error ? (
          <FormAlert
            $tone="error"
            role="alert"
            style={{ marginTop: "1rem", maxWidth: "560px" }}
          >
            {knownError(error)}
          </FormAlert>
        ) : null}

        {/* Profilbild, Name und Konto-E-Mail gelten für alle Bereiche */}
        <Header>
          <Card as="section" aria-labelledby="avatar-title">
            <CardTitle id="avatar-title">{t("avatarTitle")}</CardTitle>
            <AvatarRow>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onAvatarChange}
                style={{ display: "none" }}
                aria-hidden
                tabIndex={-1}
              />
              <AvatarField>
                <AvatarButton
                  type="button"
                  disabled={avatarBusy}
                  aria-busy={avatarBusy}
                  aria-label={t("uploadAvatar")}
                  onClick={() => fileRef.current?.click()}
                >
                  {profile.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Data-URL-Avatar
                    <img
                      src={profile.image}
                      alt={t("avatarAlt", { name: profile.name || "…" })}
                    />
                  ) : (
                    (profile.name || "?").charAt(0).toUpperCase()
                  )}
                  <AvatarOverlay>
                    <CameraIcon size={26} />
                    {t("avatarChange")}
                  </AvatarOverlay>
                  {avatarBusy ? <AvatarSpinner aria-hidden /> : null}
                </AvatarButton>
                {avatarBusy ? null : (
                  <AvatarBadge aria-hidden>
                    <CameraIcon size={18} />
                  </AvatarBadge>
                )}
              </AvatarField>
              {avatarBusy ? (
                <Muted role="status" style={{ fontSize: "0.78rem" }}>
                  {t("avatarUploading")}
                </Muted>
              ) : (
                <Muted style={{ fontSize: "0.78rem" }}>{t("avatarHint")}</Muted>
              )}
              {profile.image ? (
                <RemoveLink
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => runAvatar(() => removeAvatar())}
                >
                  {t("removeAvatar")}
                </RemoveLink>
              ) : null}
            </AvatarRow>
          </Card>

          <Card as="section" aria-labelledby="name-title">
            <CardHead>
              <CardTitle id="name-title">{t("nameTitle")}</CardTitle>
              <SaveStatus state={nameStatus} />
            </CardHead>
            <FormStack onSubmit={(e) => e.preventDefault()} noValidate>
              <Field
                label={t("nameLabel")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                error={nameError}
              />
              <Field
                label={t("accountEmail")}
                value={profile.email}
                readOnly
                disabled
              />
            </FormStack>
          </Card>
        </Header>

        {learnerOnly ? null : (
          <>
        {/* Rechnungsadresse gilt für alle Bereiche – daher außerhalb der Tabs */}
        <div style={{ marginTop: "1.5rem" }}>{billingCard}</div>

        {/* Ein Konto, vier Bereiche – je Tab die bereichsspezifischen Angaben */}
        <TabList role="tablist" aria-label={t("tabsLabel")}>
          {TAB_ORDER.map((id, index) => (
            <TabButton
              key={id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={activeTab === id}
              aria-controls={`panel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              $active={activeTab === id}
              onClick={() => setActiveTab(id)}
              onKeyDown={onTabKeyDown}
            >
              {tabLabel[id]}
            </TabButton>
          ))}
        </TabList>

        <Panel
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === "learner" ? (
            <Card as="section">
              <Muted style={{ fontSize: "0.9rem" }}>{t("noAreaSettings")}</Muted>
            </Card>
          ) : null}

          {activeTab === "creator" ? (
            <>
              <Card as="section" aria-labelledby="creator-bio-title">
                <CardHead>
                  <CardTitle id="creator-bio-title">
                    {t("creatorBioTitle")}
                  </CardTitle>
                  <SaveStatus state={bioStatus} />
                </CardHead>
                <Muted style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
                  {t("creatorBioHint")}
                </Muted>
                <RichTextEditor
                  label={t("creatorBioTitle")}
                  value={bio}
                  onChange={setBio}
                />
              </Card>
              {payoutCard}
            </>
          ) : null}

          {activeTab === "partner" ? payoutCard : null}

          {activeTab === "business" ? (
            <Card as="section">
              <Muted style={{ fontSize: "0.9rem" }}>{t("noAreaSettings")}</Muted>
            </Card>
          ) : null}
        </Panel>
          </>
        )}
      </Container>
    </Wrap>
  );
}
