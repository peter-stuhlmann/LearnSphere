import { describe, expect, it, vi } from "vitest";
import {
  SLOTS_PER_DAY,
  TERMINE_BASE_URL,
  TERMINE_RESERVE_URL,
  TERMINE_SUBMIT_URL,
  buildCalendarUrl,
  buildSlotsUrl,
  extractTermineError,
  isBookingConfigured,
  isValidBookingDate,
  missingRequiredFields,
  parseCalendarResponse,
  parseReserveResponse,
  parseSlotsResponse,
  slotIndexToTime,
} from "./termine";

describe("TERMINE_BASE_URL", () => {
  it("fällt ohne Override auf https://termine.lol zurück", () => {
    expect(TERMINE_BASE_URL).toBe("https://termine.lol");
  });

  it("lässt sich per NEXT_PUBLIC_TERMINE_BASE_URL übersteuern (ohne End-Slash)", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_TERMINE_BASE_URL = "http://localhost:3000/";
    try {
      const mod = await import("./termine");
      expect(mod.TERMINE_BASE_URL).toBe("http://localhost:3000");
      expect(mod.TERMINE_RESERVE_URL).toBe(
        "http://localhost:3000/api/public/bookings/reserve"
      );
    } finally {
      delete process.env.NEXT_PUBLIC_TERMINE_BASE_URL;
      vi.resetModules();
    }
  });
});

describe("parseCalendarResponse", () => {
  const calendar = {
    id: "cal-1",
    title: "Sprechstunde",
    timezone: "Europe/Berlin",
    appointmentTypes: [
      {
        id: "type-1",
        name: "Einzelcoaching",
        description: "30 Minuten 1:1",
        durationMin: 30,
        mode: "online",
        memberIds: ["m1"],
      },
    ],
  };

  it("liest eine Kalender-Antwort mit data-Hülle", () => {
    const parsed = parseCalendarResponse({ data: calendar });
    expect(parsed?.title).toBe("Sprechstunde");
    expect(parsed?.appointmentTypes[0].durationMin).toBe(30);
  });

  it("liest eine Kalender-Antwort ohne Hülle", () => {
    expect(parseCalendarResponse(calendar)?.id).toBe("cal-1");
  });

  it("füllt optionale Felder mit Defaults", () => {
    const parsed = parseCalendarResponse({
      id: "cal-2",
      title: "Q&A",
      appointmentTypes: [
        { id: "t", name: "Frage", durationMin: 15 },
      ],
    });
    expect(parsed?.timezone).toBe("Europe/Berlin");
    expect(parsed?.appointmentTypes[0].description).toBe("");
    expect(parsed?.appointmentTypes[0].mode).toBe("");
    expect(parsed?.appointmentTypes[0].memberIds).toEqual([]);
  });

  it("gibt null bei kaputter Antwort zurück", () => {
    expect(parseCalendarResponse({ data: { id: "x" } })).toBeNull();
    expect(parseCalendarResponse(null)).toBeNull();
    expect(parseCalendarResponse("html")).toBeNull();
  });
});

describe("parseSlotsResponse", () => {
  it("liest freie Slots", () => {
    const parsed = parseSlotsResponse({
      data: {
        date: "2026-08-03",
        availableSlots: [
          { slotIndex: 36, time: "09:00" },
          { slotIndex: 37, time: "09:15" },
        ],
        byPerson: [],
      },
    });
    expect(parsed?.date).toBe("2026-08-03");
    expect(parsed?.availableSlots).toHaveLength(2);
    expect(parsed?.availableSlots[0]).toEqual({ slotIndex: 36, time: "09:00" });
  });

  it("verkraftet fehlende Slot-Liste", () => {
    expect(
      parseSlotsResponse({ date: "2026-08-03" })?.availableSlots
    ).toEqual([]);
  });

  it("gibt null bei ungültigen Slots zurück", () => {
    expect(
      parseSlotsResponse({
        date: "2026-08-03",
        availableSlots: [{ slotIndex: 200, time: "50:00" }],
      })
    ).toBeNull();
    expect(parseSlotsResponse(undefined)).toBeNull();
  });
});

describe("parseReserveResponse", () => {
  it("liest Buchungs-Hold mit dynamischen Feldern", () => {
    const parsed = parseReserveResponse({
      bookingId: "b-1",
      reservationExpiresAt: "2026-08-03T09:10:00.000Z",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "phone", label: "Telefon" },
      ],
    });
    expect(parsed?.bookingId).toBe("b-1");
    expect(parsed?.fields[0].required).toBe(true);
    expect(parsed?.fields[1]).toEqual({
      key: "phone",
      label: "Telefon",
      type: "text",
      required: false,
    });
  });

  it("verkraftet fehlende Feldliste und data-Hülle", () => {
    const parsed = parseReserveResponse({
      data: { bookingId: "b-2", reservationExpiresAt: "2026-08-03T09:10:00Z" },
    });
    expect(parsed?.fields).toEqual([]);
  });

  it("gibt null ohne bookingId zurück", () => {
    expect(parseReserveResponse({ reservationExpiresAt: "x" })).toBeNull();
  });
});

