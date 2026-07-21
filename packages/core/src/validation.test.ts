import { describe, expect, it } from "vitest";
import {
  billingAddressSchema,
  couponSchema,
  courseSchema,
  loginSchema,
  passwordSchema,
  profileSchema,
  quizSchema,
  registerSchema,
  storefrontSchema,
} from "./validation";

describe("passwordSchema", () => {
  it("accepts a strong password", () => {
    expect(passwordSchema.safeParse("korrekt-9-Pferd").success).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(passwordSchema.safeParse("Ab1!x").success).toBe(false);
  });

  it("rejects passwords without a digit", () => {
    expect(passwordSchema.safeParse("nurBuchstaben").success).toBe(false);
  });

  it("rejects passwords without a letter", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "korrekt-9-Pferd",
    confirmPassword: "korrekt-9-Pferd",
  };

  it("accepts valid input", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects mismatching password confirmation", () => {
    const result = registerSchema.safeParse({
      ...valid,
      confirmPassword: "anders-9-Pferd",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("passwords_mismatch");
    }
  });

  it("rejects invalid emails", () => {
    expect(
      registerSchema.safeParse({ ...valid, email: "not-an-email" }).success
    ).toBe(false);
  });

  it("rejects a too short name", () => {
    expect(registerSchema.safeParse({ ...valid, name: "A" }).success).toBe(
      false
    );
  });

  it("normalizes the email to lowercase", () => {
    const parsed = registerSchema.parse({ ...valid, email: "ADA@Example.COM" });
    expect(parsed.email).toBe("ada@example.com");
  });
});

describe("profileSchema", () => {
  it("accepts a valid name", () => {
    expect(profileSchema.safeParse({ name: "Peter Stuhlmann" }).success).toBe(
      true
    );
  });

  it("trims the name", () => {
    expect(profileSchema.parse({ name: "  Peter  " }).name).toBe("Peter");
  });

  it("rejects a too short name", () => {
    expect(profileSchema.safeParse({ name: "P" }).success).toBe(false);
  });
});

describe("billingAddressSchema", () => {
  const valid = {
    firstName: "Peter",
    lastName: "Stuhlmann",
    street: "Musterstraße 12",
    addressExtra: "",
    zip: "10115",
    city: "Berlin",
    country: "DE",
    email: "rechnung@peter-stuhlmann.de",
  };

  it("accepts a valid address", () => {
    expect(billingAddressSchema.safeParse(valid).success).toBe(true);
  });

  it("requires first and last name", () => {
    expect(
      billingAddressSchema.safeParse({ ...valid, firstName: "" }).success
    ).toBe(false);
    expect(
      billingAddressSchema.safeParse({ ...valid, lastName: "" }).success
    ).toBe(false);
  });

  it("requires a street with house number characters", () => {
    expect(
      billingAddressSchema.safeParse({ ...valid, street: "ab" }).success
    ).toBe(false);
  });

  it("allows an optional address extra", () => {
    const parsed = billingAddressSchema.parse({
      ...valid,
      addressExtra: "Hinterhaus, 3. OG",
    });
    expect(parsed.addressExtra).toBe("Hinterhaus, 3. OG");
  });

  it("bounds the zip code length", () => {
    expect(
      billingAddressSchema.safeParse({ ...valid, zip: "12" }).success
    ).toBe(false);
    expect(
      billingAddressSchema.safeParse({ ...valid, zip: "1".repeat(11) }).success
    ).toBe(false);
  });

  it("requires a known country code", () => {
    expect(
      billingAddressSchema.safeParse({ ...valid, country: "XX" }).success
    ).toBe(false);
    expect(
      billingAddressSchema.safeParse({ ...valid, country: "AT" }).success
    ).toBe(true);
  });

  it("normalizes the billing email to lowercase", () => {
    const parsed = billingAddressSchema.parse({
      ...valid,
      email: "Rechnung@Example.COM",
    });
    expect(parsed.email).toBe("rechnung@example.com");
  });
});

