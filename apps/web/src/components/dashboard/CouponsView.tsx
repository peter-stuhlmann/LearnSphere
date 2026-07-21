"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { useRouter } from "@/i18n/navigation";
import {
  createCoupon,
  deleteCoupon,
  setCouponActive,
} from "@/app/actions/coupon-actions";
import { applyCoupon } from "@elearning/core/coupon";
import { formatPrice } from "@elearning/core/format";
import {
  Badge,
  Card,
  Container,
  DangerButton,
  GhostButton,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { FormAlert } from "@/components/auth/AuthShell";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
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

const FormStack = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const LabelText = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  display: block;
  margin-bottom: 0.4rem;
`;

const CourseChecklist = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  max-height: 240px;
  overflow-y: auto;
`;

const CourseOption = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  text-align: left;
  padding: 0.65rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid
    ${({ theme, $selected }) =>
      $selected ? "rgba(200, 255, 77, 0.45)" : theme.colors.border};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentSoft : theme.colors.bgElevated};
  transition: border-color 160ms ease, background 160ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const CheckDot = styled.span<{ $selected: boolean }>`
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.7rem;
  font-weight: 700;
  transition: background 160ms ease, border-color 160ms ease;
  border: 1px solid
    ${({ theme, $selected }) =>
      $selected ? theme.colors.accent : theme.colors.borderStrong};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.accent : "transparent"};
  color: ${({ theme }) => theme.colors.onAccent};
`;

const CourseOptionTitle = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CourseOptionPrice = styled.span`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const CouponRow = styled(Card)`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;

  code {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 1rem;
    color: ${({ theme }) => theme.colors.accent};
    letter-spacing: 0.05em;
  }
`;

const Discount = styled.span`
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text};
`;

const MetaText = styled.span`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const Spacer = styled.div`
  flex: 1;
`;

interface CouponItem {
  id: string;
  code: string;
  kind: "PERCENT" | "AMOUNT_OFF" | "FIXED_PRICE";
  value: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  courseTitles: string[];
}

interface CouponsViewProps {
  courseId: string;
  courseTitle: string;
  priceCents: number;
  currency: string;
  paidCourses: { id: string; title: string; priceCents: number }[];
  coupons: CouponItem[];
}

