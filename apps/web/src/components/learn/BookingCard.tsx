"use client";

import { useState } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { GhostButton, PrimaryButton } from "@/components/ui/primitives";
import {
  TERMINE_RESERVE_URL,
  TERMINE_SUBMIT_URL,
  extractTermineError,
  missingRequiredFields,
  parseReserveResponse,
  type TermineAppointmentType,
  type TermineReserveResult,
  type TermineSlot,
} from "@/lib/termine";

/**
 * Live-Termine (termine.lol): Lernende buchen direkt aus dem Kurs einen
 * Termin beim Creator. Kalender und freie Slots kommen über unseren Proxy
 * (API-Key bleibt serverseitig), Reservieren + Buchen gehen direkt an die
 * öffentliche termine.lol-Buchungs-API (10-Minuten-Hold, Double-Opt-In).
 */

interface BookingCalendar {
  calendarId: string;
  title: string;
  timezone: string;
  appointmentTypes: TermineAppointmentType[];
}

const Card = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: 0.85rem 1.1rem;

  > strong {
    font-size: 0.9rem;
  }

  > p {
    margin: 0;
    font-size: 0.82rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const TypeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const TypeButton = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  text-align: left;
  padding: 0.7rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? "rgba(200, 255, 77, 0.5)" : theme.colors.border};
  background: ${({ $active }) =>
    $active ? "rgba(200, 255, 77, 0.08)" : "transparent"};
  color: ${({ theme }) => theme.colors.text};

  small {
    color: ${({ theme }) => theme.colors.textMuted};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const SlotGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 0.5rem;
`;

const SlotButton = styled.button`
  padding: 0.5rem 0.25rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-variant-numeric: tabular-nums;
  font-size: 0.88rem;

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const Note = styled.p`
  margin: 0;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ErrorNote = styled.p`
  margin: 0;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.danger};
`;

const Summary = styled.p`
  margin: 0;
  padding: 0.7rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid rgba(200, 255, 77, 0.35);
  background: rgba(200, 255, 77, 0.06);
  font-size: 0.9rem;
`;

const GroupLabel = styled.span`
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