describe("storefrontSchema", () => {
  const valid = {
    handle: "peter-lehrt",
    storefrontName: "Peters Akademie",
    brandColor: "#C8FF4D",
    customDomain: "",
  };

  it("accepts a valid storefront and lowercases the handle", () => {
    const parsed = storefrontSchema.parse({ ...valid, handle: "Peter-Lehrt" });
    expect(parsed.handle).toBe("peter-lehrt");
  });

  it("rejects handles with invalid characters or length", () => {
    expect(storefrontSchema.safeParse({ ...valid, handle: "ab" }).success).toBe(false);
    expect(
      storefrontSchema.safeParse({ ...valid, handle: "hat space" }).success
    ).toBe(false);
    expect(
      storefrontSchema.safeParse({ ...valid, handle: "ümlaut" }).success
    ).toBe(false);
  });

  it("rejects reserved handles", () => {
    for (const reserved of ["admin", "api", "dashboard", "learnsphere"]) {
      expect(
        storefrontSchema.safeParse({ ...valid, handle: reserved }).success
      ).toBe(false);
    }
  });

  it("validates the brand color as hex", () => {
    expect(
      storefrontSchema.safeParse({ ...valid, brandColor: "rot" }).success
    ).toBe(false);
    expect(
      storefrontSchema.safeParse({ ...valid, brandColor: "#8B7CFF" }).success
    ).toBe(true);
  });

  it("accepts a bare domain and rejects URLs", () => {
    expect(
      storefrontSchema.safeParse({ ...valid, customDomain: "kurse.peter.de" })
        .success
    ).toBe(true);
    expect(
      storefrontSchema.safeParse({
        ...valid,
        customDomain: "https://kurse.peter.de",
      }).success
    ).toBe(false);
  });
});

describe("courseSchema category and tags", () => {
  const base = {
    title: "Testkurs",
    subtitle: "",
    description: "",
    language: "de",
    priceCents: 0,
    requiredWatchPercent: 80,
    finalExamRequired: true,
    listedInShop: true,
  };

  it("accepts a known category and normalizes tags", () => {
    const parsed = courseSchema.parse({
      ...base,
      category: "programming",
      tags: ["React Hooks", "react-hooks", "  Vue "],
    });
    expect(parsed.category).toBe("programming");
    expect(parsed.tags).toEqual(["react-hooks", "vue"]);
  });

  it("treats empty category as none", () => {
    const parsed = courseSchema.parse({ ...base, category: "" });
    expect(parsed.category).toBeNull();
  });

  it("rejects unknown categories", () => {
    expect(
      courseSchema.safeParse({ ...base, category: "hacking" }).success
    ).toBe(false);
  });

  it("defaults to no category and no tags", () => {
    const parsed = courseSchema.parse(base);
    expect(parsed.category).toBeNull();
    expect(parsed.tags).toEqual([]);
  });

  it("price is either free or at least 4.99 euros", () => {
    expect(courseSchema.safeParse({ ...base, priceCents: 0 }).success).toBe(
      true
    );
    expect(courseSchema.safeParse({ ...base, priceCents: 499 }).success).toBe(
      true
    );
    expect(courseSchema.safeParse({ ...base, priceCents: 498 }).success).toBe(
      false
    );
    expect(courseSchema.safeParse({ ...base, priceCents: 100 }).success).toBe(
      false
    );
  });

  it("accepts extra languages and translations, defaulting to none", () => {
    const parsed = courseSchema.parse(base);
    expect(parsed.extraLanguages).toEqual([]);
    expect(parsed.translations).toEqual({});

    const translated = courseSchema.parse({
      ...base,
      language: "de",
      extraLanguages: ["en"],
      translations: { en: { title: "English", subtitle: "", description: "" } },
    });
    expect(translated.extraLanguages).toEqual(["en"]);
    expect(translated.translations.en?.title).toBe("English");
  });

  it("drops the base language and orphaned translations", () => {
    const parsed = courseSchema.parse({
      ...base,
      language: "de",
      // Basissprache in extraLanguages + Übersetzung ohne aktivierte Sprache
      extraLanguages: ["de", "en", "en"],
      translations: {
        de: { title: "sollte wegfallen" },
        en: { title: "bleibt" },
      },
    });
    expect(parsed.extraLanguages).toEqual(["en"]);
    expect(parsed.translations).toEqual({
      en: { title: "bleibt", subtitle: "", description: "" },
    });
  });

  it("rejects unsupported translation languages", () => {
    expect(
      courseSchema.safeParse({ ...base, extraLanguages: ["fr"] }).success
    ).toBe(false);
    expect(
      courseSchema.safeParse({
        ...base,
        translations: { fr: { title: "Non" } },
      }).success
    ).toBe(false);
  });

  it("free courses are always listed in the shop", () => {
    const free = courseSchema.parse({
      ...base,
      priceCents: 0,
      listedInShop: false,
    });
    expect(free.listedInShop).toBe(true);

    const paid = courseSchema.parse({
      ...base,
      priceCents: 999,
      listedInShop: false,
    });
    expect(paid.listedInShop).toBe(false);
  });

  it("accepts an uploaded cover path and treats empty as none", () => {
    expect(
      courseSchema.parse({ ...base, coverImage: "/uploads/u1/cover.jpg" })
        .coverImage
    ).toBe("/uploads/u1/cover.jpg");
    expect(courseSchema.parse({ ...base, coverImage: "" }).coverImage).toBeNull();
    expect(courseSchema.parse(base).coverImage).toBeNull();
  });

  it("rejects cover images outside the upload folder", () => {
    expect(
      courseSchema.safeParse({ ...base, coverImage: "https://evil.example/x.jpg" })
        .success
    ).toBe(false);
    expect(
      courseSchema.safeParse({ ...base, coverImage: "javascript:alert(1)" })
        .success
    ).toBe(false);
  });

  it("stores the booking checkbox and defaults it to off", () => {
    expect(courseSchema.parse(base).bookingEnabled).toBe(false);
    expect(
      courseSchema.parse({ ...base, bookingEnabled: true }).bookingEnabled
    ).toBe(true);
    // Verbindungsdaten kommen nur über den Connect-Flow, nicht übers Formular
    expect(
      courseSchema.safeParse({ ...base, bookingEnabled: "yes" }).success
    ).toBe(false);
  });
});

