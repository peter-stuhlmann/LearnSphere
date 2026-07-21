"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";

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
import styled from "styled-components";
import { Link, useRouter } from "@/i18n/navigation";
import {
  removeAvatar,
  saveBillingAddress,
  saveCreatorBio,
  updateAvatar,
  updateProfileName,
} from "@/app/actions/profile-actions";
import { RichTextEditor } from "@/components/ui/RichTextEditorLazy";
import { AVATAR_SIZE } from "@elearning/core/avatar";
import { SUPPORTED_COUNTRIES } from "@elearning/core/validation";
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
import { Select } from "@/components/ui/Select";
import { FormAlert } from "@/components/auth/AuthShell";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Grid = styled.div`
  display: grid;
  gap: 1.5rem;
  margin-top: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 360px 1fr;
    align-items: start;
  }
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const CardTitle = styled.h2`
  font-size: 1.25rem;
  margin-bottom: 1rem;
`;

const AvatarRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
`;

const AvatarCircle = styled.div`
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2.2rem;
  background: ${({ theme }) => theme.colors.violetSoft};
  color: ${({ theme }) => theme.colors.violet};
  border: 2px solid ${({ theme }) => theme.colors.borderStrong};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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

const ModeGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
`;

const ModeCard = styled(Link)<{ $tone: "accent" | "violet" }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: ${({ theme }) => theme.radii.md};
  text-decoration: none;
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid
    ${({ $tone }) =>
      $tone === "violet" ? "rgba(139,124,255,0.45)" : "rgba(200,255,77,0.45)"};
  background: ${({ theme, $tone }) =>
    $tone === "violet" ? theme.colors.violetSoft : theme.colors.accentSoft};
  transition: transform 150ms ease;

  &:hover {
    transform: translateX(3px);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  strong {
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: 1.1rem;
    white-space: nowrap;
    color: ${({ theme, $tone }) =>
      $tone === "violet" ? theme.colors.violet : theme.colors.accent};
  }

  span {
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }

  .arrow {
    flex-shrink: 0;
    font-size: 1.1rem;
    color: ${({ theme, $tone }) =>
      $tone === "violet" ? theme.colors.violet : theme.colors.accent};
  }
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

interface ProfileViewProps {
  profile: {
    name: string;
    email: string;
    image: string | null;
    creatorBio: string;
  };
  billing: BillingDraft | null;
}

export function ProfileView({ profile, billing }: ProfileViewProps) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const countryNames = new Intl.DisplayNames([locale], { type: "region" });

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "generic");
        return;
      }
      setNotice(t("saved"));
      router.refresh();
    });
  }

  async function onAvatarChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    // Vor dem Upload auf 256×256 verkleinern: Der Avatar landet als Data-URL
    // im Header jeder Seite – ein 2-MB-Original würde jedes HTML aufblähen.
    const small = await downscaleAvatar(file);
    const formData = new FormData();
    formData.set(
      "avatar",
      small ? new File([small], "avatar.jpg", { type: "image/jpeg" }) : file
    );
    run(() => updateAvatar(formData));
  }

  function onSaveName(event: FormEvent) {
    event.preventDefault();
    run(() => updateProfileName({ name }));
  }

  function onSaveAddress(event: FormEvent) {
    event.preventDefault();
    run(() => saveBillingAddress(address));
  }

  const knownError = (code: string) =>
    [
      "avatar_invalid",
      "avatar_missing",
      "avatar_flagged",
      "name_too_short",
      "first_name_required",
      "last_name_required",
      "street_required",
      "zip_invalid",
      "city_required",
      "email_invalid",
    ].includes(code)
      ? t(`errors.${code}` as never)
      : t("errors.generic");

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

        <Grid>
          <Column>
            <Card as="section" aria-labelledby="avatar-title">
              <CardTitle id="avatar-title">{t("avatarTitle")}</CardTitle>
              <AvatarRow>
                <AvatarCircle>
                  {profile.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Data-URL-Avatar
                    <img
                      src={profile.image}
                      alt={t("avatarAlt", { name: profile.name || "…" })}
                    />
                  ) : (
                    (profile.name || "?").charAt(0).toUpperCase()
                  )}
                </AvatarCircle>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onAvatarChange}
                    style={{ display: "none" }}
                    aria-hidden
                    tabIndex={-1}
                  />
                  <PrimaryButton
                    type="button"
                    disabled={pending}
                    onClick={() => fileRef.current?.click()}
                  >
                    {t("uploadAvatar")}
                  </PrimaryButton>
                  {profile.image ? (
                    <GhostButton
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => removeAvatar())}
                    >
                      {t("removeAvatar")}
                    </GhostButton>
                  ) : null}
                  <Muted style={{ fontSize: "0.78rem" }}>
                    {t("avatarHint")}
                  </Muted>
                </div>
              </AvatarRow>
            </Card>

            <Card as="section" aria-labelledby="name-title">
              <CardTitle id="name-title">{t("nameTitle")}</CardTitle>
              <FormStack onSubmit={onSaveName}>
                <Field
                  label={t("nameLabel")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                />
                <Field
                  label={t("accountEmail")}
                  value={profile.email}
                  readOnly
                  disabled
                />
                <PrimaryButton type="submit" disabled={pending}>
                  {tc("save")}
                </PrimaryButton>
              </FormStack>
            </Card>

            <Card as="section" aria-labelledby="mode-title">
              <CardTitle id="mode-title">{t("modeTitle")}</CardTitle>
              <Muted style={{ fontSize: "0.9rem" }}>{t("modeText")}</Muted>
              <ModeGrid>
                <ModeCard href="/my-learning" $tone="accent">
                  <div className="text">
                    <strong>{t("learnerCard")}</strong>
                    <span>{t("learnerCardText")}</span>
                  </div>
                  <span className="arrow" aria-hidden>
                    →
                  </span>
                </ModeCard>
                <ModeCard href="/creator" $tone="violet">
                  <div className="text">
                    <strong>{t("creatorCard")}</strong>
                    <span>{t("creatorCardText")}</span>
                  </div>
                  <span className="arrow" aria-hidden>
                    →
                  </span>
                </ModeCard>
              </ModeGrid>
            </Card>
          </Column>

          <Card as="section" aria-labelledby="billing-title">
            <CardTitle id="billing-title">{t("billingTitle")}</CardTitle>
            <Muted style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
              {t("billingHint")}{" "}
              <Link
                href="/creator/distribution"
                style={{ color: "#8B7CFF" }}
              >
                {t("toPayouts")} →
              </Link>
            </Muted>
            <FormStack onSubmit={onSaveAddress}>
              <RowSplit>
                <Field
                  label={t("firstName")}
                  autoComplete="given-name"
                  value={address.firstName}
                  onChange={(e) =>
                    setAddress({ ...address, firstName: e.target.value })
                  }
                  required
                />
                <Field
                  label={t("lastName")}
                  autoComplete="family-name"
                  value={address.lastName}
                  onChange={(e) =>
                    setAddress({ ...address, lastName: e.target.value })
                  }
                  required
                />
              </RowSplit>
              <Field
                label={t("street")}
                autoComplete="street-address"
                value={address.street}
                onChange={(e) =>
                  setAddress({ ...address, street: e.target.value })
                }
                required
                minLength={3}
              />
              <Field
                label={t("addressExtra")}
                value={address.addressExtra}
                onChange={(e) =>
                  setAddress({ ...address, addressExtra: e.target.value })
                }
              />
              <ZipCityRow>
                <Field
                  label={t("zip")}
                  autoComplete="postal-code"
                  value={address.zip}
                  onChange={(e) =>
                    setAddress({ ...address, zip: e.target.value })
                  }
                  required
                  minLength={3}
                  maxLength={10}
                />
                <Field
                  label={t("city")}
                  autoComplete="address-level2"
                  value={address.city}
                  onChange={(e) =>
                    setAddress({ ...address, city: e.target.value })
                  }
                  required
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
                  onChange={(country) => setAddress({ ...address, country })}
                />
              </div>
              <Field
                label={t("billingEmail")}
                type="email"
                autoComplete="email"
                value={address.email}
                onChange={(e) =>
                  setAddress({ ...address, email: e.target.value })
                }
                required
              />
              <PrimaryButton type="submit" disabled={pending}>
                {tc("save")}
              </PrimaryButton>
            </FormStack>
          </Card>
        </Grid>

        <Card
          as="section"
          aria-labelledby="creator-bio-title"
          style={{ marginTop: "1.5rem" }}
        >
          <CardTitle id="creator-bio-title">{t("creatorBioTitle")}</CardTitle>
          <Muted style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
            {t("creatorBioHint")}
          </Muted>
          <FormStack
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              run(() => saveCreatorBio({ html: bio }));
            }}
          >
            <RichTextEditor
              label={t("creatorBioTitle")}
              value={bio}
              onChange={setBio}
            />
            <PrimaryButton
              type="submit"
              disabled={pending}
              style={{ alignSelf: "flex-start" }}
            >
              {tc("save")}
            </PrimaryButton>
          </FormStack>
        </Card>
      </Container>
    </Wrap>
  );
}
