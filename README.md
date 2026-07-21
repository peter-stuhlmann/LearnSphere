# LearnSphere – E-Learning SaaS

Eine mehrsprachige E-Learning-Plattform: Creator erstellen Kurse mit Abschnitten,
Lektionen (Video/Datei/Text) und Prüfungen – Lernende schreiben sich ein, verfolgen
ihren Fortschritt und erhalten nach bestandener Abschlussprüfung ein PDF-Zertifikat
(DE/EN, LinkedIn-tauglich).

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript
- **styled-components** (SSR-Registry, dunkles Design-System)
- **next-auth v5** – Credentials-Login, Passwort-Reset, **2FA per Authenticator-App (TOTP)**
- **next-intl** – Deutsch/Englisch (`/de`, `/en`)
- **Prisma 6 + MySQL** (lokal: XAMPP)
- **Vitest + Testing Library** – TDD, 100 % Coverage der Domain-Logik
- **motion** (Framer Motion) + **Three.js/R3F** (Landing-Hero) – mit `prefers-reduced-motion`-Fallback
- **@react-pdf/renderer** – Zertifikats-PDF

## Lokal starten

1. **MySQL starten** (XAMPP) und `.env` anlegen (siehe `.env.example`):
   ```
   DATABASE_URL="mysql://root:@localhost:3306/elearning"
   AUTH_SECRET="<node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\">"
   ```
2. **Installieren & migrieren:**
   ```bash
   npm install
   npx prisma migrate dev
   node prisma/seed.mjs   # optional: Demo-Daten
   ```
3. **Dev-Server:** `npm run dev` → http://localhost:3000

Demo-Zugänge nach dem Seed:

| Rolle   | E-Mail               | Passwort     |
| ------- | -------------------- | ------------ |
| Creator | `creator@demo.local` | `demo-Pass1` |
| Learner | `learner@demo.local` | `demo-Pass1` |

## Tests

```bash
npm test               # Unit-Tests (Vitest)
npm run test:coverage  # mit Coverage (100 %-Schwelle für src/lib)
npm run lint
```

Die Domain-Logik (Fortschrittsberechnung, Prüfungsbewertung, Zulassung,
Validierung, Tokens, TOTP, Slugs, Zertifikat-Seriennummern) wurde per TDD
entwickelt und ist zu 100 % abgedeckt. Infrastruktur-Glue (SSR-Registry,
PDF-Layout, Prisma-Client) ist über E2E-Smoke-Tests abgedeckt.

## Fachliche Regeln

- **Kurse** haben Abschnitte → Lektionen (Video, Datei, Text) und optional je
  Abschnitt eine **Zwischenprüfung**.
- **Prüfungszulassung**: Der Creator legt pro Kurs fest, wie viel Prozent
  (durationsgewichtet) gesehen sein müssen; zusätzlich müssen alle
  Zwischenprüfungen bestanden sein.
- **Abschlussprüfung** mit konfigurierbarer Bestehensgrenze; bei Bestehen wird
  ein **Zertifikat** mit fälschungssicherer Seriennummer erzeugt
  (`/api/certificates/<serial>?lang=de|en`).
- **Pläne**: Learner (kostenlos, bis 3 eigene Gratis-Kurse), Creator Pro
  (kostenpflichtige Kurse), Studio. Kauf/Abo ist aktuell als **Demo-Checkout**
  ohne Zahlungsanbieter simuliert – Stripe-Anbindung ist vorbereitet
  (Preis-Snapshot in `Enrollment.pricePaidCents`).

## Deployment (Vercel)

- `DATABASE_URL` auf eine gehostete MySQL-Instanz zeigen lassen (z. B. PlanetScale/Hostinger),
  `AUTH_SECRET` setzen, `npx prisma migrate deploy` im Build-Step.
- SMTP-Variablen setzen, damit Passwort-Reset-Mails real verschickt werden
  (ohne `SMTP_HOST` werden Mails nur in die Server-Konsole geloggt).

## Hinweise

- Die Rechtstexte (Impressum, Datenschutz, AGB) sind **Platzhalter** und müssen
  vor dem Livegang juristisch geprüft/ersetzt werden.
- Barrierefreiheit: Skip-Link, Fokus-Ringe, ARIA-Labels/Live-Regionen,
  Kontrast ≥ 4.5:1, mobile-first ab 320 px, `prefers-reduced-motion`.