describe("quizSchema free-text and shuffle", () => {
  const base = {
    title: "Abschlussprüfung",
    passPercent: 70,
    maxAttempts: null,
    attemptWindowHours: null,
    retakeAfterPass: true,
    questions: [
      {
        text: "Wie heißt der Hobbit?",
        kind: "FREE_TEXT",
        options: [],
        expectedAnswer: "Bilbo",
        aiGraded: false,
      },
    ],
  };

  it("accepts a free-text question with expected answer", () => {
    const parsed = quizSchema.parse(base);
    expect(parsed.questions[0].kind).toBe("FREE_TEXT");
    expect(parsed.questions[0].expectedAnswer).toBe("Bilbo");
    expect(parsed.shuffleQuestions).toBe(false);
    expect(parsed.shuffleAnswers).toBe(false);
  });

  it("ignoriert (leere) Antwortoptionen bei Freitext-Fragen", () => {
    // Der Editor behält beim Umschalten auf Freitext die leeren Options-
    // Entwürfe – die dürfen die Validierung nicht scheitern lassen
    const parsed = quizSchema.parse({
      ...base,
      questions: [
        {
          ...base.questions[0],
          options: [
            { text: "", isCorrect: true },
            { text: "", isCorrect: false },
          ],
        },
      ],
    });
    expect(parsed.questions[0].options).toEqual([]);
  });

  it("rejects a free-text question without expected answer", () => {
    const invalid = {
      ...base,
      questions: [{ ...base.questions[0], expectedAnswer: "" }],
    };
    expect(quizSchema.safeParse(invalid).success).toBe(false);
  });

  it("free-text questions need no options", () => {
    expect(quizSchema.safeParse(base).success).toBe(true);
  });

  it("choice questions still need two options and one correct", () => {
    const invalid = {
      ...base,
      questions: [
        {
          text: "Frage",
          kind: "SINGLE",
          options: [{ text: "A", isCorrect: false }],
          expectedAnswer: null,
          aiGraded: false,
        },
      ],
    };
    expect(quizSchema.safeParse(invalid).success).toBe(false);
  });

  it("time limit defaults to none and accepts sane minutes", () => {
    expect(quizSchema.parse(base).timeLimitMinutes).toBeNull();
    expect(
      quizSchema.parse({ ...base, timeLimitMinutes: 30 }).timeLimitMinutes
    ).toBe(30);
    expect(
      quizSchema.safeParse({ ...base, timeLimitMinutes: 0 }).success
    ).toBe(false);
    expect(
      quizSchema.safeParse({ ...base, timeLimitMinutes: 481 }).success
    ).toBe(false);
  });

  it("accepts shuffle flags", () => {
    const parsed = quizSchema.parse({
      ...base,
      shuffleQuestions: true,
      shuffleAnswers: true,
    });
    expect(parsed.shuffleQuestions).toBe(true);
    expect(parsed.shuffleAnswers).toBe(true);
  });

  it("Punkte je Frage: Standard 1, Bereich 1–100, nur ganze Zahlen", () => {
    expect(quizSchema.parse(base).questions[0].points).toBe(1);
    const withPoints = quizSchema.parse({
      ...base,
      questions: [{ ...base.questions[0], points: 5 }],
    });
    expect(withPoints.questions[0].points).toBe(5);
    for (const points of [0, -1, 101, 1.5]) {
      expect(
        quizSchema.safeParse({
          ...base,
          questions: [{ ...base.questions[0], points }],
        }).success
      ).toBe(false);
    }
  });
});

