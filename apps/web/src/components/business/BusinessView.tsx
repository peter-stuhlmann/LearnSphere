"use client";

import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { motion } from "motion/react";
import { formatPrice } from "@elearning/core/format";
import {
  BUSINESS_MIN_SEATS,
  businessOrderTotalCents,
  businessSeatPriceCents,
  businessVolumeDiscountRate,
  validateSeatCount,
} from "@elearning/core/business";
import {
  addBusinessMember,
  cancelBusinessLicense,
  removeBusinessMember,
  searchBusinessCourses,
  startBusinessCheckout,
} from "@/app/actions/business-actions";
import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type {
  BusinessCourseOption,
  BusinessLicenseItem,
} from "@/lib/services/business-service";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatTile, TileGrid } from "@/components/charts/StatTile";
import { FormAlert } from "@/components/auth/AuthShell";
import {
  Badge,
  Card,
  Container,
  GhostButton,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const LicenseCard = styled(motion(Card))`
  margin-top: 1.5rem;

  h2 {
    font-size: 1.25rem;
  }
`;

const LicenseHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.9rem;
  margin-bottom: 1rem;
`;

const PillInput = styled.input`
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 0.42rem 0.95rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text};

  &::placeholder {
    color: ${({ theme }) => theme.colors.textFaint};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

const SeatInput = styled(PillInput)`
  width: 110px;
  font-family: ${({ theme }) => theme.fonts.mono};
`;

const MemberTableWrap = styled.div`
  overflow-x: auto;
`;

const MemberTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;

  th,
  td {
    text-align: left;
    padding: 0.55rem 0.7rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    white-space: nowrap;
  }

  th {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${({ theme }) => theme.colors.textFaint};
  }

  td.progress {
    min-width: 160px;
  }
`;

const RowButton = styled.button`
  padding: 0.3rem 0.8rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 0.76rem;
  color: ${({ theme }) => theme.colors.textMuted};

  &:hover {
    border-color: ${({ theme }) => theme.colors.danger};
    color: ${({ theme }) => theme.colors.danger};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const AddRow = styled.form`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.9rem;

  /* nur das E-Mail-Feld dehnen – NICHT die verschachtelte Checkbox */
  > input {
    flex: 1;
    min-width: 220px;
  }
`;

/* Neue Lizenz */
const NewLicenseCard = styled(Card)`
  margin-top: 2rem;

  h2 {
    font-size: 1.2rem;
    margin-bottom: 0.4rem;
  }
`;

const SearchWrap = styled.div`
  position: relative;
  max-width: 420px;
`;

const ResultList = styled.ul`
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  list-style: none;
  padding: 5px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgDeep};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const ResultButton = styled.button`
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  font-size: 0.88rem;
  color: ${({ theme }) => theme.colors.text};

  span {
    display: block;
    font-size: 0.74rem;
    color: ${({ theme }) => theme.colors.textFaint};
  }

  &:hover,
  &:focus-visible {
    background: ${({ theme }) => theme.colors.accentSoft};
    outline: none;
  }
`;

/* Beschriftete Feld-Gruppe: Label über dem Element, einheitliche Zeilenhöhe */
const LabeledField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const NewLicenseRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
`;

const CreateButton = styled(PrimaryButton)`
  padding: 0.45rem 1.3rem;
  font-size: 0.85rem;
`;

const NotifyLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;

  input {
    width: 16px;
    height: 16px;
    accent-color: ${({ theme }) => theme.colors.accent};
  }
`;

/* Beendete Lizenzen: kompakte, gedämpfte Zeilen */
const EndedList = styled.ul`
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const EndedRow = styled.li`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.9rem;
  padding: 0.7rem 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  font-size: 0.86rem;
  color: ${({ theme }) => theme.colors.textMuted};

  strong {
    color: ${({ theme }) => theme.colors.text};
  }
`;

/* ---------- Tab-Navigation (räumt die Seite auf) ---------- */
const TabList = styled.div`
  display: flex;
  gap: 0.15rem;
  margin-top: 2rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  overflow-x: auto;
`;

const TabButton = styled.button<{ $active: boolean }>`
  padding: 0.7rem 1.1rem;
  font-size: 0.92rem;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.text : theme.colors.textMuted};
  border-bottom: 2px solid
    ${({ theme, $active }) => ($active ? theme.colors.accent : "transparent")};
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: -2px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }
`;

const TabPanel = styled.div`
  margin-top: 1.75rem;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
`;

/* Preis-Aufschlüsselung im Neue-Lizenz-Formular: regulärer Gesamtpreis
   sichtbar, darunter das ÷5-Modell und die Gesamtkosten. */
const PricePanel = styled.div`
  margin-top: 1.1rem;
  padding: 1rem 1.15rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const PriceRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.textMuted};

  strong {
    color: ${({ theme }) => theme.colors.text};
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
`;

const PriceTotal = styled(PriceRow)`
  padding-top: 0.55rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 1rem;

  strong {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

type TabId = "overview" | "new" | "ended";

/** Barrierefreie Tab-Leiste (ARIA-Tabs mit Pfeiltasten-Navigation). */
function TabNav({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: TabId; label: string }[];
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onKeyDown(event: ReactKeyboardEvent) {
    const index = tabs.findIndex((tab) => tab.id === active);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    ref.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  }

  return (
    <TabList role="tablist" ref={ref} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          type="button"
          role="tab"
          id={`btab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`bpanel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          $active={active === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </TabButton>
      ))}
    </TabList>
  );
}

interface BusinessViewProps {
  licenses: BusinessLicenseItem[];
  /** Von der Kurs-Detailseite vorausgewählter Kurs (Direkteinstieg) */
  initialCourse?: BusinessCourseOption | null;
}

export function BusinessView({ licenses, initialCourse }: BusinessViewProps) {
  const t = useTranslations("business");
  const locale = useLocale();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Neue Lizenz
  const [courseQuery, setCourseQuery] = useState("");
  const [courseResults, setCourseResults] = useState<BusinessCourseOption[]>(
    []
  );
  const [pickedCourse, setPickedCourse] = useState<BusinessCourseOption | null>(
    initialCourse ?? null
  );
  const [seats, setSeats] = useState(BUSINESS_MIN_SEATS);
  const [creating, setCreating] = useState(false);
  // Aktiver Tab; kommt der Kurs von der Detailseite vorausgewählt, startet
  // direkt der „Neue Lizenz“-Tab (Direkteinstieg).
  const [tab, setTab] = useState<TabId>(initialCourse ? "new" : "overview");
  const [cancelTarget, setCancelTarget] = useState<BusinessLicenseItem | null>(
    null
  );
  const [notifyMembers, setNotifyMembers] = useState(true);
  const searchRequest = useRef(0);

  const activeLicenses = licenses.filter((l) => l.status !== "CANCELED");
  const endedLicenses = licenses.filter((l) => l.status === "CANCELED");

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale]
  );

  const totalSeats = activeLicenses.reduce((sum, l) => sum + l.seats, 0);
  const totalUsed = activeLicenses.reduce((sum, l) => sum + l.usedSeats, 0);
  const totalInvested = activeLicenses.reduce(
    (sum, l) => sum + l.totalPaidCents,
    0
  );

  function searchCourses(value: string) {
    setCourseQuery(value);
    setPickedCourse(null);
    const request = ++searchRequest.current;
    if (!value.trim()) {
      setCourseResults([]);
      return;
    }
    void searchBusinessCourses({ query: value }).then((response) => {
      if (request === searchRequest.current && response.ok) {
        setCourseResults(response.courses ?? []);
      }
    });
  }

  async function onCreate() {
    if (!pickedCourse || creating) return;
    setCreating(true);
    setError(null);
    const result = await startBusinessCheckout({
      courseId: pickedCourse.id,
      seats,
      locale,
    });
    setCreating(false);
    if (!result.ok) {
      setError(result.error ?? "generic");
      return;
    }
    if (result.url) {
      // weiter zur Stripe-Kasse – die Bestellung entsteht nach der Zahlung
      window.location.href = result.url;
      return;
    }
    // Demo-Modus: Bestellung wurde direkt angelegt → zurück zur Übersicht
    setPickedCourse(null);
    setCourseQuery("");
    setSeats(BUSINESS_MIN_SEATS);
    setTab("overview");
  }

  async function onAddMember(licenseId: string, form: HTMLFormElement) {
    const input = form.elements.namedItem("email") as HTMLInputElement | null;
    const email = input?.value ?? "";
    if (!email) return;
    setPendingId(licenseId);
    setError(null);
    const result = await addBusinessMember({
      licenseId,
      email,
      notify: notifyMembers,
      locale,
    });
    setPendingId(null);
    if (!result.ok) {
      setError(result.error ?? "generic");
      return;
    }
    if (input) input.value = "";
    // Liste sofort mit dem neuen Mitglied aktualisieren (Server-Daten frisch)
    router.refresh();
  }

  async function onCancelLicense() {
    if (!cancelTarget) return;
    const licenseId = cancelTarget.id;
    setCancelTarget(null);
    setError(null);
    const result = await cancelBusinessLicense({ licenseId });
    if (!result.ok) {
      setError(result.error ?? "generic");
      return;
    }
    router.refresh();
  }

  const errorText = (code: string) => {
    const known = [
      "seats_invalid",
      "seats_full",
      "email_invalid",
      "already_member",
      "course_unavailable",
      "payments_unavailable",
      "not_found",
    ];
    return known.includes(code)
      ? t(`errors.${code}` as never)
      : t("errors.generic");
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: t("tabOverview") },
    { id: "new", label: t("tabNew") },
    ...(endedLicenses.length > 0
      ? [{ id: "ended" as const, label: t("tabEnded") }]
      : []),
  ];

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("kicker")}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>
        <Muted style={{ marginTop: "0.4rem", maxWidth: "640px" }}>
          {t("intro")}
        </Muted>

        <TabNav tabs={tabs} active={tab} onChange={setTab} />

        {error ? (
          <FormAlert $tone="error" role="alert" style={{ marginTop: "1rem" }}>
            {errorText(error)}
          </FormAlert>
        ) : null}

        {/* ---------- Tab: Übersicht ---------- */}
        <TabPanel
          role="tabpanel"
          id="bpanel-overview"
          aria-labelledby="btab-overview"
          hidden={tab !== "overview"}
        >
          {tab === "overview" ? (
            activeLicenses.length === 0 ? (
              <EmptyState>
                <Muted>{t("emptyOverview")}</Muted>
                <PrimaryButton type="button" onClick={() => setTab("new")}>
                  {`➕ ${t("newButton")}`}
                </PrimaryButton>
              </EmptyState>
            ) : (
              <>
                <TileGrid>
                  <StatTile label={t("tileSeats")} value={totalSeats} />
                  <StatTile
                    label={t("tileUsed")}
                    value={`${totalUsed} / ${totalSeats}`}
                  />
                  <StatTile
                    label={t("tileInvested")}
                    value={formatPrice(totalInvested, "EUR", locale)}
                    hint={t("tileInvestedHint")}
                  />
                  <StatTile
                    label={t("tileLicenses")}
                    value={activeLicenses.length}
                  />
                </TileGrid>
                {activeLicenses.map((license, index) => {
          return (
          <LicenseCard
            key={license.id}
            as="section"
            aria-label={license.courseTitle}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.06, 0.3), duration: 0.4 }}
          >
            <LicenseHead>
              <h2>{license.courseTitle}</h2>
              <Badge $tone={license.usedSeats < license.seats ? "accent" : "muted"}>
                {t("seatsUsed", {
                  used: license.usedSeats,
                  total: license.seats,
                })}
              </Badge>
              <Muted as="span" style={{ fontSize: "0.85rem" }}>
                {t("licenseTotal", {
                  amount: formatPrice(license.totalPaidCents, "EUR", locale),
                })}
              </Muted>
              <RowButton
                type="button"
                style={{ marginLeft: "auto" }}
                onClick={() => setCancelTarget(license)}
              >
                {t("cancelLicense")}
              </RowButton>
            </LicenseHead>

            {license.members.length > 0 ? (
              <MemberTableWrap>
                <MemberTable>
                  <thead>
                    <tr>
                      <th>{t("colEmail")}</th>
                      <th>{t("colStatus")}</th>
                      <th className="progress">{t("colProgress")}</th>
                      <th aria-label={t("colActions")} />
                    </tr>
                  </thead>
                  <tbody>
                    {license.members.map((member) => (
                      <tr key={member.id}>
                        <td>{member.email}</td>
                        <td>
                          {member.completed ? (
                            <Badge $tone="success">{t("completed")}</Badge>
                          ) : member.enrolledAt ? (
                            <Muted as="span" style={{ fontSize: "0.8rem" }}>
                              {t("memberSince", {
                                date: dateFormat.format(
                                  new Date(member.enrolledAt)
                                ),
                              })}
                            </Muted>
                          ) : (
                            <Badge $tone="muted">{t("invited")}</Badge>
                          )}
                        </td>
                        <td className="progress">
                          {member.enrolledAt ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <ProgressBar
                                  percent={member.watchPercent}
                                  label={t("colProgress")}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: "0.78rem",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {member.watchPercent} %
                              </span>
                            </div>
                          ) : (
                            <Muted as="span" style={{ fontSize: "0.8rem" }}>
                              –
                            </Muted>
                          )}
                        </td>
                        <td>
                          <RowButton
                            type="button"
                            onClick={() =>
                              void removeBusinessMember({
                                memberId: member.id,
                              }).then((result) => {
                                if (!result.ok) {
                                  setError(result.error ?? "generic");
                                  return;
                                }
                                router.refresh();
                              })
                            }
                          >
                            {t("removeMember")}
                          </RowButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </MemberTable>
              </MemberTableWrap>
            ) : (
              <Muted style={{ fontSize: "0.88rem" }}>{t("noMembers")}</Muted>
            )}

            {license.usedSeats < license.seats ? (
              <AddRow
                onSubmit={(event) => {
                  event.preventDefault();
                  void onAddMember(license.id, event.currentTarget);
                }}
              >
                <PillInput
                  name="email"
                  type="email"
                  placeholder={t("addMemberPlaceholder")}
                  aria-label={t("addMemberPlaceholder")}
                  required
                />
                <NotifyLabel>
                  <input
                    type="checkbox"
                    checked={notifyMembers}
                    onChange={(event) =>
                      setNotifyMembers(event.target.checked)
                    }
                  />
                  {t("notifyByEmail")}
                </NotifyLabel>
                <GhostButton type="submit" disabled={pendingId === license.id}>
                  {t("addMember")}
                </GhostButton>
              </AddRow>
            ) : (
              <Muted style={{ fontSize: "0.82rem", marginTop: "0.75rem" }}>
                {t("allSeatsUsed")}
              </Muted>
            )}
          </LicenseCard>
          );
                })}
              </>
            )
          ) : null}
        </TabPanel>

        {/* ---------- Tab: Neue Lizenz ---------- */}
        <TabPanel
          role="tabpanel"
          id="bpanel-new"
          aria-labelledby="btab-new"
          hidden={tab !== "new"}
        >
          {tab === "new" ? (
        <NewLicenseCard as="section" aria-labelledby="new-license-title">
          <h2 id="new-license-title">{t("newTitle")}</h2>
          <Muted style={{ fontSize: "0.88rem", marginBottom: "1rem" }}>
            {t("newHint")}
          </Muted>

          <NewLicenseRow>
            <LabeledField style={{ flex: "1 1 260px" }}>
              {t("courseLabel")}
              <SearchWrap style={{ maxWidth: "none" }}>
                <PillInput
                  type="search"
                  style={{ width: "100%" }}
                  value={pickedCourse ? pickedCourse.title : courseQuery}
                  placeholder={t("courseSearchPlaceholder")}
                  onChange={(event) => searchCourses(event.target.value)}
                />
                {!pickedCourse && courseResults.length > 0 ? (
                  <ResultList role="listbox">
                    {courseResults.map((course) => (
                      <li key={course.id} role="option" aria-selected={false}>
                        <ResultButton
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setPickedCourse(course);
                            setCourseResults([]);
                          }}
                        >
                          {course.title}
                          <span>
                            {course.own ? t("ownCourse") : course.creatorName}
                          </span>
                        </ResultButton>
                      </li>
                    ))}
                  </ResultList>
                ) : null}
              </SearchWrap>
            </LabeledField>

            <LabeledField>
              {t("seatsLabel")}
              <SeatInput
                type="number"
                min={BUSINESS_MIN_SEATS}
                max={10000}
                value={seats}
                onChange={(event) => setSeats(Number(event.target.value))}
              />
            </LabeledField>

            <CreateButton
              type="button"
              disabled={!pickedCourse || !validateSeatCount(seats) || creating}
              onClick={() => void onCreate()}
            >
              {creating ? t("creating") : t("createButton")}
            </CreateButton>
          </NewLicenseRow>

          {!pickedCourse ? (
            <Muted style={{ fontSize: "0.85rem", marginTop: "0.9rem" }}>
              {t("costPickCourse")}
            </Muted>
          ) : validateSeatCount(seats) ? (
            <PricePanel aria-live="polite">
              <PriceRow>
                <span>{t("priceRegular")}</span>
                <strong>
                  {formatPrice(pickedCourse.priceCents, "EUR", locale)}
                </strong>
              </PriceRow>
              <PriceRow>
                <span>{t("priceDiscount", { seats })}</span>
                <strong>
                  −{Math.round(businessVolumeDiscountRate(seats) * 100)} %
                </strong>
              </PriceRow>
              <PriceRow>
                <span>{t("priceSeat")}</span>
                <strong>
                  {formatPrice(
                    businessSeatPriceCents(pickedCourse.priceCents, seats),
                    "EUR",
                    locale
                  )}
                </strong>
              </PriceRow>
              <PriceTotal>
                <span>{t("priceTotalOnce", { seats })}</span>
                <strong>
                  {formatPrice(
                    businessOrderTotalCents(pickedCourse.priceCents, seats),
                    "EUR",
                    locale
                  )}
                </strong>
              </PriceTotal>
            </PricePanel>
          ) : (
            <Muted style={{ fontSize: "0.85rem", marginTop: "0.9rem" }}>
              {t("errors.seats_invalid")}
            </Muted>
          )}
        </NewLicenseCard>
          ) : null}
        </TabPanel>

        {/* ---------- Tab: Beendet ---------- */}
        {endedLicenses.length > 0 ? (
          <TabPanel
            role="tabpanel"
            id="bpanel-ended"
            aria-labelledby="btab-ended"
            hidden={tab !== "ended"}
          >
            {tab === "ended" ? (
              <NewLicenseCard as="section" aria-labelledby="ended-title">
                <h2 id="ended-title">{t("endedTitle")}</h2>
                <EndedList>
                  {endedLicenses.map((license) => (
                    <EndedRow key={license.id}>
                      <strong>{license.courseTitle}</strong>
                      <span>
                        {t("seatsUsed", {
                          used: license.usedSeats,
                          total: license.seats,
                        })}
                      </span>
                      {license.canceledAt ? (
                        <span>
                          {t("endedAt", {
                            date: dateFormat.format(
                              new Date(license.canceledAt)
                            ),
                          })}
                        </span>
                      ) : null}
                      <Badge $tone="muted">{t("statusEnded")}</Badge>
                    </EndedRow>
                  ))}
                </EndedList>
              </NewLicenseCard>
            ) : null}
          </TabPanel>
        ) : null}

        <ConfirmDialog
          open={cancelTarget !== null}
          title={t("cancelTitle")}
          message={t("cancelMessage", {
            course: cancelTarget?.courseTitle ?? "",
          })}
          confirmLabel={t("cancelConfirm")}
          cancelLabel={t("cancelAbort")}
          onConfirm={() => void onCancelLicense()}
          onCancel={() => setCancelTarget(null)}
        />
      </Container>
    </Wrap>
  );
}