/** Heutiges Datum als YYYY-MM-DD (lokale Zeit des Lernenden). */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function BookingCard({ courseId }: { courseId: string }) {
  const t = useTranslations("booking");

  const [open, setOpen] = useState(false);
  const [calendar, setCalendar] = useState<BookingCalendar | null>(null);
  const [calState, setCalState] = useState<"idle" | "loading" | "error">(
    "idle"
  );

  const [typeId, setTypeId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<TermineSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [phase, setPhase] = useState<"pick" | "form" | "done">("pick");
  const [reservation, setReservation] = useState<TermineReserveResult | null>(
    null
  );
  const [chosenSlot, setChosenSlot] = useState<TermineSlot | null>(null);
  const [reserving, setReserving] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const activeType =
    calendar?.appointmentTypes.find((type) => type.id === typeId) ?? null;

  async function loadSlots(forTypeId: string, forDate: string) {
    setSlots(null);
    setPickError(null);
    if (!forTypeId || !forDate) return;
    setSlotsLoading(true);
    try {
      const res = await fetch(
        `/api/booking/${courseId}/slots?date=${forDate}&appointmentTypeId=${encodeURIComponent(forTypeId)}`
      );
      if (!res.ok) throw new Error("slots");
      const data = (await res.json()) as { availableSlots?: TermineSlot[] };
      setSlots(data.availableSlots ?? []);
    } catch {
      setPickError(t("loadError"));
    } finally {
      setSlotsLoading(false);
    }
  }

  async function openBooking() {
    setOpen(true);
    setPhase("pick");
    if (calendar || calState === "loading") return;
    setCalState("loading");
    try {
      const res = await fetch(`/api/booking/${courseId}/calendar`);
      if (!res.ok) throw new Error("calendar");
      const data = (await res.json()) as BookingCalendar;
      setCalendar(data);
      setCalState("idle");
      const firstType = data.appointmentTypes[0]?.id ?? null;
      const startDate = todayIso();
      setTypeId(firstType);
      setDate(startDate);
      if (firstType) void loadSlots(firstType, startDate);
    } catch {
      setCalState("error");
    }
  }

  function chooseType(id: string) {
    setTypeId(id);
    void loadSlots(id, date);
  }

  function chooseDate(value: string) {
    setDate(value);
    if (typeId) void loadSlots(typeId, value);
  }

  async function reserveSlot(slot: TermineSlot) {
    if (!calendar || !typeId || reserving) return;
    setReserving(true);
    setPickError(null);
    try {
      const res = await fetch(TERMINE_RESERVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: calendar.calendarId,
          appointmentTypeId: typeId,
          date,
          startSlot: slot.slotIndex,
        }),
      });
      const payload: unknown = await res.json().catch(() => null);
      if (res.status === 409) {
        // Slot wurde gerade vergeben → Auswahl aktualisieren
        setPickError(t("slotTaken"));
        void loadSlots(typeId, date);
        return;
      }
      const reserved = res.ok ? parseReserveResponse(payload) : null;
      if (!reserved) {
        setPickError(extractTermineError(payload) ?? t("reserveError"));
        return;
      }
      setReservation(reserved);
      setChosenSlot(slot);
      setFieldValues({});
      setMissing([]);
      setSubmitError(null);
      setPhase("form");
    } catch {
      setPickError(t("reserveError"));
    } finally {
      setReserving(false);
    }
  }

  async function submitBooking() {
    if (!reservation || submitting) return;
    const missingKeys = missingRequiredFields(reservation.fields, fieldValues);
    const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
    if (!emailOk) missingKeys.unshift("email");
    setMissing(missingKeys);
    if (missingKeys.length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(TERMINE_SUBMIT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: reservation.bookingId,
          customerEmail: email.trim(),
          customerData: fieldValues,
        }),
      });
      if (!res.ok) {
        const payload: unknown = await res.json().catch(() => null);
        setSubmitError(extractTermineError(payload) ?? t("submitError"));
        return;
      }
      setPhase("done");
    } catch {
      setSubmitError(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  function backToSlots() {
    setPhase("pick");
    setReservation(null);
    setChosenSlot(null);
    if (typeId) void loadSlots(typeId, date);
  }

  return (
    <>
      <Card>
        <strong>📅 {t("cardTitle")}</strong>
        <p>{t("cardText")}</p>
        <GhostButton
          type="button"
          onClick={openBooking}
          style={{ alignSelf: "flex-start" }}
        >
          {t("bookButton")}
        </GhostButton>
      </Card>

      <Modal
        open={open}
        title={t("modalTitle")}
        closeLabel={t("close")}
        onClose={() => setOpen(false)}
      >
        {calState === "loading" ? <Note>{t("loading")}</Note> : null}
        {calState === "error" ? (
          <ErrorNote role="alert">{t("loadError")}</ErrorNote>
        ) : null}

        {calendar && phase === "pick" ? (
          <>
            <div>
              <GroupLabel id="booking-type-label">{t("typeLabel")}</GroupLabel>
              <TypeList
                role="radiogroup"
                aria-labelledby="booking-type-label"
                style={{ marginTop: "0.5rem" }}
              >
                {calendar.appointmentTypes.map((type) => (
                  <TypeButton
                    key={type.id}
                    type="button"
                    role="radio"
                    aria-checked={type.id === typeId}
                    $active={type.id === typeId}
                    onClick={() => chooseType(type.id)}
                  >
                    <span>
                      {type.name} · {t("durationMin", { min: type.durationMin })}
                    </span>
                    {type.description ? (
                      <small>{type.description}</small>
                    ) : null}
                  </TypeButton>
                ))}
              </TypeList>
              {calendar.appointmentTypes.length === 0 ? (
                <Note>{t("noTypes")}</Note>
              ) : null}
            </div>

            <Field
              label={t("dateLabel")}
              type="date"
              min={todayIso()}
              value={date}
              onChange={(e) => chooseDate(e.target.value)}
            />

            <div>
              <GroupLabel>{t("slotsLabel")}</GroupLabel>
              <div style={{ marginTop: "0.5rem" }} aria-live="polite">
                {slotsLoading ? <Note>{t("slotsLoading")}</Note> : null}
                {!slotsLoading && slots && slots.length === 0 ? (
                  <Note>{t("slotsEmpty")}</Note>
                ) : null}
                {!slotsLoading && slots && slots.length > 0 ? (
                  <SlotGrid>
                    {slots.map((slot) => (
                      <SlotButton
                        key={slot.slotIndex}
                        type="button"
                        disabled={reserving}
                        onClick={() => reserveSlot(slot)}
                      >
                        {slot.time}
                      </SlotButton>
                    ))}
                  </SlotGrid>
                ) : null}
              </div>
            </div>

            {pickError ? <ErrorNote role="alert">{pickError}</ErrorNote> : null}
            <Note>{t("timezoneNote", { tz: calendar.timezone })}</Note>
          </>
        ) : null}

        {calendar && phase === "form" && reservation && chosenSlot ? (
          <>
            <Summary>
              {t("summary", {
                type: activeType?.name ?? "",
                date,
                time: chosenSlot.time,
              })}
            </Summary>
            <Note>{t("reservedHint")}</Note>

            <Field
              label={`${t("emailLabel")} *`}
              type="email"
              autoComplete="email"
              value={email}
              error={missing.includes("email") ? t("emailInvalid") : null}
              onChange={(e) => setEmail(e.target.value)}
            />
            {reservation.fields.map((field) => (
              <Field
                key={field.key}
                label={field.required ? `${field.label} *` : field.label}
                type={field.type === "email" ? "email" : "text"}
                value={fieldValues[field.key] ?? ""}
                error={missing.includes(field.key) ? t("fieldMissing") : null}
                onChange={(e) =>
                  setFieldValues((values) => ({
                    ...values,
                    [field.key]: e.target.value,
                  }))
                }
              />
            ))}

            {submitError ? (
              <ErrorNote role="alert">{submitError}</ErrorNote>
            ) : null}

            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <PrimaryButton
                type="button"
                disabled={submitting}
                onClick={submitBooking}
              >
                {submitting ? t("submitting") : t("submit")}
              </PrimaryButton>
              <GhostButton type="button" onClick={backToSlots}>
                {t("back")}
              </GhostButton>
            </div>
          </>
        ) : null}

        {phase === "done" ? (
          <div role="status">
            <Summary as="p">✓ {t("doneTitle")}</Summary>
            <Note style={{ marginTop: "0.75rem" }}>{t("doneText")}</Note>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