describe("couponSchema", () => {
  const valid = {
    code: "sommer-25",
    kind: "PERCENT",
    value: 25,
    maxRedemptions: null,
    validFrom: null,
    validUntil: null,
    courseIds: ["course-1"],
  };

  it("accepts and normalizes a valid coupon", () => {
    const parsed = couponSchema.parse(valid);
    expect(parsed.code).toBe("SOMMER-25");
    expect(parsed.maxRedemptions).toBe(null);
    expect(parsed.courseIds).toEqual(["course-1"]);
  });

  it("requires at least one course", () => {
    expect(
      couponSchema.safeParse({ ...valid, courseIds: [] }).success
    ).toBe(false);
  });

  it("deduplicates selected courses", () => {
    const parsed = couponSchema.parse({
      ...valid,
      courseIds: ["course-1", "course-1", "course-2"],
    });
    expect(parsed.courseIds).toEqual(["course-1", "course-2"]);
  });

  it("rejects codes with invalid characters", () => {
    expect(
      couponSchema.safeParse({ ...valid, code: "so mm er!" }).success
    ).toBe(false);
  });

  it("rejects percent values above 100", () => {
    expect(
      couponSchema.safeParse({ ...valid, value: 101 }).success
    ).toBe(false);
  });

  it("allows cent values above 100 for amount coupons", () => {
    expect(
      couponSchema.safeParse({ ...valid, kind: "AMOUNT_OFF", value: 500 })
        .success
    ).toBe(true);
  });

  it("accepts a validity window with dates", () => {
    const parsed = couponSchema.parse({
      ...valid,
      validFrom: new Date("2026-07-01"),
      validUntil: new Date("2026-08-01"),
    });
    expect(parsed.validFrom).toBeInstanceOf(Date);
  });

  it("rejects windows where until is before from", () => {
    expect(
      couponSchema.safeParse({
        ...valid,
        validFrom: new Date("2026-08-01"),
        validUntil: new Date("2026-07-01"),
      }).success
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts credentials and lowercases the email", () => {
    const parsed = loginSchema.parse({
      email: "Ada@Example.com",
      password: "x",
    });
    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.totp).toBeUndefined();
  });

  it("accepts an optional totp token", () => {
    const parsed = loginSchema.parse({
      email: "ada@example.com",
      password: "x",
      totp: "123456",
    });
    expect(parsed.totp).toBe("123456");
  });

  it('treats "undefined", empty and whitespace totp as absent', () => {
    // Auth.js serialisiert fehlende Felder als String "undefined"
    const base = { email: "ada@example.com", password: "x" };
    expect(loginSchema.parse({ ...base, totp: "undefined" }).totp).toBeUndefined();
    expect(loginSchema.parse({ ...base, totp: "" }).totp).toBeUndefined();
    expect(loginSchema.parse({ ...base, totp: "   " }).totp).toBeUndefined();
    expect(loginSchema.parse({ ...base, totp: " 123456 " }).totp).toBe("123456");
  });

  it("rejects an empty password", () => {
    expect(
      loginSchema.safeParse({ email: "ada@example.com", password: "" }).success
    ).toBe(false);
  });
});