export function CouponsView({
  courseId,
  courseTitle,
  priceCents,
  currency,
  paidCourses,
  coupons,
}: CouponsViewProps) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    code: "",
    kind: "PERCENT" as CouponItem["kind"],
    valueRaw: "",
    maxRedemptionsRaw: "",
    validFromRaw: "",
    validUntilRaw: "",
    courseIds: [courseId],
  });

  function toggleCourse(id: string) {
    setDraft((d) => ({
      ...d,
      courseIds: d.courseIds.includes(id)
        ? d.courseIds.filter((c) => c !== id)
        : [...d.courseIds, id],
    }));
  }

  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function couponLabel(coupon: { kind: CouponItem["kind"]; value: number }) {
    switch (coupon.kind) {
      case "PERCENT":
        return `−${coupon.value} %`;
      case "AMOUNT_OFF":
        return `−${formatPrice(coupon.value, currency, locale)}`;
      case "FIXED_PRICE":
        return `→ ${formatPrice(coupon.value, currency, locale)}`;
    }
  }

  function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const numeric = Number(draft.valueRaw);
    const value =
      draft.kind === "PERCENT" ? Math.round(numeric) : Math.round(numeric * 100);

    startTransition(async () => {
      const result = await createCoupon({
        code: draft.code,
        kind: draft.kind,
        value,
        maxRedemptions:
          draft.maxRedemptionsRaw === ""
            ? null
            : Number(draft.maxRedemptionsRaw),
        validFrom:
          draft.validFromRaw === "" ? null : new Date(draft.validFromRaw),
        validUntil:
          draft.validUntilRaw === "" ? null : new Date(draft.validUntilRaw),
        courseIds: draft.courseIds,
      });
      if (!result.ok) {
        setError(result.error ?? "generic");
        return;
      }
      setDraft({
        code: "",
        kind: "PERCENT",
        valueRaw: "",
        maxRedemptionsRaw: "",
        validFromRaw: "",
        validUntilRaw: "",
        courseIds: [courseId],
      });
      router.refresh();
    });
  }

  const knownErrors = [
    "code_taken",
    "code_too_short",
    "code_invalid_chars",
    "percent_above_100",
    "value_above_price",
    "value_too_small",
    "window_invalid",
    "no_courses",
    "course_free",
  ];

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{courseTitle}</Kicker>
        <SectionTitle as="h1">{t("coupons")}</SectionTitle>

        {priceCents === 0 ? (
          <Muted style={{ marginTop: "1.5rem" }}>{t("couponsOnlyPaid")}</Muted>
        ) : (
          <Layout>
            <Card as="section" aria-labelledby="new-coupon-title">
              <h2
                id="new-coupon-title"
                style={{ fontSize: "1.2rem", marginBottom: "1rem" }}
              >
                {t("newCoupon")}
              </h2>
              <FormStack onSubmit={onCreate}>
                {error ? (
                  <FormAlert $tone="error" role="alert">
                    {knownErrors.includes(error)
                      ? t(`couponErrors.${error}` as never)
                      : error}
                  </FormAlert>
                ) : null}

                <Field
                  label={t("couponCode")}
                  value={draft.code}
                  onChange={(e) =>
                    setDraft({ ...draft, code: e.target.value })
                  }
                  placeholder="SOMMER-25"
                  required
                  minLength={3}
                  maxLength={32}
                />
                <div>
                  <LabelText as="label" htmlFor="coupon-kind">
                    {t("couponKind")}
                  </LabelText>
                  <Select
                    id="coupon-kind"
                    value={draft.kind}
                    options={[
                      { value: "PERCENT", label: t("kindPercent") },
                      { value: "AMOUNT_OFF", label: t("kindAmountOff") },
                      { value: "FIXED_PRICE", label: t("kindFixedPrice") },
                    ]}
                    onChange={(kind) =>
                      setDraft({
                        ...draft,
                        kind: kind as CouponItem["kind"],
                      })
                    }
                  />
                </div>
                <Field
                  label={
                    draft.kind === "PERCENT"
                      ? t("couponValuePercent")
                      : t("couponValueEuro")
                  }
                  type="number"
                  min={draft.kind === "PERCENT" ? 1 : 0.01}
                  max={draft.kind === "PERCENT" ? 100 : undefined}
                  step={draft.kind === "PERCENT" ? 1 : 0.01}
                  value={draft.valueRaw}
                  onChange={(e) =>
                    setDraft({ ...draft, valueRaw: e.target.value })
                  }
                  required
                />
                <Field
                  label={t("maxRedemptions")}
                  type="number"
                  min={1}
                  value={draft.maxRedemptionsRaw}
                  onChange={(e) =>
                    setDraft({ ...draft, maxRedemptionsRaw: e.target.value })
                  }
                />
                <DateTimePicker
                  label={t("validFrom")}
                  value={draft.validFromRaw}
                  emptyLabel={t("validFromNow")}
                  onChange={(v) => setDraft({ ...draft, validFromRaw: v })}
                />
                <DateTimePicker
                  label={t("validUntil")}
                  value={draft.validUntilRaw}
                  emptyLabel={t("validUntilUnlimited")}
                  onChange={(v) => setDraft({ ...draft, validUntilRaw: v })}
                />

                <div>
                  <LabelText id="applies-to-label">{t("appliesTo")}</LabelText>
                  <CourseChecklist
                    role="group"
                    aria-labelledby="applies-to-label"
                  >
                    {paidCourses.map((course) => {
                      const selected = draft.courseIds.includes(course.id);
                      return (
                        <CourseOption
                          key={course.id}
                          type="button"
                          $selected={selected}
                          aria-pressed={selected}
                          onClick={() => toggleCourse(course.id)}
                        >
                          <CheckDot $selected={selected} aria-hidden="true">
                            {selected ? "✓" : ""}
                          </CheckDot>
                          <CourseOptionTitle>{course.title}</CourseOptionTitle>
                          <CourseOptionPrice>
                            {formatPrice(course.priceCents, currency, locale)}
                          </CourseOptionPrice>
                        </CourseOption>
                      );
                    })}
                  </CourseChecklist>
                </div>

                <PrimaryButton
                  type="submit"
                  disabled={pending || draft.courseIds.length === 0}
                >
                  + {t("newCoupon")}
                </PrimaryButton>
              </FormStack>
            </Card>

            <section aria-label={t("coupons")}>
              {coupons.length === 0 ? (
                <Muted>{t("noCoupons")}</Muted>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  {coupons.map((coupon) => (
                    <CouponRow key={coupon.id} as="article">
                      <code>{coupon.code}</code>
                      <Discount>
                        {couponLabel(coupon)} ={" "}
                        {formatPrice(
                          applyCoupon(priceCents, coupon),
                          currency,
                          locale
                        )}
                      </Discount>
                      <Badge $tone={coupon.active ? "success" : "muted"}>
                        {coupon.active
                          ? t("couponActive")
                          : t("couponInactive")}
                      </Badge>
                      <MetaText>
                        {t("redemptions", { count: coupon.redeemedCount })}
                        {coupon.maxRedemptions
                          ? ` / ${coupon.maxRedemptions}`
                          : ""}
                      </MetaText>
                      {coupon.courseTitles.length > 1 ? (
                        <MetaText
                          title={coupon.courseTitles.join(", ")}
                        >
                          {t("appliesToCount", {
                            count: coupon.courseTitles.length,
                          })}
                        </MetaText>
                      ) : null}
                      {coupon.validFrom || coupon.validUntil ? (
                        <MetaText>
                          {coupon.validFrom
                            ? dateFormat.format(new Date(coupon.validFrom))
                            : "…"}{" "}
                          –{" "}
                          {coupon.validUntil
                            ? dateFormat.format(new Date(coupon.validUntil))
                            : "…"}
                        </MetaText>
                      ) : null}
                      <Spacer />
                      <GhostButton
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await setCouponActive(coupon.id, !coupon.active);
                            router.refresh();
                          })
                        }
                      >
                        {coupon.active ? t("deactivate") : t("activate")}
                      </GhostButton>
                      <DangerButton
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(t("deleteConfirm"))) {
                            startTransition(async () => {
                              await deleteCoupon(coupon.id);
                              router.refresh();
                            });
                          }
                        }}
                      >
                        {tc("delete")}
                      </DangerButton>
                    </CouponRow>
                  ))}
                </div>
              )}
            </section>
          </Layout>
        )}
      </Container>
    </Wrap>
  );
}