describe("extractTermineError", () => {
  it("liest error-Strings", () => {
    expect(extractTermineError({ error: "Slot bereits belegt" })).toBe(
      "Slot bereits belegt"
    );
    expect(extractTermineError({ error: "  x  " })).toBe("x");
  });

  it("gibt null ohne brauchbare Meldung zurück", () => {
    expect(extractTermineError({ error: "" })).toBeNull();
    expect(extractTermineError({ error: 42 })).toBeNull();
    expect(extractTermineError({})).toBeNull();
    expect(extractTermineError(null)).toBeNull();
    expect(extractTermineError("nope")).toBeNull();
  });
});

describe("isBookingConfigured", () => {
  it("true nur mit Checkbox UND Kalender-ID UND Key", () => {
    expect(
      isBookingConfigured({
        bookingEnabled: true,
        bookingCalendarId: "c",
        bookingApiKey: "k",
      })
    ).toBe(true);
    // Checkbox aus → verbunden zählt nicht
    expect(
      isBookingConfigured({
        bookingEnabled: false,
        bookingCalendarId: "c",
        bookingApiKey: "k",
      })
    ).toBe(false);
    expect(
      isBookingConfigured({
        bookingEnabled: true,
        bookingCalendarId: "c",
        bookingApiKey: null,
      })
    ).toBe(false);
    expect(
      isBookingConfigured({
        bookingEnabled: true,
        bookingCalendarId: null,
        bookingApiKey: "k",
      })
    ).toBe(false);
    expect(
      isBookingConfigured({
        bookingEnabled: true,
        bookingCalendarId: "  ",
        bookingApiKey: "k",
      })
    ).toBe(false);
  });
});

describe("isValidBookingDate", () => {
  it("akzeptiert reale Kalendertage", () => {
    expect(isValidBookingDate("2026-08-03")).toBe(true);
    expect(isValidBookingDate("2028-02-29")).toBe(true);
  });

  it("lehnt Format- und Kalenderfehler ab", () => {
    expect(isValidBookingDate("03.08.2026")).toBe(false);
    expect(isValidBookingDate("2026-8-3")).toBe(false);
    expect(isValidBookingDate("2026-02-30")).toBe(false);
    expect(isValidBookingDate("2026-13-01")).toBe(false);
    expect(isValidBookingDate("")).toBe(false);
  });
});

describe("slotIndexToTime", () => {
  it("übersetzt das Viertelstunden-Raster", () => {
    expect(slotIndexToTime(0)).toBe("00:00");
    expect(slotIndexToTime(36)).toBe("09:00");
    expect(slotIndexToTime(37)).toBe("09:15");
    expect(slotIndexToTime(95)).toBe("23:45");
  });

  it("klemmt Ausreißer ins gültige Raster", () => {
    expect(slotIndexToTime(-5)).toBe("00:00");
    expect(slotIndexToTime(SLOTS_PER_DAY + 10)).toBe("23:45");
    expect(slotIndexToTime(36.9)).toBe("09:00");
  });
});

describe("URL-Helfer", () => {
  it("baut Kalender- und Slots-URLs mit Encoding", () => {
    expect(buildCalendarUrl("cal 1")).toBe(
      `${TERMINE_BASE_URL}/api/embed/calendars/cal%201`
    );
    expect(buildSlotsUrl("cal-1", "2026-08-03", "type/9")).toBe(
      `${TERMINE_BASE_URL}/api/embed/calendars/cal-1/slots?date=2026-08-03&appointmentTypeId=type%2F9`
    );
  });

  it("öffentliche Buchungs-Endpunkte zeigen auf termine.lol", () => {
    expect(TERMINE_RESERVE_URL).toBe(
      `${TERMINE_BASE_URL}/api/public/bookings/reserve`
    );
    expect(TERMINE_SUBMIT_URL).toBe(
      `${TERMINE_BASE_URL}/api/public/bookings/submit`
    );
  });
});

describe("missingRequiredFields", () => {
  const fields = [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "phone", label: "Telefon", type: "text", required: false },
    { key: "company", label: "Firma", type: "text", required: true },
  ];

  it("meldet leere Pflichtfelder", () => {
    expect(
      missingRequiredFields(fields, { name: "  ", phone: "123" })
    ).toEqual(["name", "company"]);
  });

  it("ist leer, wenn alles ausgefüllt ist", () => {
    expect(
      missingRequiredFields(fields, { name: "Ada", company: "ACME" })
    ).toEqual([]);
  });
});