describe("courseSchema", () => {
  const valid = {
    title: "React für Einsteiger",
    subtitle: "",
    description: "",
    language: "de",
    priceCents: 0,
    requiredWatchPercent: 80,
    finalExamRequired: true,
  };

  it("accepts a valid course", () => {
    expect(courseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a too short title", () => {
    expect(courseSchema.safeParse({ ...valid, title: "ab" }).success).toBe(
      false
    );
  });

  it("rejects negative prices", () => {
    expect(
      courseSchema.safeParse({ ...valid, priceCents: -100 }).success
    ).toBe(false);
  });

  it("rejects non-integer prices", () => {
    expect(
      courseSchema.safeParse({ ...valid, priceCents: 9.99 }).success
    ).toBe(false);
  });

  it("bounds requiredWatchPercent to 0..100", () => {
    expect(
      courseSchema.safeParse({ ...valid, requiredWatchPercent: 101 }).success
    ).toBe(false);
    expect(
      courseSchema.safeParse({ ...valid, requiredWatchPercent: 0 }).success
    ).toBe(true);
  });

  it("rejects unsupported languages", () => {
    expect(
      courseSchema.safeParse({ ...valid, language: "fr" }).success
    ).toBe(false);
  });
});

describe("quizSchema", () => {
  const valid = {
    title: "Abschlussprüfung",
    passPercent: 70,
    questions: [
      {
        text: "Was ist React?",
        kind: "SINGLE",
        options: [
          { text: "Eine Bibliothek", isCorrect: true },
          { text: "Ein Gemüse", isCorrect: false },
        ],
      },
    ],
  };

  it("accepts a valid quiz", () => {
    expect(quizSchema.safeParse(valid).success).toBe(true);
  });

  it("requires at least one question", () => {
    expect(quizSchema.safeParse({ ...valid, questions: [] }).success).toBe(
      false
    );
  });

  it("requires at least one correct option per question", () => {
    const invalid = {
      ...valid,
      questions: [
        {
          text: "Frage?",
          kind: "SINGLE",
          options: [
            { text: "A", isCorrect: false },
            { text: "B", isCorrect: false },
          ],
        },
      ],
    };
    expect(quizSchema.safeParse(invalid).success).toBe(false);
  });

  it("defaults to unlimited attempts with retakes allowed", () => {
    const parsed = quizSchema.parse(valid);
    expect(parsed.maxAttempts).toBe(null);
    expect(parsed.attemptWindowHours).toBe(null);
    expect(parsed.retakeAfterPass).toBe(true);
  });

  it("accepts an attempt policy", () => {
    const parsed = quizSchema.parse({
      ...valid,
      maxAttempts: 3,
      attemptWindowHours: 24,
      retakeAfterPass: false,
    });
    expect(parsed.maxAttempts).toBe(3);
    expect(parsed.attemptWindowHours).toBe(24);
    expect(parsed.retakeAfterPass).toBe(false);
  });

  it("rejects zero attempts", () => {
    expect(
      quizSchema.safeParse({ ...valid, maxAttempts: 0 }).success
    ).toBe(false);
  });

  it("requires at least two options per question", () => {
    const invalid = {
      ...valid,
      questions: [
        {
          text: "Frage?",
          kind: "SINGLE",
          options: [{ text: "A", isCorrect: true }],
        },
      ],
    };
    expect(quizSchema.safeParse(invalid).success).toBe(false);
  });
});
