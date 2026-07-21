# Umsetzungs-Protokoll

Chronologische Liste aller Umbauten – je Eintrag kurz: **was** gemacht wurde und **warum**.

---

## 2026-07-06 · Grundgerüst

**Projekt-Setup (Next.js 16, styled-components, Prisma/MySQL, Vitest)**
- Moderne Basis mit TypeScript, TDD-Infrastruktur und lokaler XAMPP-Datenbank aufgesetzt.
- 100 %-Coverage-Schwelle für die Geschäftslogik erzwungen, damit Qualität messbar bleibt.

**Auth: Registrierung, Login, Passwort-Reset, 2FA per Authenticator-App**
- next-auth mit eigenem Login-Flow inkl. TOTP-Zweitfaktor – Kontosicherheit von Anfang an.
- Passwort-Reset-Links per E-Mail (im Dev-Modus in der Konsole), Tokens nur als Hash gespeichert.

**Mehrsprachigkeit Deutsch/Englisch (next-intl)**
- Alle Seiten unter `/de` und `/en`, Sprachumschalter im Header.

**Design-System „Night Observatory" + Landingpage**
- Dunkles Design mit Lime-Akzent, Fraunces-Serif und Three.js-Konstellation im Hero.
- Barrierefrei: Skip-Link, Fokusringe, `prefers-reduced-motion`, mobile-first ab 320 px.

**Rechtsseiten: Preise, Impressum, Datenschutz, AGB, Barrierefreiheit**
- Pflichtseiten in beiden Sprachen; Rechtstexte als gekennzeichnete Platzhalter.

**Kursverwaltung, Lernansicht, Prüfungen, PDF-Zertifikat**
- Kurse → Abschnitte → Lektionen, Zwischen- und Abschlussprüfungen mit Bestehensgrenze.
- Prüfungszulassung ab einstellbarem Sehanteil; Zertifikat als PDF (DE/EN) mit Seriennummer.

## 2026-07-07 · Feinarbeit

**Wiederholungsregeln für Prüfungen**
- Creator steuern pro Prüfung: max. Versuche, Zeitfenster, Wiederholung nach Bestehen.
- Serverseitig doppelt geprüft, damit niemand das Limit im Browser umgehen kann.

**Vorschau-Lektionen**
- Einzelne Lektionen sind ohne Kauf ansehbar – klassisches „Reinschnuppern".
- Nicht freigegebene Inhalte werden gar nicht erst an den Browser gesendet (kein Leak).

**Gutscheincodes**
- Prozent-Rabatt, Euro-Rabatt oder Festpreis; mit Limit, Zeitraum und Einlöse-Zähler.
- Einlösung läuft in einer DB-Transaktion, damit Limits auch bei Parallelkäufen halten.

**Live-Vorschau im Kurs-Editor**
- Beim Tippen sieht der Creator sofort, wie Lernende die Kursseite sehen (600 ms gedrosselt).

**Profilseite + Creator-Studio-Trennung**
- Profilbild-Upload, Name, vollständige Rechnungsadresse.
- Creator-Bereich optisch getrennt: violettes „Studio"-Branding, eigene Navigation, Umschalter.

**YouTube-Videos + Custom-Audio-Player**
- YouTube-Links werden erkannt und mit Fortschritts-Tracking abgespielt (IFrame-API).
- Eigener Audio-Player mit Equalizer-Animation, Lautstärkeregler und Geschwindigkeit (0,75×–2×).
- Nebenbei Bug gefixt: Profilbild hätte den Session-Cookie gesprengt (Avatar aus JWT entfernt).

**Lektions-Blöcke (Audio, Video, Bild, Datei, Text, HTML+CSS)**
- Jede Lektion besteht jetzt aus beliebig vielen Inhaltsblöcken statt genau einem Inhalt.
- Uploads mit strenger Typ-/Größenprüfung; HTML-Blöcke laufen in einer Script-freien Sandbox.

**Rich-Text-Editor (TipTap) mit Bubble-Menü**
- Kursbeschreibung und Text-Blöcke formatierbar; Menü erscheint schwebend über der Auswahl.
- Alles wird beim Speichern serverseitig sanitisiert (Allowlist) – kein XSS über Kursinhalte.

**Statistik-Dashboards + Bewertungssystem**
- Creator: Verkäufe/Einnahmen als Zeitreihe (filterbar 7 T–Gesamt), 3D-Einnahmen-Skyline, Bewertungsverteilung.
- Lernende: Lernzeit, Ø-Prüfungsergebnis (bester Versuch zählt), Gesamtfortschritt, Zertifikate.
- Chart-Farben mit dem Palette-Validator geprüft (Violett als Serienfarbe, Lime nur Akzent).

## 2026-07-07 · Vertrieb & Härtung

**Sicherheits-Header für alle Seiten**
- `X-Frame-Options`, `nosniff`, Referrer- und Permissions-Policy gegen Clickjacking & Co.
- Ausnahme: `/embed/*` darf absichtlich überall eingebettet werden (`frame-ancestors *`).

**Rate-Limiting auf Login, Registrierung und Passwort-Reset**
- Bremst Brute-Force (10 Login-Versuche/10 min) und Mail-Bombing (3 Reset-Mails/h) aus.
- Als getestete In-Memory-Lösung; bei Skalierung auf mehrere Server später Redis.

**Shop-Sichtbarkeit pro Kurs**
- Neue Checkbox „Im LearnSphere-Shop anzeigen" (Standard: an) im Kurs-Editor.
- So kann ein Kurs exklusiv über eigene Kanäle laufen, ohne im Katalog zu erscheinen.

**Creator-Storefront unter `/c/<handle>`**
- Öffentliche Kursseite je Creator mit eigenem Namen, Avatar und Akzentfarbe.
- Zeigt alle veröffentlichten Kurse – auch die, die nicht im Shop gelistet sind.

**Whitelabel: eigene Domain**
- Creator hinterlegen eine Domain (z. B. kurse.meine-seite.de, per CNAME auf die Instanz).
- Der Server erkennt die Domain am Host-Header und zeigt direkt die Storefront.

**Embed-Widget (iframe)**
- Fertiger iframe-Schnipsel pro Kurs zum Kopieren: Kurskarte mit Preis, Bewertung und Kauf-Link.
- Bewusst schlank und eigenständig gebaut, damit es auf fremden Seiten schnell lädt.

**Öffentliche API v1 mit API-Schlüsseln**
- `GET /api/v1/courses` und `/api/v1/courses/<slug>` liefern die eigenen Kurse als JSON (CORS offen).
- Schlüssel werden nur als Hash gespeichert und nur einmal im Klartext angezeigt; max. 5 aktive, widerrufbar.

**Studio-Seite „Vertrieb"**
- Ein Ort für alles: Storefront-Einstellungen, API-Schlüssel-Verwaltung, Embed-Codes mit Copy-Button.

**Branded 404-Seite**
- Statt Standard-Fehlerseite eine gestaltete Seite mit Rückweg zur Startseite.

## 2026-07-07 · Vercel-Deployment

**Produktion auf Vercel: https://e-learning-sepia-xi.vercel.app**
- Build läuft durch, Env-Variablen (AUTH_SECRET, App-URL) sind gesetzt.
- Noch offen: `DATABASE_URL` ist ein Platzhalter – die Seite zeigt 500, bis eine gehostete MySQL eingetragen ist (lokale XAMPP-DB ist aus dem Internet nicht erreichbar).

**Bekannte Vercel-Einschränkungen (dokumentiert, nicht blockierend)**
- Datei-Uploads (`public/uploads`) sind auf Vercel flüchtig → für Videos/Dateien dort später Blob-Storage; Avatare sind davon nicht betroffen (liegen in der DB).
- Passwort-Reset-Mails brauchen SMTP-Zugangsdaten in den Env-Variablen.

## 2026-07-07 · Stripe-Zahlungen

**Kurskauf über Stripe Checkout**
- Bezahlte Kurse laufen über die Stripe-Bezahlseite; der Preis (inkl. eigener Gutscheine) wird ausschließlich serverseitig berechnet.
- Freischaltung doppelt abgesichert: Webhook UND Verifikation bei Rückkehr – beides idempotent, egal wer zuerst kommt.

**Creator-Abos (Pro 19 €/Monat, Studio 79 €/Monat)**
- Abo-Checkout und Stripe-Billing-Portal (Rechnungen, Zahlungsmittel, Kündigung) in den Einstellungen.
- Webhook hält den Plan synchron: Kündigung/Zahlungsausfall stuft automatisch zurück.

**Sicherheits-Guard + Demo-Fallback**
- Mit aktivem Stripe kann niemand mehr die Demo-Einschreibung für Bezahlkurse aufrufen (Checkout-Umgehung ausgeschlossen).
- Ohne Stripe-Keys läuft lokal weiter der Demo-Checkout – Entwicklung braucht kein Stripe-Konto.

**Noch offen für den Livegang mit Zahlungen**
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in die Env-Variablen; Webhook-Endpoint `/api/webhooks/stripe` im Stripe-Dashboard eintragen.

## 2026-07-07 · Stripe Connect (Creator-Auszahlungen)

**Kostenlose Connect-Konfiguration gewählt**
- Creator verbinden ein eigenes Stripe-Konto (volles Dashboard, Stripe trägt das Zahlungsrisiko) – für die Plattform fallen keine Connect-Gebühren an.
- Passt zur Preisseite: 0 % Provision, die Plattform verdient am Creator-Abo.

**Onboarding & Status auf der Vertriebs-Seite**
- „Mit Stripe verbinden“ startet das offizielle Stripe-Onboarding; Status-Badge zeigt Nicht verbunden / Onboarding offen / Aktiv.
- Der Webhook (`account.updated`) schaltet den Verkaufsstatus automatisch frei, ein Refresh-Button geht zusätzlich manuell.

**Zahlungen als Direct Charges**
- Hat der Creator ein aktives Konto, geht der Kurskauf als Direct Charge direkt auf sein Stripe-Konto (Geld fließt nie über die Plattform).
- Ohne verbundenes Konto läuft der Kauf wie bisher über das Plattform-Konto – nahtloser Fallback.
- Wichtig fürs Stripe-Dashboard: den Webhook-Endpoint auch für „Events von verbundenen Konten“ registrieren.

## 2026-07-08 · Neues Preismodell: Umsatzbeteiligung statt Abo

**Abos komplett entfernt**
- Keine monatlichen Kosten mehr für Creator; Kurs-Limits und „Pro erforderlich“-Sperren sind weg.
- Abo-Tabelle, Abo-Checkout, Billing-Portal und Abo-Karte in den Einstellungen wurden ausgebaut.

**Umsatzbeteiligung pro Verkauf (per TDD)**
- Creator erhalten 80 % bei Verkauf über LearnSphere und 60 % bei Verkauf über Drittseiten (Widget/API); der Rest geht an LearnSphere.
- Jeder Verkauf speichert Kanal und Creator-Anteil in Cent – Anteil + Plattform-Gebühr ergeben immer exakt den Kaufpreis.

**Kanal-Erkennung**
- Embed-Widget und API-Links hängen automatisch `?via=embed` bzw. `?via=api` an; der Checkout übernimmt den Kanal fälschungssicher serverseitig.
- Bei Stripe-Connect-Verkäufen behält LearnSphere den Anteil direkt als Application Fee ein (20 % bzw. 40 %).

**Preisseite, AGB und Statistiken angepasst**
- Preisseite zeigt jetzt drei Karten: Lernende 0 € / LearnSphere-Verkauf 80 % / eigene Kanäle 60 %, samt neuer FAQ.
- „Einnahmen“ in den Creator-Statistiken bedeuten jetzt den eigenen Anteil (Altbestand automatisch auf 80 % umgerechnet).

## 2026-07-08 · Politur

**Sticky Footer**
- Der Footer bleibt jetzt auch bei kurzen Seiten (Login, leere Listen) am unteren Bildschirmrand.
- Gelöst über das globale Layout (Flex-Spalte), gilt automatisch für alle Seiten.

**Dashboard und „Meine Kurse“ getrennt**
- /creator ist jetzt das reine Dashboard (Begrüßung, KPI-Zeile mit Zeitraum-Filter, „Neuer Kurs“); die Kursliste hat eine eigene Seite /creator/kurse.
- „Meine Kurse“ bietet Filterleiste (Suche, Status Veröffentlicht/Entwurf) und einstellbare Pagination (6/12/24/48 pro Seite) – alles serverseitig über URL-Parameter, damit Ansichten teilbar bleiben.

**Umsatzbeteiligung gedreht: 60 % LearnSphere / 80 % eigene Kanäle**
- Der Split ist jetzt andersherum: 60 % Creator-Anteil bei Verkäufen über LearnSphere, 80 % über eigene Kanäle (Widget/API) – das macht den API-Plan attraktiver.
- Überall konsistent nachgezogen: Berechnung (inkl. Stripe Application Fee), Plan-Karten (80 % steht jetzt in der API-Card), FAQ, Vertriebs-Seite, AGB, Startseite. Bestehende Verkäufe behalten ihren historischen Anteil.
- „Beliebt“-Badge auf der Preisseite gefixt: deckender Hintergrund mit Blur, die Kartenkante schimmert nicht mehr durch.

**Eine Preisseite statt zwei**
- /preise ist jetzt die einzige Preisseite und richtet sich nur an Creator (Starter 0 € / API 25 bzw. 20 €/Monat / Self-hosted); /fuer-creator leitet dorthin um.
- Lernende brauchen keine Preisseite – sie zahlen pro Kurs, der Preis steht direkt am Kurs. Die FAQ erklärt das jetzt explizit.

**Creator-Beschreibung (Rich-Text)**
- Neues TipTap-Feld im Profil: Creator stellen sich mit formatierter Beschreibung vor (serverseitig sanitisiert).
- Erscheint als „Über den Creator“-Box auf jeder Kursseite (mit Avatar und Storefront-Link) und oben auf der Storefront.

**Creator-Preisseite mit API-Plan**
- Neue Seite /fuer-creator bzw. /for-creators: Starter 0 € (alles Bisherige), API-Plan 25 €/Monat (20 €/Monat bei jährlicher Zahlung, Toggle auf der Karte), Self-hosted auf Anfrage.
- Der API-Zugriff ist jetzt kostenpflichtig: Endpoints antworten ohne aktiven Plan mit 403, Key-Erstellung ist gesperrt, die Vertriebs-Seite zeigt einen Upsell statt des Formulars.
- Abo läuft über Stripe (Checkout, Webhook-Sync bei Kündigung/Zahlungsausfall, Billing-Portal); ohne Stripe-Keys aktiviert der Demo-Modus den Plan direkt fürs lokale Testen.

**Prüfungs-Bearbeitung ohne Datenverlust**
- Prüfungen werden beim Speichern jetzt aktualisiert statt gelöscht und neu angelegt – alle Prüfungsversuche, „Bestanden“-Status und Versuchszähler bleiben erhalten.
- Vorher setzte jede Korrektur (selbst ein Tippfehler) die Ergebnisse aller Lernenden zurück und entzog Prüfungszulassungen.
- Bewusst so belassen: Neue Lektionen senken den Sehanteil aller Lernenden – neuer Stoff gehört zum Kurs; Zertifikate sind davon nie betroffen.

**Käuferschutz beim Kurs-Lebenszyklus**
- Kurse mit Teilnahmen können nicht mehr gelöscht werden (Käufer würden Zugang, Fortschritt und Zertifikate verlieren; Guthaben/Statistiken würden verfälscht) – der Editor bietet stattdessen „Auf Entwurf setzen“.
- Entwurf-Kurse bleiben für Eingeschriebene und den Creator voll nutzbar (Detailseite, Lernansicht, Prüfungen, Zertifikate); nur Neukäufe und die Katalog-Sichtbarkeit sind gestoppt.

**Profil getrennt: Rechnungsadresse (User) vs. Auszahlungen (Creator)**
- Das Profil behält Name, Bild (gilt für beide Rollen) und die Rechnungsadresse für Kurskäufe; Auszahlungen leben im Studio unter Vertrieb.
- Neue Auszahlungs-Karte: Bankverbindung (IBAN mit echter Mod-97-Prüfung), auszahlbares Guthaben und „Auszahlung anfordern“ ab 10 € – serverseitig geprüft, nur ein offener Antrag gleichzeitig.
- Guthaben = Creator-Anteile der Plattform-Verkäufe minus bisherige Auszahlungen; Stripe-Connect-Verkäufe zählen nicht (die zahlt Stripe direkt aus).

**KPI-Zeile im Creator-Dashboard**
- Die vier Kern-Kennzahlen (Verkäufe, Einnahmen, Ø-Bewertung, Abschlussquote) samt Zeitraum-Filter stehen jetzt auch direkt im Dashboard über „Neuer Kurs“.
- Als wiederverwendbare Komponente gebaut – Dashboard und Statistikseite teilen sich denselben Code und dieselbe Berechnung.

**Lokalisierte URLs je Sprache**
- Deutsche Seiten haben deutsche Pfade (/de/kurse, /de/mein-lernen, /de/preise, /de/anmelden …), englische englische – gut für Nutzer und SEO.
- Links werden zentral übersetzt (typisiert, der Compiler erzwingt Korrektheit); alte/unübersetzte URLs leiten automatisch samt Query-Parametern auf die richtige Form um, der Sprachumschalter übersetzt auch die URL.

**Routen-Struktur: Creator-Bereich unter /creator**
- Öffentliche und Lernenden-Seiten bleiben direkt im Root, der Creator-Bereich liegt jetzt unter /creator/… (statt /dashboard).
- Alte /dashboard-Links leiten dauerhaft weiter; das Logo führt Eingeloggte zu ihrem Bereich (Studio → /creator, sonst → Mein Lernen), nur Gäste zur Startseite.

**Header aufgeräumt: Avatar-Menü + Vertrieb-Submenü**
- Einstellungen und Abmelden liegen jetzt im Avatar-Dropdown (mit Profil); die Top-Navigation ist dadurch kürzer.
- Das Avatar-Menü erkennt live (auch beim Fenster-Verkleinern), ob rechts genug Platz ist, und öffnet sonst nach links; im Studio bündelt „Vertrieb“ als Submenü Übersicht und Statistiken.

**Neue Startseite mit Lernenden-Fokus**
- Die Startseite spricht jetzt primär Lernende an: Lern-Hero, echte Kurs-Highlights aus der Datenbank, „So lernst du hier“-Schritte.
- Creator werden sekundär über ein violettes Band am Seitenende angesprochen; die alte Creator-Startseite bleibt als Komponente erhalten (z. B. für eine spätere /for-creators-Seite).


**Kurskatalog mit Live-Suche und Pagination**
- Die öffentliche Kurse-Seite filtert und blättert jetzt serverseitig (Suche über Titel/Untertitel, wählbare Seitengröße, Parameter in der URL) – so bleibt sie auch bei vielen Kursen schnell und Ergebnisse sind teilbar.
- Suche läuft wie bei „Meine Kurse" gedrosselt beim Tippen (kein Such-Button), Trefferzahl steht unter der Filterbox; die Pagination ist als gemeinsame Komponente ausgelagert, damit beide Seiten identisch aussehen und sich gleich verhalten.

**Verdienst-Vorschau unterm Preisfeld im Kurs-Editor**
- Unter dem Preisfeld steht jetzt live, was der Creator pro Verkauf verdient – als Euro-Betrag für beide Kanäle (60 % über LearnSphere, 80 % über eigene Kanäle), berechnet mit derselben Formel wie die echte Abrechnung.
- So sieht man beim Festlegen des Preises sofort, was am Ende ankommt; bei 0 € (kostenlos) wird der Hinweis ausgeblendet.

**Verdienst-Vorschau kompakter gestaltet**
- Statt eines langen Satzes zeigt der Hinweis unterm Preisfeld jetzt zwei knappe Zeilen: Kanal links, Betrag rechtsbündig in Mono-Schrift – schneller erfassbar und passt besser in die schmale Einstellungs-Spalte.

**Eigener Date/Time-Picker statt nativem Datumsfeld**
- Neue wiederverwendbare Picker-Komponente: ein Umschalter zeigt den Leer-Zustand als eigene Option (dynamisch, z. B. „Sofort" bei „Gültig ab" und „Unbegrenzt" bei „Gültig bis"), daneben öffnet ein Klick einen hübschen Kalender mit Monatsnavigation, Uhrzeit-Feld und „Jetzt"-Schnellwahl.
- Voll barrierefrei (Tastatur-Navigation im Kalender mit Pfeiltasten, Escape schließt, ARIA-Labels) und überall im Einsatz, wo Datumsfelder vorkommen – aktuell die Gutschein-Gültigkeit; die Datumslogik ist als getestete Helfer ausgelagert (100 % Abdeckung).

**Uhrzeit-Wahl im Date/Time-Picker verschönert**
- Das native Uhrzeit-Feld ist durch zwei elegante Stunden/Minuten-Stepper ersetzt: große Mono-Ziffern mit ▲/▼-Pfeilen, Mausrad-Unterstützung und Überlauf (23 → 00) – passend zum Kalender-Look.
- Bedienbar auch per Tastatur (Pfeiltasten, Home/End, direkte Zifferneingabe) und als ARIA-Spinbuttons für Screenreader ausgezeichnet.

**Gutscheine gelten jetzt für mehrere Kurse**
- Beim Anlegen wählt man per Checkliste „Einlösbar für", für welche der eigenen Bezahlkurse der Code gilt (aktueller Kurs vorausgewählt); das Einlöselimit zählt über alle Kurse gemeinsam und die Gutschein-Zeile zeigt an, für wie viele Kurse ein Code gilt.
- Dafür wurde das Datenmodell umgebaut (Gutschein hängt am Creator, Kurs-Zuordnung in eigener Tabelle, Codes je Creator eindeutig) – bestehende Gutscheine wurden automatisch migriert, alle Einlöse-Pfade (Kursseite, Demo-Kauf, Stripe-Checkout, Webhook) prüfen jetzt gegen die Kursliste des Gutscheins.

**Kurs-Auswahl beim Gutschein neu gestaltet**
- Die native Checkbox-Liste ist durch auswählbare Karten-Zeilen ersetzt: Klick auf die ganze Zeile wählt den Kurs, ausgewählte Kurse bekommen einen Lime-Rahmen mit gefülltem Häkchen-Punkt, der Preis steht rechtsbündig in Mono-Schrift.
- Passt damit optisch zu den übrigen Eingabefeldern (gleiche Radien, Farben, Fokus-Ringe) und bleibt barrierefrei über echte Buttons mit aria-pressed.

**Öffentliche Katalog-API + API-Dokumentation**
- Neue kostenlose öffentliche API (/api/public/v1/courses) ohne Key: liefert nur die im LearnSphere-Shop gelisteten Kurse mit rein öffentlichen Metadaten, mit Suche/Pagination, Rate-Limit (60/min je IP), offenem CORS und Cache-Headern.
- Neue Doku-Seite /api-doku (DE/EN, im Footer verlinkt) erklärt leicht verständlich alle drei API-Ebenen – öffentlich (kostenlos), Affiliate (in Vorbereitung), Creator-API (im API-Paket, Bearer-Key) – inkl. Beispielen, Fehlercodes und Sicherheitshinweisen (Keys nur serverseitig, Hash-Speicherung, Plan-Prüfung je Request).

**Prüfungen feiner einstellbar: Mischen, Freitext mit KI, Slider, Confirm-Dialog**
- Creator können jetzt Fragen- und Antwort-Reihenfolge mischen lassen (wird pro Aufruf serverseitig neu gemischt) und Freitext-Fragen stellen: wahlweise muss die Antwort exakt der Musterlösung entsprechen oder eine KI bewertet sinngemäß (fällt bei KI-Ausfall sicher auf den exakten Vergleich zurück, Antworten sind serverseitig auf 2000 Zeichen begrenzt).
- Max. Versuche (1–5 plus ∞) und Zeitfenster sind jetzt hübsche Step-Slider mit klickbaren Stufen statt leerer Zahlenfelder; Frage, Antwortoption und Prüfung werden nur noch über einen eigenen Bestätigungsdialog gelöscht (statt Browser-confirm).

**API-Versionierung ausdrücklich festgeschrieben**
- Alle APIs tragen die Version im Pfad (v1) – das war von Anfang an so; die Doku erklärt jetzt explizit die Regel: innerhalb einer Version nur additive Änderungen, Breaking Changes nur unter neuer Version (v2) mit Übergangsfrist.

**Eigenes Select-Dropdown überall im Einsatz**
- Neue wiederverwendbare Select-Komponente im Combobox/Listbox-Pattern: animiertes Popover mit Häkchen bei der aktiven Option, voll tastaturbedienbar (Pfeile, Home/End, Enter, Escape, Type-ahead per Buchstaben) und screenreader-tauglich.
- Ersetzt alle sieben nativen Browser-Selects (Status-Filter, Seitengröße, Kurssprache, Gutschein-Art, Fragetyp, Blocktyp, Rechnungsland) – gleiche Optik wie die übrigen Eingabefelder, wahlweise als Pill- oder Inline-Variante.

**Guthaben zeigt 0,00 € statt „Kostenlos"**
- Geldbeträge (auszahlbares Guthaben, Umsätze in den Statistiken) nutzen jetzt eine eigene Formatierung, die 0 als „0,00 €" ausgibt – das „Kostenlos"-Label bleibt Kurspreisen vorbehalten.

**Abschnittstitel per Doppelklick umbenennen**
- Im Kurs-Editor wird der Abschnittstitel durch Doppelklick direkt an Ort und Stelle editierbar (Enter/Blur speichert, Escape bricht ab) – der Stift-Button und das Browser-Prompt-Fenster sind weg.
- Barrierefrei gelöst: Der Titel ist fokussierbar (role=button mit sprechendem Label), Enter/Leertaste/F2 starten die Bearbeitung ohne Maus, nach dem Speichern springt der Fokus zurück auf den Titel; ein Tooltip erklärt die Bedienung.

**SKILL.md für KI-Agents + llms.txt**
- Unter /skills/learnsphere-api/SKILL.md gibt es jetzt eine fertige Agent-Skill: Sie beschreibt beide APIs (Endpunkte, Auth, Fehlercodes, Response-Formate) samt fest verankerter Sicherheitsregeln (API-Key nie im Browser, Preise als Cent, unbekannte Felder ignorieren) – Coding-Agents wie Claude Code bauen die Integration damit korrekt statt geraten.
- Die API-Doku hat einen neuen Abschnitt „Integration mit KI-Agents" mit Download-Button und Anleitung (.claude/skills/…); zusätzlich liegt eine /llms.txt im Root, die LLM-Crawlern Plattform, Doku und Skill bekannt macht.

**LearnSphere Affiliate-Programm (15 % Provision)**
- Neue Landingpage /partnerprogramm (im Footer verlinkt): Hero, 3-Schritte-Erklärung, Preisaufteilung als Balken (Creator 60 % / Partner 15 % / LearnSphere 25 %), Bedingungen und Beitritt mit Pflicht-Checkbox über den bestehenden Account; nach dem Beitritt zeigt die Seite den persönlichen Link mit Kopieren-Button und Live-Statistiken (Verkäufe, Provision, Guthaben).
- Attribution über zwei Wege: (1) Affiliate-Link ?aff=CODE setzt ein httpOnly-Cookie für 7 Tage (letzter Klick gewinnt, jeder Kurskauf im Fenster zählt); (2) Affiliate-API /api/v1/affiliate/courses liefert den Katalog mit Provisions-Links – nur mit ausdrücklichem Parameter affiliate=true, sonst neutrale Links. Für die Affiliate-API reicht die Programm-Mitgliedschaft (kein API-Paket nötig).
- Sicherheit serverseitig erzwungen: Provision nur für Programm-Mitglieder, kein Selbstkauf, keine eigenen Kurse, keine Gratis-Kurse; Cookie-Codes werden validiert, beim Stripe-Webhook wird alles erneut geprüft. Die Provision landet als Guthaben (bei Creators im selben Topf wie Verkaufserlöse), ist ab 10 € auszahlbar und wird beim Kurskauf automatisch eingesetzt (voll gedeckte Käufe laufen ganz ohne Zahlungsanbieter).

**Domain auf learnsphere.one umgestellt**
- Alle Platzhalter-Domains (learnsphere.example) in Doku-Beispielen, SKILL.md, Impressum, Datenschutz, Barrierefreiheit, Zertifikaten und Kontakt-Mailadressen durch learnsphere.one ersetzt.

**30-Tage-Sperrfrist für Erlöse („In Prüfung")**
- Creator-Anteile und Affiliate-Provisionen sind nicht mehr sofort verfügbar: Sie zählen erst 30 Tage nach dem Kauf ins auszahlbare Guthaben – solange läuft das Rückgaberecht der Käufer:innen.
- Der Vertriebsbereich zeigt beides getrennt: „Auszahlbares Guthaben" (freigegeben, lime) und „In Prüfung" (violett) mit Erklärung; auch der Guthaben-Einsatz beim Kurskauf nutzt nur freigegebene Beträge. Die Affiliate-Bedingungen nennen die Frist jetzt ausdrücklich.

**Affiliate-Partnerschaft kündbar + Landingpage verschlankt**
- Auf der Partnerprogramm-Seite gibt es jetzt „Partnerschaft beenden" mit Bestätigungsdialog: Links und Affiliate-API verlieren sofort ihre Provisionswirkung (API antwortet mit 403), verdiente Provisionen bleiben erhalten; bei Wiederbeitritt wird derselbe Code reaktiviert, alte Links gelten wieder.
- Die Sektion „So teilt sich der Kaufpreis" wurde entfernt – die interne Aufteilung geht Besucher nichts an.

**Kurs-Kategorien und Tags**
- 21 von LearnSphere vorgegebene Kategorien (Programmierung, Design, Marketing, Sprachen, …) liegen als leicht editierbares Array in src/lib/categories.ts; ein Kurs hat genau eine Kategorie (im Editor per Dropdown wählbar), dazu bis zu 10 freie Tags über eine Chip-Eingabe (Enter/Komma fügt hinzu, serverseitig normalisiert).
- Die Kursübersicht filtert per anklickbaren Kategorie-Chips (mehrere gleichzeitig, in der URL teilbar), die Suchleiste findet jetzt auch Tags, und die Kurskarten zeigen Kategorie-Badge und #Tags; die öffentliche API liefert beide Felder mit (additiv, v1-kompatibel).

**Kategorie-Filter zeigt nur belegte Kategorien**
- Die Kursübersicht bietet nur noch Kategorien als Filter-Chips an, zu denen es mindestens einen veröffentlichten, im Shop gelisteten Kurs gibt – leere Kategorien erzeugen keine Null-Treffer-Klicks mehr.
- Ein bereits aktiver Filter bleibt auch dann sichtbar und abwählbar, wenn seine Kategorie (z. B. per geteilter URL) gerade keine Kurse hat.

**Kursbild (Cover) für Karten und Kursseite**
- Im Kurs-Editor lässt sich ein Kursbild hochladen (JPG/PNG/WebP/GIF, max. 5 MB, über die bestehende Upload-Infrastruktur) – mit 16:9-Vorschau, Ersetzen und Entfernen; gespeichert wird nur ein Pfad aus dem eigenen Upload-Ordner (fremde URLs lehnt der Server ab).
- Das Bild erscheint oben auf den Kurskarten der Übersicht und als Hero auf der Kursseite. Veröffentlichen ist ohne Kursbild serverseitig blockiert (verständliche Fehlermeldung im Editor), Speichern als Entwurf geht weiterhin ohne.

**Kursbild-Zuschnitt: Ausschnitt verschieben und skalieren**
- Nach der Bildauswahl öffnet sich ein Zuschneide-Dialog: Der Ausschnitt lässt sich frei verschieben und über die Ecke skalieren, behält aber immer das Zielverhältnis; der Bereich außerhalb wird abgedunkelt. Exportiert wird exakt 992 × 558 Pixel (Canvas, JPEG) – erst dieser Zuschnitt wird hochgeladen.
- Barrierefrei auch ohne Maus: Pfeiltasten verschieben den Ausschnitt, Shift+Pfeiltasten ändern die Größe, Escape bricht ab; die Crop-Mathematik (Zentrierung, Grenzen, Mindestgröße) ist als reine, getestete Lib ausgelagert.

**Zuschneide-Dialog: Hochformat begrenzt, Text lesbar**
- Hochformat-Bilder werden im Dialog jetzt auf max. 55 % der Fensterhöhe (bzw. 480 px) gedeckelt und zentriert – der Dialog sprengt den Bildschirm nicht mehr.
- Der Abdunkel-Effekt des Ausschnitts lief zuvor über den gesamten Dialog und legte sich über Titel, Hinweis und Buttons; er ist jetzt aufs Bild begrenzt, dazu ist der Hinweistext etwas größer – alles bleibt im Zuschnittsmodus gut lesbar.

**Zuschneide-Dialog: Live-Warnung bei zu kleinem Ausschnitt**
- Unter dem Bild zeigt eine Live-Anzeige die aktuelle Ausschnittsgröße in Pixeln; fällt sie unter 992 × 558, wird sie rot mit klarer Ansage („Ausschnitt vergrößern" bzw. „bitte ein größeres Bild hochladen", wenn das Bild selbst zu klein ist) und der Übernehmen-Button ist blockiert.
- Die Anzeige aktualisiert sich während des Ziehens/Skalierens und ist per aria-live auch für Screenreader hörbar – unscharfe, hochskalierte Kursbilder sind damit ausgeschlossen.

**Preisfeld neu: Kostenlos/Bezahlt-Umschalter mit Mindestpreis 4,99 €**
- Statt des nüchternen Zahlenfelds mit Klammerhinweis gibt es einen Pill-Umschalter „Kostenlos / Bezahlt"; erst bei „Bezahlt" erscheint das Verkaufspreis-Feld (startet bei 4,99 €) samt Verdienst-Vorschau.
- Mindestpreis 4,99 € wird dreifach abgesichert: Hinweis unterm Feld, sanftes Anheben beim Verlassen des Felds und serverseitige Validierung (Preis ist 0 oder ≥ 499 Cent) mit verständlicher Fehlermeldung.

**Partnerprogramm als eigener Bereich**
- Neben Lernbereich (lime) und Creator-Studio (violett) gibt es jetzt den Partnerbereich mit eigener Farbe (Cyan): eigenes „Partner"-Badge neben dem Logo, cyan getönte Kopfleiste, passend gefärbter Avatar-Ring und eigene Navigation (Übersicht, API-Doku, Wechsel zum Lernbereich); Klick aufs Logo führt im Partnerbereich zur Partner-Übersicht.
- Erreichbar für alle über das Avatar-Menü (neuer Eintrag „Partnerprogramm") und weiterhin über den Footer; die Statistiken und Akzente auf der Partnerseite nutzen jetzt ebenfalls die Partnerfarbe.

**Defaultpreis 29,99 €**
- Beim Umschalten auf „Bezahlt" startet der Verkaufspreis jetzt mit 29,99 € als Vorschlag; der Mindestpreis bleibt 4,99 €.

**Kursbild in Cards hart auf 16:9 fixiert**
- Das Bild in den Kurskarten (und im Hero der Kursseite) erzwingt jetzt per aspect-ratio direkt am img-Element das 16:9-Format – auch wenn eine Bilddatei (z. B. aus Altbestand oder per API angelegt) nicht exakt 992×558 hat, wird sie zugeschnitten dargestellt statt das Layout zu verzerren.

**Kaputte Sonderzeichen im Dashboard gefixt (4,3 â˜… → 4,3 ★)**
- Ein früherer automatischer Datei-Edit hatte in zwei Statistik-Komponenten UTF-8-Sonderzeichen zerschossen (Stern, Gedankenstrich, Mal-Zeichen); alle Stellen sind korrigiert und der Rest des Projekts wurde auf weitere Encoding-Schäden geprüft (keine gefunden).

**Roadmap-Seite mit animierter Timeline**
- Neue Seite /roadmap (DE/EN, im Footer verlinkt) mit acht Vorhaben in drei Stufen (In Arbeit, Als Nächstes, Geplant) samt Quartalsangaben: API-Checkout & Kursinhalte, KI-Lernassistent, Mobile Apps, Live-Sessions, Team-Lizenzen, Kurs-Community, automatische Untertitel, öffentliche Zertifikats-Verifikation.
- Dargestellt als Zickzack-Timeline: Eine Leuchtlinie wächst mit dem Scrollen (Spring-Animation), die Karten gleiten beim Erscheinen versetzt herein, „In Arbeit"-Punkte pulsieren; auf Mobil wird die Timeline einspaltig und prefers-reduced-motion wird respektiert.

**Negativ-Guthaben gefixt**
- Die nachträglich eingeführte 30-Tage-Sperrfrist konnte das angezeigte Guthaben ins Minus drehen: Bereits getätigte Auszahlungen/Guthaben-Käufe wurden voll abgezogen, während die Erlöse, die sie gedeckt hatten, wieder als „in Prüfung" galten.
- Die Guthaben-Rechnung ist jetzt buchhalterisch konsistent: Verfügbar + In Prüfung ergeben immer exakt den tatsächlich geschuldeten Betrag (alle Erlöse minus Ausgegebenes), beide Werte sind nie negativ – Überzogenes reduziert automatisch den „In Prüfung"-Topf statt ein Minus anzuzeigen.

**Review-Text zur Kursbewertung**
- Nach dem Klick auf die Sterne (die weiterhin sofort speichern) klappt darunter animiert ein optionales Textfeld für ein Review auf – mit eigenem Speichern-Button, der nur bei Änderungen aktiv ist, und Gespeichert-Feedback.
- Sterne und Text sind jederzeit änderbar (Text ist beim nächsten Besuch vorbefüllt, Leeren entfernt das Review); der Text wird serverseitig nur mit bestehender Bewertung akzeptiert, getrimmt und auf 2000 Zeichen begrenzt.

**Optionales Zeitlimit für Prüfungen mit Live-Countdown**
- Creator können je Prüfung (Abschluss- und Zwischenprüfung) ein Zeitlimit per Step-Slider einstellen (5–120 Minuten oder „Ohne Zeitlimit", Standard: ohne); die Uhr startet beim Öffnen der Prüfung, überlebt Seiten-Reloads und wird serverseitig durchgesetzt – zu späte Abgaben (30 s Kulanz) werden nicht gewertet.
- Während der Prüfung zeigt ein klebendes Countdown-Badge die Restzeit live (Mono-Ziffern, unter einer Minute rot pulsierend, als role="timer" ausgezeichnet); bei Ablauf werden die aktuellen Antworten automatisch abgegeben.

**Zeitlimit-Stufe 180 min + Fragen/Antworten sortierbar**
- Der Zeitlimit-Slider hat jetzt zusätzlich die Stufe 180 Minuten.
- Im Prüfungs-Editor lassen sich Fragen und Antwortoptionen per ↑/↓-Pfeilen umsortieren (wie bei Abschnitten/Lektionen, mit sprechenden Labels und deaktivierten Randpfeilen); die Reihenfolge wird beim Speichern übernommen und gilt für Lernende – sofern der Creator nicht ohnehin „mischen" aktiviert hat.

**Performance- und Cleancode-Durchgang**
- Größter Hebel Seitengewicht: Profilbilder werden jetzt clientseitig auf 256×256 verkleinert, bevor sie als Data-URL gespeichert werden (vorher bis 2 MB Original im Header-HTML JEDER Seite); der Server deckelt die gespeicherte Größe zusätzlich auf 256 KB.
- Datenbank: Bewertungs-Schnitt/-Anzahl laufen überall über EIN Aggregat statt alle Review-Zeilen zu laden (Landing, Storefront, Embed, alle drei API-Listen + Detail, via gemeinsamem Helfer); Kurs-Listen laden per select keine description/MediumText-Spalten mehr; die Kursseite lädt Block-Inhalte nur noch für Vorschau-Lektionen statt für alle; unabhängige Queries laufen parallel (Katalog, Kursseite inkl. Stripe-Verifikation, Lernseite); die Affiliate-API hat Pagination statt unbegrenzter Liste.
- Bundle: Der TipTap-Editor wird erst geladen, wenn ein Editor wirklich mountet (dynamic import mit Skeleton) statt im Initial-Bundle der Creator-Seiten; Kartenbilder bekommen decoding="async". Alle Animationen (3D-Hero, Framer-Motion) bleiben unverändert – die 3D-Canvases waren bereits korrekt lazy geladen.

**Transkripte für Video & Audio (auto + übersetzt)**
- Jeder Video-/Audio-Block kann Transkripte in Deutsch und Englisch tragen: hochgeladene Dateien werden per Klick automatisch transkribiert (Whisper, erkennt die Sprache selbst; braucht OPENAI_API_KEY), die jeweils andere Sprache erzeugt ein Übersetzen-Button via Claude – beides landet in editierbaren Textfeldern und wird mit der Lektion gespeichert.
- Für externe Quellen (YouTube & Co.) gibt es keine Automatik (keine Mediendatei verfügbar), aber manuelles Einfügen; Lernende sehen unter dem Player ein auf-/zuklappbares „Transkript anzeigen" in ihrer Sprache (Fallback auf die andere) – auch in Vorschau-Lektionen auf der Kursseite.
- Sicherheit: Die Transkriptions-Action akzeptiert nur Pfade aus dem eigenen Upload-Ordner (kein Traversal, max. 25 MB), Übersetzungen behandeln den Text als reine Daten (Prompt-Injection-Schutz wie bei der KI-Bewertung).

**Gutscheinfeld hinter Aufklapp-Link**
- Das Gutscheincode-Feld im Kaufkasten ist jetzt standardmäßig zu: Ein dezenter Link „Ich habe einen Gutscheincode" klappt es weich animiert auf und zu (Chevron dreht mit, aria-expanded für Screenreader, Feld erhält beim Öffnen den Fokus) – der Kaufkasten wirkt dadurch aufgeräumter.

**Transkription auch für große Dateien**
- Das 25-MB-Whisper-Limit gilt nicht mehr für die Datei, sondern nur noch pro Anfrage: Ist ffmpeg auf dem Server installiert, wird das Audio automatisch extrahiert (mono, 16 kHz) und in 20-Minuten-Segmente geschnitten – damit funktionieren Videos bis zum Upload-Limit (200 MB) und bis ca. 4 Stunden Länge; die Segment-Texte werden zusammengefügt.
- Ohne ffmpeg werden große Audiodateien byte-weise gestückelt (funktioniert bei MP3/OGG, an Schnittstellen kann ein Wort verloren gehen); nur große Videos ohne ffmpeg bekommen eine klare Meldung mit beiden Auswegen (ffmpeg installieren oder Tonspur als Audio hochladen).

**ffmpeg wird mitgeliefert – große Videos transkribieren ohne Einrichtung**
- Das Paket ffmpeg-static bringt das ffmpeg-Binary als npm-Abhängigkeit mit: Die Audio-Extraktion/Segmentierung für Videos über 25 MB funktioniert damit sofort auf jedem Rechner, ohne dass jemand ffmpeg installieren muss (System-ffmpeg wird weiterhin als Fallback erkannt).
- Die Extraktions-Pipeline wurde mit dem gebündelten Binary end-to-end verifiziert (Testvideo erzeugt, exakt mit den Produktions-Argumenten in Audio-Segmente geschnitten).

**Transkription: Bundling-Bug gefixt (ffmpeg-static)**
- Ursache des „Transkription fehlgeschlagen": Turbopack hat das ffmpeg-static-Paket mitgebündelt, wodurch der Pfad zum Binary ins Leere zeigte; ffmpeg-static steht jetzt in serverExternalPackages und liefert wieder einen echten Dateipfad.
- Mit einer echten hochgeladenen .mov-Datei (26 MB, über dem Whisper-Limit) end-to-end im Next-Runtime verifiziert: Audio wird extrahiert, transkribiert und korrekt als Deutsch erkannt; Fehler werden jetzt zusätzlich serverseitig protokolliert.

**Transkripte als Rich-Text mit Sprach-Tabs**
- Die Transkriptfelder im Editor sind jetzt TipTap-Editoren mit Bubble-Menü (fett, Überschriften, Listen …) statt einfacher Textareas; Deutsch/Englisch liegen in einem barrierefreien Tab-Menü (role=tablist, Pfeiltasten wechseln, ✓ markiert befüllte Sprachen) – es ist immer nur eine Sprache sichtbar.
- Automatik-Ergebnisse (Whisper) werden in saubere HTML-Absätze konvertiert und der passende Tab öffnet sich; die Übersetzung erhält jetzt die HTML-Struktur. Transkripte werden serverseitig wie Text-Blöcke sanitisiert, Lernende sehen sie formatiert gerendert; Plain-Text-Altbestand wird automatisch konvertiert.

**Transkription läuft jetzt vollautomatisch nach dem Upload**
- Die Buttons „Automatisch transkribieren" und „→ EN/DE übersetzen" sind entfernt: Direkt nach dem Hochladen eines Videos/Audios startet automatisch die Transkription und anschließend die Übersetzung in die jeweils andere Sprache; der Transkript-Bereich klappt auf, zeigt den Live-Status (Transkribiert …/Übersetzt …) und springt auf den Tab der erkannten Sprache.
- Der Speichern-Button der Lektion ist während der Verarbeitung kurz gesperrt (mit Hinweis), damit keine halbfertigen Transkripte verloren gehen; die Zuordnung läuft über die Datei-URL und übersteht damit auch Umsortieren der Blöcke. Fehler (z. B. fehlender API-Key) erscheinen als verständliche Meldung, manuelle Bearbeitung über die Tabs bleibt jederzeit möglich.

**Übersetzungs-Timeout gefixt + Retry-Button**
- Ursache des „Übersetzung fehlgeschlagen": Bei langen Transkripten reichte das 60-Sekunden-Timeout des Übersetzungs-Aufrufs nicht (Key/Modell/API funktionieren nachweislich); Timeout jetzt 240 s, Output-Limit auf 32k Tokens erhöht (sonst würden lange Übersetzungen abgeschnitten), Fehler werden serverseitig protokolliert.
- Schlägt Transkription oder Übersetzung dennoch fehl, erscheint neben der Fehlermeldung ein „↻ Erneut versuchen"-Button: Er setzt intelligent an der fehlgeschlagenen Stufe an (fehlt alles → komplette Pipeline, fehlt nur eine Sprache → nur die Übersetzung nachholen).

- **Übersetzungs-Fehler endgültig gefixt (leere Modell-Variable):** Die Server-Logs zeigten die echte Ursache – `AI_TRANSLATE_MODEL=""` in der .env wurde per `??` nicht auf den Default zurückgesetzt, die API bekam ein leeres Modell (400). Jetzt fällt eine leere Variable per `||` auf `claude-haiku-4-5-20251001` zurück (auch bei der KI-Bewertung), damit optionale Env-Einträge leer bleiben dürfen.

- **Transkriptfeld standardmäßig zugeklappt:** Das Transkript im Lektions-Editor klappt nicht mehr automatisch auf (auch nicht während Transkription/Übersetzung), sondern nur noch per Klick – mit sanfter Auf-/Zuklapp-Animation (Grid-Transition, respektiert prefers-reduced-motion). Status, Fehler und Retry-Button bleiben auch zugeklappt sichtbar; der TipTap-Editor lädt erst beim ersten Öffnen (Performance).

- **Transkript-Status ohne Layout-Sprung:** Die Meldungen „Wird transkribiert…“/„Wird übersetzt…“ und die Fehlerzeile mit Retry-Button klappen jetzt sanft auf und zu (Grid-Transition + Fade, prefers-reduced-motion beachtet), statt beim Verschwinden das Layout springen zu lassen. Funktioniert dadurch auch ab 320 px sauber, der Text bleibt während der Zuklapp-Animation erhalten.

- **Warnung bei ungespeicherten Änderungen:** Neuer globaler Guard (kleiner Store in src/lib/unsaved.ts + UnsavedChangesGuard im Layout): Solange Kurs-Einstellungen, Lektions- oder Prüfungs-Editor ungespeicherte Änderungen haben (oder eine Transkription läuft), fragt ein hübscher Bestätigungsdialog vor jedem internen Link nach; Tab schließen/Neuladen/externe Links fängt der native Browser-Dialog ab. Auch der Sprachwechsel im Header fragt nach, da er die Seite remountet.

- **Transkription: Format-Falle behoben:** Whisper lehnte eine Datei ab, deren Endung (.mp4) nicht zum echten Inhalt (M4A-Audio) passte – der API-Fehler wurde zudem still verschluckt. Jetzt extrahiert ffmpeg bei JEDER Datei zuerst das Audio als MP3 (normalisiert Container/Codec, teilt lange Dateien), und Whisper-Fehler werden serverseitig geloggt. Verifiziert mit der betroffenen 31-Minuten-Datei (2 Chunks, beide erfolgreich).

- **Karaoke-Transkript im Player:** Whisper liefert Timestamps (verbose_json) – die werden jetzt als Cues [{start, end, de, en}] am Block gespeichert (neue JSON-Spalte transcriptCues), segmentweise übersetzt (Batches à 100 mit Retry, Fallback Originalsprache) und im Lernbereich als Karaoke-Ansicht gezeigt: Der gesprochene Satz leuchtet beim Abspielen auf (Verlaufs-Highlight), Gesprochenes wird gedimmt, das Transkript scrollt im eigenen Bereich mit (nie die Seite), und Klick auf einen Satz springt im Video/Audio dorthin. Bestehender Testblock („Anni“) wurde mit echten Cues (552 Segmente DE+EN) befüllt.

- **Gemeinsame Kurs-Karte für Katalog + Storefront:** Die Creator-Storefront („Kurse von …“) hatte eine eigene, ältere Karten-Kopie ohne Cover-Bild. Beide Ansichten nutzen jetzt eine gemeinsame CourseCard-Komponente (16:9-Cover, Badges, Tags, Bewertung, Einblende-Animation, optionale Brand-Farbe der Storefront) – weniger doppelter Code, und die Storefront zeigt Bilder, Kategorie und Tags.

- **Bild-Platzhalter für Kurse ohne Cover:** Kurse ohne Cover (z. B. Entwürfe/Altbestand) zeigen in den Kurs-Karten und auf der Detailseite jetzt eine dezente 16:9-Platzhalter-SVG (Bild-Glyphe mit Lime-Violett-Verlauf auf weichem Glow) statt gar nichts – Karten bleiben dadurch optisch einheitlich hoch.

- **Sprecher-Erkennung (Diarization) für Transkripte:** Neue Uploads laufen jetzt bevorzugt über OpenAIs gpt-4o-transcribe-diarize – das Transkript wird pro Redebeitrag als „Person 1: …“/„Person 2: …“ formatiert, die Karaoke-Ansicht zeigt farbige Sprecher-Labels bei jedem Wechsel, und Klick-zum-Springen bleibt erhalten. Technik: 10-min-Chunks (Modell-Limits), Sprecher bleiben über Chunk-Grenzen konsistent per known_speakers-Referenz-Schnipseln aus dem ersten Chunk; bei nur einem Sprecher entfallen Labels automatisch; schlägt das Modell fehl, greift der Whisper-Fallback ohne Sprecher. Das hochgeladene Gespräch wurde mit echten Daten befüllt (495 Segmente, 3 Sprecher, 213 Wechsel, DE+EN).

- **Eigener Video-Player + YouTube-Consent + Untertitel:** Der Standard-Browser-Player wurde durch einen eigenen Player im LearnSphere-Look ersetzt (Overlay-Controls mit Verlaufs-Seekbar, großer Play-Puls, Tempo, Lautstärke, Vollbild; Controls blenden bei Wiedergabe nach 2,6 s Ruhe aus, Tastatur-Fokus hält sie sichtbar). Die Transkript-Cues speisen optionale Untertitel per CC-Button (Sprache folgt der UI, mit Fallback). YouTube-Videos laden DSGVO-konform erst nach Einwilligung: Overlay mit Hinweis auf Datenübertragung an Google, Link zur Datenschutzerklärung und „Merken“-Option (localStorage, Zwei-Klick-Lösung).

- **Video-/Audio-Dauer 0:00 gefixt:** Manche Dateien melden dem Browser die Dauer erst spät oder als Infinity (Metadaten am Dateiende) – bisher wurde daraus 0 und der Seek-Regler klebte am Ende. Die Player nutzen jetzt die gespeicherte Blockdauer als Sofort-Fallback und übernehmen die präzise Browser-Dauer, sobald sie eintrifft (durationchange + Nachziehen beim Abspielen).

- **Video-Poster (Vorschaubild):** Video-Blöcke haben jetzt ein Poster, das vor dem Abspielen gezeigt wird. Beim Upload wird es automatisch aus dem 1. Frame erzeugt (ffmpeg, serverseitig, fail-safe); im Lektions-Editor kann der Creator es durch ein eigenes Bild ersetzen oder entfernen (neue poster-Spalte am Block, sichere URL-Validierung). Bestehende Videos wurden nachgezogen, reine Audio-Dateien im Video-Container bekommen bewusst keins.

- **Sprecher umbenennen & Segmente korrigieren:** Im Transkript-Panel des Lektions-Editors gibt es jetzt eine Sprecher-Verwaltung: Jeder erkannte Sprecher („Person 1“, …) lässt sich EINMAL umbenennen (z. B. in den echten Namen) – das gilt sofort für alle Segmente, die „Person N:“-Prefixe im DE/EN-Transkript-Text und die Anzeige in Karaoke-Labels und Video-Untertiteln. Zusätzlich zeigt „Segmente & Zuordnung bearbeiten“ eine scrollbare Liste aller Segmente (Zeit + Text), in der sich einzelne falsch zugeordnete Segmente per Klick auf den richtigen Sprecher umhängen lassen.

- **Lektions-Editor: Medien-Vorschau statt URL + lesbare Dauer:** Video- und Audio-Blöcke zeigen im Editor jetzt das Medium selbst (eigener Video-Player bzw. Audio-Player, YouTube mit Consent-Overlay) statt des URL-Textfelds – die URL bleibt über „URL ändern“ erreichbar. Das editierbare „Dauer in Sekunden“-Feld ist weg: Die Dauer wird beim Upload automatisch ermittelt, bei manuell eingetragenen Datei-URLs beim Verlassen des Felds nachgeladen und als ⏱ h:mm:ss angezeigt.

- **Weicher Wechsel Vorschau ↔ URL-Feld:** Der Umschalter im Lektions-Editor (Medien-Vorschau vs. „URL ändern“) springt nicht mehr: Beide Ansichten bleiben gemountet und klappen per Grid-Transition (300 ms, mit Fade, prefers-reduced-motion beachtet) weich gegeneinander auf und zu; ausgeblendete Bereiche sind per inert für Tastatur/Screenreader deaktiviert.

- **Inhaltsmoderation (FSK-18 / Hass) + Superadmin-Bereich:** Uploads werden automatisch über die kostenlose OpenAI Moderation API geprüft: Bilder (Cover, Bild-Blöcke, Poster, Avatare) synchron beim Upload (abgelehnte werden nie gespeichert), Videos asynchron per ffmpeg-Keyframes (alle 30 s, max. 12), gesprochene Inhalte über das ohnehin erzeugte Transkript. Treffer landen als FLAGGED in der neuen MediaModeration-Tabelle; das Publish-Gate verhindert die Veröffentlichung betroffener Kurse mit kurzer Begründung (auch solange Prüfungen laufen). Fail-open bei API-Ausfällen. Neuer Superadmin-Bereich unter /admin (Rolle ADMIN, alle anderen sehen 404; Anlage per scripts/create-superadmin.mjs): Übersicht (Plattform-Statistiken + offene Fälle), Moderation (Medien-Vorschau, freigeben/sperren – Sperren nimmt betroffene Kurse sofort offline), Kurse (jeden Kurs mit Grund sperren/freigeben), Nutzer (Liste mit Rollen/Aktivität). Admin-Link im Avatar-Menü.

- **Inhaltsprüfung auch beim Speichern:** Da Transkripte, Text-/HTML-Blöcke, Titel, Beschreibungen und Quiz-Fragen nach der automatischen Erzeugung frei editierbar sind, prüfen jetzt auch die Speicher-Actions (Lektion anlegen/ändern, Kurs-Einstellungen, Prüfungen) die Texte über die Moderation API – abgelehnte Speichervorgänge zeigen die Begründung („Speichern abgelehnt (Inhaltsprüfung): …“). HTML wird für die Prüfung zu Text vereinfacht; bei API-Ausfall gilt weiterhin fail-open.

- **Hass-Symbolik in Bildern wird jetzt erkannt (zweistufige Bildprüfung):** Die OpenAI Moderation API prüft Bilder nur auf Sexuelles/Gewalt – eine hochgeladene Hakenkreuz-Flagge rutschte durch. Neu läuft parallel Claude als Vision-Klassifikator, der gezielt auf extremistische/verfassungswidrige Symbole, rassistische Darstellungen, FSK-18 und drastische Gewalt prüft; geflaggt wird, wenn eine der Stufen anschlägt. Verifiziert mit der Testdatei (Stufe 1: sauber, Stufe 2: „extremism“). Alle Bestandsbilder wurden nachgeprüft – die Hakenkreuz-Flagge und ein FSK-18-Testbild stehen jetzt in der Admin-Moderations-Queue.

- **Passwort-Bestätigung + Social-Login:** Die Registrierung verlangt jetzt eine Passwort-Bestätigung (Client-Check + Server-Validierung im Schema, getestet). Login und Registrierung zeigen Google- und LinkedIn-Buttons (Marken-Icons, „oder weiter mit“-Trenner); die NextAuth-Provider sind fertig verdrahtet (Prisma-Adapter/Account-Tabelle existierten schon, E-Mail-Verknüpfung mit bestehenden Konten erlaubt, da beide Provider E-Mails verifizieren). Die Flows laufen, sobald AUTH_GOOGLE_ID/-SECRET bzw. AUTH_LINKEDIN_ID/-SECRET in der .env stehen – Redirect-URIs sind in .env.example dokumentiert.

- **Admin-Kontrollzentrum: Suche, Sortierung, Pagination:** Die Kurs-Liste hat jetzt eine Live-Suche (Titel, Slug, Creator-Mail/-Name; gedrosselt, Filter in der URL) und die bekannte Pagination (20/50/100 pro Seite). Die Nutzer-Tabelle bekam ebenfalls Live-Suche (E-Mail/Name), Pagination und klickbare Spaltenköpfe zum Auf-/Absteigend-Sortieren (E-Mail, Name, Rolle, Kurse, Teilnahmen, Registrierungsdatum – inkl. Sortierung nach Relationszählern und aria-sort für Screenreader). Serverseitig gefiltert/sortiert, E2E getestet.

- **Kurs-Community & Q&A an jeder Lektion:** Unter jeder Lektion im Lernbereich gibt es jetzt „Community & Q&A“ – nur für eingeschriebene Nutzer (plus Creator/Admin), serverseitig geprüft. Diskussionen verschachteln bis zu 3 Ebenen; geantwortet wird mit dem Bubble-Menü-RTE inkl. @Mentions (Tipp-Vorschläge aller Kommentatoren + Creator, ARIA-Listbox mit Pfeiltasten). Creator-Antworten heben sich unverkennbar ab (Verlaufs-Rahmen, Glow, ★-Badge). Antworten auf einen Beitrag befüllt den Editor mit der @Mention des Angesprochenen. Löschen (eigene Beiträge bzw. Creator überall) per Confirm-Dialog als Soft-Delete – Threads bleiben intakt. Beiträge laufen durch Sanitizer (Mention-Spans getestet), Inhaltsprüfung (FSK-18/Hass) und Spam-Bremse (10/5 min). Neue LessonComment-Tabelle; Kommentare laden pro Lektion nach.

- **Community-Panel zugeklappt per Default:** „Community & Q&A“ unter der Lektion klappt jetzt nur per Klick auf (Chevron-Toggle, sanfte Grid-Transition mit Fade, prefers-reduced-motion beachtet, inert für den zugeklappten Bereich). Kommentare werden erst beim ersten Öffnen geladen – spart Requests und hält die Lernansicht ruhig.

- **Kinomodus im Video-Player:** Neben Normalansicht und Vollbild gibt es jetzt einen Kinomodus (Button mit Breitbild-Icon): Das Video legt sich groß zentriert über die abgedunkelte, geblurrte Seite (max. 94 vw, 16:9), die Seite dahinter scrollt nicht mit. Beenden per erneutem Klick, Esc oder Klick auf den Hintergrund; im nativen Vollbild bleibt Esc dem Browser überlassen.

- **Zuverlässige Dauer für YouTube-Videos:** YouTube-Blöcke bekommen ihre Dauer jetzt serverseitig ermittelt – bevorzugt über die YouTube Data API (optionaler YOUTUBE_API_KEY), sonst über die Watch-Seite (lengthSeconds). Greift automatisch beim Speichern der Lektion und live im Editor beim Eintragen der URL; Sidebar-Anzeige und Fortschrittsgewichtung stimmen damit. Bestehende YouTube-Blöcke wurden nachgezogen (inkl. Neuberechnung der Lektionsdauer).

- **Warenkorb für Lernende:** Neues 🛒-Icon mit Live-Zähler im Lern-Header, „In den Warenkorb“-Button neben „Sofort kaufen“ auf jeder Kursseite (bezahlte Kurse) und eine Warenkorb-Seite (/warenkorb), auf der mehrere Kurse in EINER Stripe-Sitzung gekauft werden. Die Umsätze werden pro Kurs anteilig dem jeweiligen Creator zugeschrieben (creatorShareCents je Enrollment), Affiliate-Attribution wird je Kurs aufgelöst und im Fulfillment erneut validiert; Freischaltung idempotent über Webhook UND Erfolgsseite. Warenkorb lebt im localStorage (tab-übergreifend synchron), bereits gekaufte Kurse fliegen automatisch raus; Gutscheine/Guthaben bleiben dem Einzelkauf vorbehalten, Demo-Modus ohne Stripe schreibt direkt ein.

- **Keine Direktzahlungen mehr an Creator:** Der Stripe-Connect-Direct-Charge-Pfad im Einzelkauf wurde entfernt – ALLE Zahlungen (Einzelkauf wie Warenkorb) laufen über das Plattform-Konto. Creator-Anteile landen ausschließlich im Auszahlungs-Guthaben und werden erst nach der 30-Tage-Sperrfrist verfügbar; Guthaben-Einsatz beim Kauf funktioniert damit jetzt bei jedem Kurs. Alt-Verkäufe mit paidViaConnect bleiben korrekt ausgenommen.

- **API-Doku aus dem Header entfernt:** Der Partner-Header verlinkte die API-Dokumentation – laut Vorgabe gehört sie nie in den Header. Der Link ist entfernt; erreichbar bleibt die Doku über den Footer.

- **Sprachwechsel neu:** Die DE/EN-Pillen im Header sind ersetzt durch ein hübsches Sprachwahl-Modal (aktive Sprache markiert, Fokus darauf, Esc/Backdrop schließt). Eingeloggt öffnet man es über den neuen Menüpunkt „🌐 Sprache“ im Avatar-Menü, ausgeloggt über einen minimalistischen Globus-Icon-Button an der Stelle des Avatars. Der Unsaved-Changes-Schutz beim Sprachwechsel bleibt erhalten.

- **AGB-Checkbox + Datenschutz-Hinweis + Newsletter:** Die Registrierung hat jetzt eine Pflicht-Checkbox „Ich akzeptiere die AGB“ (client- UND serverseitig erzwungen) sowie den korrekten Datenschutz-HINWEIS (keine Checkbox – DSGVO-Informationspflicht, keine Einwilligung); unter den OAuth-Buttons deckt ein Rechtssatz auch Google/LinkedIn-Registrierungen ab. Neu: Newsletter mit Double-Opt-in (NewsletterSubscriber-Tabelle, Bestätigungs-Mail mit Token, Bestätigungs-/Abmelde-Seiten, Rate-Limit) und einer auffällig hübschen Signup-Karte über dem Footer: animierter Verlaufs-Rahmen, schwebende Funken, Gradient-Headline („Wir liefern den Funken.“), Pill-Formular mit Glow und transparentem Double-Opt-in-Hinweis – sitewide sichtbar.

- **Resend als Mail-Versand integriert:** sendMail nutzt jetzt bevorzugt die Resend-API (RESEND_API_KEY), mit Absender-Vorlage RESEND_FROM („LearnSphere <XXX@learnsphere.one>“ – XXX wird je Mail-Art ersetzt: noreply/hello/newsletter/billing) und RESEND_OVERRIDE_TO als Testschutz (alle Mails an eine Adresse umgeleitet, Original-Empfänger im Betreff). Fallback bleibt SMTP, ohne beides der Dev-Konsolen-Log. Newsletter-Mails senden als „newsletter@“, alles andere default „noreply@“.

- **Kostenlose Kurse bleiben im Shop:** Die Checkbox „Im LearnSphere-Shop anzeigen" lässt sich bei kostenlosen Kursen nicht mehr abwählen – beim Versuch erscheint ein Hinweis direkt unter der Checkbox (role="status", per aria-describedby verknüpft). Wer einen unlisteten Bezahlkurs auf „Kostenlos" umstellt, bekommt die Listung automatisch (wieder) gesetzt, ebenfalls mit Hinweis. Serverseitig doppelt abgesichert: courseSchema erzwingt listedInShop=true bei priceCents=0.

- **Admin-Dashboard „KI-Verbrauch" (/admin/ki):** Jeder KI-Aufruf wird jetzt protokolliert (neue Tabelle AiUsage: Aktivität, Modell, Input-/Output-Tokens, Audio-Sekunden, Nutzer; Migration 20260730100000). Instrumentiert sind alle neun Aktivitäten: Lernassistent (Stream-Usage via stream_options), Selbsttests, Audio-/Video-Transkription (Sekunden statt Tokens), Übersetzungen, Vorlesen/TTS (Schätzwerte, der Speech-Endpoint meldet keine Usage), Prüfungsbewertung, Kurs-Copilot, Kapitelmarker, Kurs-Index-Embeddings – Tracking ist fire-and-forget und blockiert nie ein Feature. Da die Anbieter nur die Input-SUMME melden, wird der System/User-Anteil anteilig nach Prompt-Zeichen geschätzt (splitInputTokens). Das Dashboard zeigt: KPI-Kacheln (Aufrufe, Input mit System/User-Split, Output + Audio-Minuten, geschätzte Kosten), Verlauf mit umschaltbarer Messgröße (Tokens/Kosten/Aufrufe) und Diagrammtyp (gestapelte Tagesbalken nach Aktivität ↔ Gesamtfläche), Aufschlüsselung nach Aktivität/Modell/Nutzer (Top 10 + Rest, Kosten↔Tokens) – plus Zeitraum (7/30/90/365 Tage, Default 30) und Filter nach Aktivität/Modell/Nutzer in der URL. Kosten werden NICHT gespeichert, sondern zur Anzeige aus der Preistabelle in lib/ai-usage.ts berechnet (Listenpreise USD, Stand 13.07.2026: gpt-4o-mini $0.15/$0.60 je 1M, claude-haiku-4-5 $1/$5 je 1M, whisper-1 $0.006/min, gpt-4o-mini-tts $0.60/1M + ~$0.015/min, text-embedding-3-small $0.02/1M) – Preisänderungen wirken damit rückwirkend auf die Anzeige. Demo-Daten (Marker courseId='ai-demo-seed') und Test-Admin admin-test@example.com sind zum Ausprobieren im Dev-Stand enthalten; löschen per `DELETE FROM AiUsage WHERE courseId='ai-demo-seed'`.

- **Maschinenlesbare KI-Kennzeichnung (Art. 50 Abs. 2 KI-VO, „auf Nummer sicher"):** Neue Lib lib/ai-marking.ts bündelt die Kennzeichnung auf drei Ebenen: (1) DOM – `data-ai-generated="true"` an allen Containern KI-erzeugter Inhalte (Transkripte im Player, Selbsttest-Fragen, Assistent-Antworten, Vorlese-Panel); (2) Audio – generierte TTS-MP3s bekommen beim Erzeugen einen ID3v2.3-Tag mit `TXXX:DigitalSourceType = trainedAlgorithmicMedia` (IPTC-Standardvokabular für synthetische Medien; eigener minimaler ID3-Writer, TDD, syncsafe-kodiert, idempotent), die 14 Bestandsdateien wurden per One-off-Skript nachgetaggt; (3) HTTP – `X-AI-Generated: true` auf den Endpunkten /api/tts und /api/assistant. Konvention in llms.txt dokumentiert. Bewusst NICHT markiert: vom Creator übernommene Copilot-Vorschläge (redaktionelle Verantwortung beim Menschen, Art.-50-Abs.-4-Ausnahme) und KI-Prüfungsbewertung (nur boolesches Urteil, kein generierter Inhalt). Für kurzen Fließtext existiert kein belastbarer Wasserzeichen-Standard („soweit technisch machbar").

- **„Teste dich" nur bei genug Lernstoff:** Ob eine Lektion die Mindestmenge für sinnvolle Selbsttest-Fragen hat (300 Zeichen Text + Transkripte), ist vorab bekannt – die Lernansicht blendet den Selbsttest daher gar nicht erst ein, statt nach dem Klick „zu wenig Inhalt" zu melden. Berechnet serverseitig pro Lektion und Sprache (hasSelfTestContent in lib/self-test.ts, dieselbe Schwelle wie die Action; die prüft weiterhin als zweite Verteidigungslinie). Fügt der Creator Inhalt hinzu, erscheint der Button beim nächsten Laden automatisch.

- **KI-Transparenzhinweis auf der Kursdetailseite:** Unter dem Creator-Block steht jetzt ein bewusst nüchterner Kennzeichnungs-Kasten („Transparenzhinweis: Einsatz von KI") – benennt faktisch, was KI-unterstützt sein kann (Transkripte/Untertitel, Übersetzungen, generierte Übungsfragen, Freitext-Auswertung), stellt die inhaltliche Verantwortung des Creators und mögliche Fehler klar und verweist auf Art. 50 der EU-KI-Verordnung (VO (EU) 2024/1689). Formulierung mit „können … worden sein", da nicht jeder Kurs alle KI-Funktionen nutzt; Gestaltung klein/faint ohne Akzentfarbe – Kennzeichnung, kein Werbeelement. DE/EN.

- **Bewertungen auf der Kursdetailseite:** Im Hero steht jetzt die Ø-Bewertung des Kurses als anteilig gefüllte Sterne (z. B. 4,3 → 86 % Füllung) mit Wert und Anzahl („★★★★☆ 4,3 · 12 Bewertungen"; ohne Bewertungen dezent „Noch keine Bewertungen"). Im Creator-Block darunter zusätzlich der Schnitt über ALLE Kurse des Creators („Ø über alle Kurse · N Bewertungen") – berechnet als ein Review-Aggregat (jede Bewertung zählt gleich, kein Mittel von Kurs-Mitteln; loadCreatorRating in rating-server.ts). Der Creator-Block erscheint jetzt auch ohne Bio, sobald Bewertungen existieren. Sterne sind barrierefrei (role="img" + „Bewertung: X von 5 Sternen", Zeichen aria-hidden).

- **Sitemap hübsch gemacht (ohne Validierungsverlust):** /sitemap.xml verweist jetzt per `<?xml-stylesheet?>` auf /sitemap.xsl – Browser zeigen eine gestylte Night-Observatory-Ansicht (Kicker, Serif-Headline, Stat-Pills, Tabelle mit nummerierten URLs, DE/EN-Badges, Änderungsdatum), Suchmaschinen ignorieren die Processing Instruction und lesen das unveränderte, valide XML (sitemaps.org 0.9 + xhtml-Alternates). Dafür von der Next-Metadata-Route auf einen eigenen Route-Handler umgestellt; die XML-Serialisierung (`renderSitemapXml`, inkl. Escaping) liegt testbar in lib/sitemap.ts. Wohlgeformtheit per DOMParser gegen die Live-Route verifiziert.

- **Fokusring des Review-Felds repariert:** Der Rich-Text-Editor zeichnete seinen Fokus als äußeres Outline bei transparent geschaltetem Rahmen – der Ring passte nicht auf den Feldradius und wurde von overflow:hidden-Eltern abgeschnitten. Jetzt liegt der Ring AUF dem Rahmen (Accent-Border + Inset-Shadow) und kann nirgends mehr geclippt werden – gilt für alle RTE-Einsätze (Review, Editor, Community). Zusätzlich behoben: Existierte beim Laden schon eine Bewertung, blieb das Review-Feld dauerhaft auf overflow:hidden (die Aufklapp-Animation lief nie, ihr Completion-Callback also auch nicht) und clippte Fokus und Bubble-Menü.

- **„Mein Lernen": Hover-Button auf den Kurskarten:** Beim Hovern einer Karte legt sich ein sanfter Verlauf übers Cover und ein Lime-Button gleitet herein – „Jetzt anfangen" (0 % Fortschritt) bzw. „Weiterlernen" (angefangen); dazu zoomt das Cover minimal. Per Tastatur erscheint der Button beim Fokussieren, auf Touch-Geräten (kein Hover) ist er dauerhaft dezent unten sichtbar; prefers-reduced-motion schaltet alle Animationen ab. Umgesetzt als echter Link auf die Lernansicht mit sprechendem aria-label.

- **Sprachmodal im Viewport zentriert:** Das Sprachwahl-Modal (und der Unsaved-Changes-Dialog) hingen am sticky Header fest, weil dessen `backdrop-filter` einen Containing Block für `position: fixed` bildet – Overlay und Backdrop bezogen sich auf den Header statt auf den Viewport. Beide Dialoge rendern jetzt über eine neue `BodyPortal`-Komponente (createPortal nach `<body>`, hydration-sicher via useSyncExternalStore): Modal mittig im Viewport, Backdrop deckt die ganze Seite ab.

- **Mehrsprachige Kurse (DE/EN je Kurs):** Creator legen je Kurs eine Basissprache und beliebige Zusatzsprachen fest (Chips in den Einstellungen). Übersetzt werden Kurs-Metatexte (Titel/Untertitel/Beschreibung), Abschnitts- und Lektionstitel sowie pro Block Titel, Text-/HTML-Inhalte und Medien (eigene Video-/Audio-/Bild-/Datei-URL je Sprache inkl. Upload und eigener Dauer). Editor: Sprach-Tabs im Lektions-Editor (Struktur nur im Basis-Tab), Übersetzungsbereich in den Einstellungen, „Titel übersetzen" je Abschnitt. Fallback-Prinzip überall feldweise: leer = Basissprache. Lernansicht: Sprach-Umschalter (Default = Site-Sprache, Wahl in localStorage gemerkt); fehlt ein übersetztes Medium, läuft das Original mit Badge „Noch nicht übersetzt – Original (DE)". Fortschritt bleibt sprachunabhängig pro Lektion (Basis-Dauern als Gewichtung). Katalog/Startseite/Storefront/Embed/Kursdetail lösen Texte nach Site-Sprache auf und zeigen alle Kurssprachen als Badge; öffentliche + Affiliate-API liefern `languages` und unterstützen `?lang=`. Datenmodell: `Course.extraLanguages` + `translations`-JSON je Kurs/Abschnitt/Lektion/Block (Migration 20260717100000), serverseitig zod-validiert, Inhalte laufen durch Sanitizer + Inhaltsprüfung; YouTube-Dauern werden auch für übersetzte URLs nachgezogen. Bewusst offen: Prüfungen (Quizzes) und die Katalog-Suche arbeiten vorerst nur mit der Basissprache.

- **Neue Umsatzbeteiligung 50 % / 75 %:** Der Creator-Anteil sinkt von 60 % auf 50 % bei Verkäufen über LearnSphere und von 80 % auf 75 % über eigene Kanäle (Widget/API); Affiliates erhalten unverändert 15 %. Zentral in `CREATOR_SHARE_PERCENT` geändert und überall nachgezogen: Tests, Preisseite, FAQ, AGB, Startseite, Vertriebs-Seite, API-Doku, API-Skill und Schema-Kommentare. Bestehende Verkäufe behalten ihren historisch gespeicherten Anteil (creatorShareCents).

- **Monorepo + native App (Expo) – Fundament:** Das Repo ist jetzt ein npm-Workspace-Monorepo: `apps/web` (bisherige Next.js-App, unverändertes Verhalten, Vercel Root Directory auf `apps/web` stellen), `apps/mobile` (neue Expo-App, SDK 57) und geteilte Packages ohne Build-Step: `@elearning/core` (gesamte pure Domain-Logik inkl. Tests – validation, grading, progress, exam-policy, coupon, revenue, certificate/* u. a., eigenes Vitest mit 100 %-Coverage), `@elearning/tokens` (Design-Tokens als primitives/web/native; `styles/theme.ts` ist nur noch Re-Export, Paritätstest sichert Byte-Gleichheit), `@elearning/i18n` (messages/de|en.json + Key-Paritätstest de↔en), `@elearning/api-contracts` (zod-Schemas der Mobile-API). Mobile-Auth: eigene Token-Endpoints unter `/api/mobile/v1/auth/*` (Login mit 2FA-Step-up per 202, Refresh-Rotation mit Family-Reuse-Detection im neuen Prisma-Model `MobileSession`, Registrierung mit Auto-Login, Passwort-Reset inkl. Widerruf aller Geräte-Sessions, Logout/Logout-all), Access-JWTs 15 min via jose (`MOBILE_JWT_SECRET`), `authenticateMobileRequest()` analog zu api-auth. Die Credential-Prüfung ist aus `authorize()` nach `lib/services/auth-service.ts` extrahiert (Web + Mobile teilen sie sich) und um TOTP-Replay-Schutz erweitert (`User.totpLastUsedStep`). Expo-App: expo-router mit Auth-Gate (Stack.Protected), unistyles v3 mit nativen Tokens, use-intl mit denselben Katalogen wie Web, TanStack Query, Login/Registrieren/Passwort-vergessen-Screens, Tabs (Katalog aus der öffentlichen API, Mein Lernen, Profil), Token-Storage: Access im Speicher + Refresh im SecureStore, fetch-Wrapper mit 401→Refresh→Retry. Tests: jest-expo (Token-Store, API-Client inkl. Refresh-Flow); expo-doctor-Hinweis zu react-Duplikaten ist dokumentiert benign (Metro `disableHierarchicalLookup`). Bewusst offen: Learner-Endpoints (Enrollments/Lektionen/Quiz), signierte Video-URLs, IAP (Preis-Tier-Mapping, Modelle geplant), Creator-Dashboard mobil.

- **Mobile-App Phase 2 – Lernen, Prüfungen, Käufe, Creator-Studio:** Die Mobile-REST-API ist komplett: signierte Video-URLs (`lib/media-sign.ts`, HMAC + 10-min-TTL; die Streaming-Route akzeptiert `se`/`st` zusätzlich zum Session-Cookie – native Player verlieren Auth-Header bei Range-Requests), Lern-Endpoints (`my/enrollments`, `my/courses/[id]` mit Gliederung/Prüfungs-Zulassung, `lessons/[id]` mit i18n-aufgelösten Blöcken + signierten Medien, visit/progress/reset, Gratis-enroll), Prüfungen (`quizzes/[id]` ohne Lösungen inkl. serverseitiger Uhr, `submit` mit identischen Regeln wie das Web) und Zertifikate (Liste + PDF per Bearer). Die Orchestrierung wanderte dafür aus den Server Actions in geteilte Services (`lib/services/{progress,quiz,learning,certificate}-service.ts`) – Web-Actions und REST-Routen sind dünne Wrapper, Web-Verhalten unverändert. In-App-Käufe nach dem Preis-Tier-Modell: 16 feste Tier-Produkte (`@elearning/core/iap-tiers`, kleinste Stufe ≥ Webpreis), Intent-Pattern gegen Cross-Grade-Betrug (`IapPurchaseIntent` mit appAccountToken), serverseitige Verifikation (Apple JWS via @apple/app-store-server-library, Google Play Developer API inkl. acknowledge), idempotentes Fulfillment über `IapTransaction.storeTransactionId`, Creator-Anteil = 50 % vom Netto nach Store-Provision (`iapCreatorShareCents`, Env `IAP_STORE_COMMISSION_PERCENT`), Refund-Webhooks (App Store Server Notifications V2, Play RTDN via Pub/Sub-OIDC) entziehen die Einschreibung. Coupons/Affiliate bleiben Web-only. App-Screens: Mein Lernen (Fortschrittsbalken), Kurs-Gliederung (Lektionen, Zwischen-/Abschlussprüfung mit Zulassungsanzeige), Player (expo-video mit Resume-Positionen, Sehzeit-Tracking mit 15-s-Autosave, Text/HTML/Bild/Datei-Blöcke), Quiz (Single/Multiple/Freitext, Countdown, Ergebnisansicht), Zertifikate (PDF-Download hell/dunkel via Share-Sheet), Paywall (expo-iap) und Creator-Studio read-only (KPIs, Guthaben, Kursliste; nur CREATOR/ADMIN). Bewusst offen: IAP end-to-end nur auf echten Geräten mit Store-Konten testbar (Tier-Produkte müssen einmalig in App Store Connect/Play Console angelegt werden, IDs `course_tier_00499` …); OAuth-Login in der App; Notizen/Kommentare/Reviews mobil; Offline-Downloads; Push.

- **Mobile-App Phase 3 – Community, Reviews, Profil, OAuth:** Notizen (privat, optional mit Zeitstempel der Wiedergabeposition), Lektions-Kommentare (Threads bis Ebene 2, Soft-Delete, Sanitizing + Moderation + Spam-Bremse wie im Web) und Kurs-Bewertungen (1–5 Sterne + Text) sind jetzt auch in der App: Endpoints unter `/api/mobile/v1/…/notes|comments|review`, UI im Player (NotesSection/CommentsSection) und im Kurs-Screen (RatingSection). Die Logik wanderte aus note-/comment-/review-actions in geteilte Services – dabei einen latenten Bug gefixt: `checkRateLimit` wurde in comment-actions (und registerUser) ohne `await` aufgerufen, die Spam-/Registrier-Bremse griff dadurch nie. Profil: `PATCH /api/mobile/v1/me` (Name/Locale) + Name-Bearbeitung im Profil-Screen. OAuth nativ: `POST /api/mobile/v1/auth/oauth` verifiziert Google-/LinkedIn-id_tokens gegen die Provider-JWKS (Audience = `GOOGLE_MOBILE_CLIENT_IDS`/`LINKEDIN_MOBILE_CLIENT_IDS`), verknüpft Konten über die verifizierte E-Mail (gleiche Vertrauensbasis wie allowDangerousEmailAccountLinking) und stellt das Mobile-Token-Paar aus; die App zeigt den Google-Button, sobald `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` gesetzt ist (expo-auth-session). Benötigt noch externe Einrichtung: Offline-Downloads (Produktentscheidung: geschützte Videos lokal speichern = Kopierschutz-Abwägung) und Push-Notifications (EAS-Projekt + Entscheidung, welche Events pushen) – beides bewusst nicht spekulativ vorgebaut.

## 2026-07-22 · Beispielinhalte: 50 Filmwissen-Kurse

**Seed-Skript `scripts/seed-film-courses.mjs`**
- Legt 50 Kurse zu Filmklassikern an (Vom Winde verweht, Der Pate, Casablanca, Star Wars, Herr der Ringe, Harry Potter, James Bond, Metropolis, Parasite …), jeweils mit echten Hintergrundfakten, Zitat und Genre. Reihen wie Bond oder Potter sind bewusst als ein Kurs angelegt.
- Je Kurs 5–15 Lektionen in 2–4 Abschnitten, jede Lektion mit 1–3 Blöcken aus sieben Vorlagen: Fließtext mit Beobachtungsaufgaben, gestaltete Zitat-Karte, Fakten-Box, Zeitleiste, Farbpaletten-Grafik, Kompositionsschema (Drittelregel) und Übung. HTML-Blöcke bringen eigenes CSS in den Filmfarben mit, Grafiken sind als SVG eingebettet – ohne externe Dateien oder Uploads.
- 0–2 Zwischenprüfungen und in 90 % der Fälle eine Abschlussprüfung; Fragen als Single-, Multiple-Choice und Freitext (KI-bewertet). Falsche Antwortoptionen stammen aus den übrigen Filmen des Datensatzes, sind also plausibel statt beliebig.
- Variiert außerdem Preis (30 % kostenlos), Sehanteil-Schwelle, Wiederholungsregeln, Zeitlimits, Vorschau-Lektionen und gelegentlich Drip-Regeln, damit die Oberfläche mit realistischer Streuung getestet werden kann.
- Deterministisch über `SEED`, idempotent (bestehende Slugs werden übersprungen), `RESET=1` entfernt die Seed-Kurse wieder. Verifiziert gegen eine frische Datenbank: 50 Kurse, 154 Abschnitte, 487 Lektionen, 962 Blöcke, 96 Prüfungen mit 407 Fragen – anschließend im Browser geprüft (Katalog, Kursseite, Vorschau-Lektion, Drip-Kennzeichnung).

## 2026-07-21 · Livegang auf Hostinger (https://learnsphere.one)

**Die Plattform läuft self-hosted auf einem Hostinger-VPS (KVM 2, Frankfurt)**
- Ubuntu 24.04 mit Docker-Template, zwei Container (Next.js standalone + MySQL 8.4), Uploads und Datenbank auf persistenten Volumes, Caddy davor für automatisches HTTPS.
- Port-Konflikt beim Reverse-Proxy: Das Hostinger-Template startet einen eigenen Traefik, der 80/443 belegt. Er wurde gestoppt und auf `restart=no` gesetzt; wer ihn braucht, konfiguriert stattdessen Traefik-Labels und lässt Caddy weg.

**Sechs Probleme, die erst in der echten Produktionsumgebung auftraten**
- **Prisma-CLI unvollständig im Image:** Das Dockerfile kopierte nur `prisma` und `@prisma`; `@prisma/config` braucht zusätzlich effect, c12, deepmerge-ts und empathic. Der Container starb in einer Restart-Schleife („Cannot find module 'effect'"). Die CLI wird jetzt im Builder isoliert installiert und komplett übernommen.
- **Query-Engine für die falsche Plattform:** `prisma generate` lief ohne OpenSSL im Builder und riet auf openssl-1.1.x, während das Runtime-Image OpenSSL 3.0 nutzt. Behoben durch OpenSSL im Builder, explizite `binaryTargets` und ausdrückliches Kopieren von `.prisma/client`.
- **Migrationen case-sensitiv kaputt:** Acht `ALTER TABLE`-Anweisungen sprachen Tabellen kleingeschrieben an (`enrollment` statt `Enrollment`). Unter MariaDB/Windows egal, unter MySQL/Linux ein Fehler – die Migration scheiterte und blockierte als „failed migration" alle weiteren (P3009).
- **Vier fehlende Schema-Objekte:** MobileSession, IapPurchaseIntent, IapTransaction und User.totpLastUsedStep existierten nur in der per `db push` gewachsenen Entwicklungs-DB. Migrationen nachgetragen.
- **Leere Env-Werte verhinderten den Start:** Eine frisch aus der Vorlage kopierte `.env.production` enthält rund 30 leere Variablen; die Validierung wertete `FOO=""` als ungültigen Wert statt als „Feature aus".
- **bcryptjs fehlte den Wartungsskripten:** Next.js kompiliert das Paket in seine Server-Bundles, im standalone-Output existiert es dann nicht mehr als eigenes Modul – für die App genügt das, ein eigenständig gestartetes Skript kann es aber nicht laden.

**Konsequenz: CI-Schutz gegen Migrationslücken**
- `scripts/check-migrations.mjs` vergleicht textuell, ob die Migrationen alle Modelle und Spalten des Schemas erzeugen, und prüft die Schreibweise der Tabellennamen. Läuft ohne Datenbank als erster CI-Schritt. Damit fällt die häufigste Klasse dieser Fehler künftig in GitHub auf statt auf dem Server.

## 2026-07-21 · Deployment-Vorbereitung

**Schritt-für-Schritt-Anleitung fürs erste Hostinger-Deploy**
- Neue Doku docs/DEPLOY-ANLEITUNG-SCHRITT-FUER-SCHRITT.md: vom leeren VPS bis zur laufenden HTTPS-Seite, für Docker-Einsteiger geschrieben – inkl. Git-Einrichtung, Docker-Template in hPanel, SSH, DNS, Secrets, Caddy, Superadmin, Abnahme-Checkliste, Backup-Cron und Troubleshooting. Die bisherige DEPLOY-HOSTINGER.md bleibt als Kurzreferenz und verlinkt sie.
- Vorab geprüft: `prisma migrate diff` zeigt zwischen Migrationsordner und schema.prisma keine Abweichung – eine frische Produktions-DB bekommt über `migrate deploy` das vollständige Schema (der lokale Drift betrifft nur die Entwicklungs-DB).

**Automatisches Deployment bei Push auf main (CI/CD)**
- Der bestehende CI-Workflow ist um einen `deploy`-Job erweitert: Nach grünem Check (tsc, ESLint, Tests mit 100-%-Schwelle) verbindet sich GitHub Actions per SSH mit dem Server, zieht `main` hart nach (`git reset --hard`, damit der Server exakt spiegelt), baut den Container neu und wartet auf einen Health-Check – antwortet die App nach 5 Minuten nicht, wird der Lauf rot und hängt die letzten 50 Container-Logzeilen an. Deploys laufen per `concurrency` strikt nacheinander, Pull Requests lösen nie ein Deployment aus, manuelles Ausrollen geht über „Run workflow".
- Die Server-Seite liegt als `scripts/deploy.sh` im Repo und wird über stdin ausgeführt – so gilt immer die Fassung des gerade gebauten Commits. Bewusst ohne Fremd-Actions (roher `ssh`-Aufruf), damit keine Drittanbieter-Action Zugriff auf die Deploy-Secrets bekommt.
- Einrichtung in docs/DEPLOY-CI-CD.md (SSH-Key, fünf Repository-Secrets, Test-Lauf) inkl. Rollback-Anleitung und der Sicherheitsabwägung zum Root-Zugriff.

**.env.example aufgeräumt und vollständig gemacht**
- Vollständigkeit maschinell geprüft (alle `process.env`-Zugriffe + das zod-Schema in lib/env.ts + Auth.js-Konventionsnamen gegen die Datei gediffed): keine Karteileichen, es fehlten `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` – jetzt ergänzt (auskommentiert, mit Hinweis auf die sauberere Argument-Übergabe).
- Drei inhaltliche Fallstricke behoben: `RESEND_OVERRIDE_TO` war mit einer echten Adresse vorbelegt (jede Kopie hätte sofort alle Nutzer-Mails umgeleitet) → jetzt leer mit Warnung; der DATABASE_URL-Kommentar warnte noch vor Serverless-Verbindungslimits (Vercel-Altlast, wir hosten selbst) → auf den Docker-Fall umgeschrieben; der Upstash-Hinweis („nur für lokale Entwicklung geeignet") widersprach der Deploy-Doku → präzisiert (In-Memory genügt bei einer Instanz, Redis erst ab mehreren).
- Datei nach Zweck gegliedert (Pflicht / E-Mail / Zahlungen / KI / Login / Integrationen / Betrieb / Self-Hosting / Mobile), damit beim Deploy sofort klar ist, was gesetzt werden muss und was optional Features freischaltet.

**Drei Deploy-Blocker behoben**
- Der Web-Container band Port 3000 auf alle Netzwerk-Interfaces – die App wäre unverschlüsselt über `http://<vps-ip>:3000` erreichbar gewesen (Login-Daten im Klartext, am Reverse-Proxy vorbei). Jetzt `127.0.0.1:3000`.
- Das Superadmin-Skript lag gar nicht im Docker-Image (das Dockerfile kopierte `scripts/` nicht mit) – es wird jetzt mitgeliefert und läuft per `docker compose exec web node scripts/create-superadmin.mjs`.
- Dasselbe Skript stürzte ohne `.env`-Datei ab (`readFileSync` ungefangen), was im Container immer der Fall ist. Fehlende Datei ist jetzt kein Fehler mehr, Zugangsdaten werden auch aus echten Umgebungsvariablen gelesen – ohne .env-Datei end-to-end verifiziert.

## 2026-07-18 · Lern-Erlebnis & Creator-Werkzeuge (10 neue Features)

**Spaced Repetition – Karteikarten aus Prüfungsfragen (per TDD)**
- Neue Seite /wiederholen: Aus allen Prüfungen, die man versucht hat, entstehen automatisch Karteikarten; Terminierung nach SM-2 light (1 → 3 → Intervall×Ease, "Nochmal" in 10 min, Deckel 365 Tage) – Logik in @elearning/core/spaced-repetition mit 100 % Testabdeckung.
- Session-UI mit Karten-Animation: Antwort wählen → Auflösung → "Gewusst/Zu leicht"; falsch beantwortete Karten kommen ans Ende der Runde, bis alles saß. Freitextfragen mit Selbsteinschätzung. Abschluss-Screen mit Quote.

**Drip Content – Abschnitte flexibel freischalten**
- Je Abschnitt zwei optionale, kombinierbare Regeln: "frühestens X Tage nach Kauf" und/oder "erst nach bestandener Zwischenprüfung des vorherigen Abschnitts" (Panel im Kurs-Editor).
- Serverseitig dicht: Inhalte gesperrter Abschnitte werden nie an den Browser gesendet (wie bei Vorschau-Lektionen), Zwischenprüfungen gesperrter Abschnitte sind weder ladbar noch wertbar – Web und Mobile-API nutzen dieselbe Sperrprüfung. Lernansicht zeigt 🔒 mit Freischalt-Datum bzw. -Bedingung, die Kursseite kennzeichnet Drip-Abschnitte transparent vor dem Kauf.

**Warteliste & Launch-Benachrichtigung**
- Checkbox "Warteliste aktivieren" im Editor (nur unveröffentlichte Kurse): Die Kursseite zeigt statt 404 eine "Demnächst"-Seite mit Cover-Hero und E-Mail-Eintragung (Rate-Limit, idempotent per Upsert).
- Beim Veröffentlichen werden alle Eingetragenen einmalig per Mail benachrichtigt (notifiedAt verhindert Doppel-Mails, Mail-Fehler blockieren nie die Veröffentlichung und werden beim nächsten Publish nachgeholt).

**Analytics pro Kurs**
- Neue Seite /creator/kurse/[id]/statistiken: KPI-Kacheln (Teilnehmende, Einnahmen-Anteil, Abschlussquote, Zertifikate, Ø-Bewertung), Lektions-Funnel (wo steigen Lernende aus?), Bestehensquote + Ø-Bestwert + Versuche je Prüfung und Video-Retention je Medienblock mit markierter größter Absprungstelle (aus den anonymen Heatmap-Buckets).
- Aggregationslogik als reine, getestete Funktionen in @elearning/core/course-analytics.

**Drag-and-drop im Kurs-Builder**
- Abschnitte und Lektionen lassen sich am ⠿-Griff ziehen – Lektionen auch in andere Abschnitte; Drop-Ziele leuchten, das gezogene Element wird transparent. Die ↑/↓-Buttons bleiben als tastaturbedienbare Alternative.
- Serverseitig zwei neue Actions: komplette Abschnitts-Reihenfolge in einem Schritt (mit Set-Gleichheits-Prüfung gegen veraltete Clients) und "Lektion an Position X in Abschnitt Y" (transaktional, beide Abschnitte werden lückenlos neu nummeriert).

**Personalisierte Begrüßung in "Mein Lernen"**
- Neues Begrüßungsband: Tageszeit-Gruß mit Vornamen, 🔥-Lern-Streak mit 7-Tage-Leiste, "Weiter mit …"-Karte (Cover, letzte Lektion, Fortschritt) und fällige Karteikarten mit Direkteinstieg ins Wiederholen.
- Streak-Datenbasis: ein LearnActivity-Eintrag je Nutzer und UTC-Tag, geschrieben bei Lektionsbesuch, Fortschritt, Prüfungsabgabe und Karteikarten – Berechnung (Streak überlebt bis Tagesende) getestet in @elearning/core/streak.

**Fokus-Modus in der Lernansicht**
- Neuer "⛶ Fokus"-Button: Die Lektion legt sich als Vollbild-Ebene mit Ambient-Glow über die Seite – Header, Sidebar und alles andere verschwinden. Esc oder ✕ beendet; laufende Videos werden dabei nicht neu gemountet (gleiche DOM-Knoten, nur Styling wechselt).

**Lernpfad als 3D-Journey (Three.js)**
- Über der Lernansicht zeigt eine leuchtende Reise den Kurs: eine Station je Abschnitt, der Pfad füllt sich lime mit dem Fortschritt, die nächste offene Station pulsiert mit Ring, gesperrte (Drip) sind gedimmt; Klick springt zum Abschnitt, Ziehen dreht die Szene.
- Rein ergänzend-dekorativ (aria-hidden, Sidebar bleibt die barrierefreie Navigation), lazy geladen, respektiert prefers-reduced-motion, deterministischer Sternenstaub.

**View Transitions (Kursübersicht → Kursdetail → Lernen)**
- Kurskarten-Cover morphen beim Klick in den Kursdetail-Hero (view-transition-name je Kurs), Seitenwechsel laufen als weiches Cross-Fade mit leichtem Anheben. Da React 19.1 die ViewTransition-Komponente noch nicht stabil exportiert, direkt über die native Browser-API gelöst (TransitionLink + Bridge, die die Transition beim Routenwechsel abschließt).
- Browser ohne View-Transition-Support und prefers-reduced-motion behalten den bisherigen Fade-Übergang – beide Systeme wissen voneinander (kein Doppel-Dimmen).

**Skeleton-States & Micro-Interactions**
- Ladezustände für Katalog, Mein Lernen, Lernansicht, Wiederholen und Kurs-Statistiken als Schimmer-Skeletons im echten Seitenlayout (loading.tsx) statt Spinner.
- Kleine Details: Buttons geben beim Drücken haptisch nach (global, überschreibbar), der Erledigt-Haken in der Kursnavigation "ploppt" beim Abschließen einer Lektion.

- **Mobile-App läuft in Expo Go (SDK 54):** Damit die App auf Geräten mit älterem Expo Go sichtbar ist (iOS-Gerät des Betreibers unterstützt max. SDK 54), wurde das Projekt von SDK 57 auf 54 umgestellt (expo 54.0.35, expo-router 6, RN 0.81, react 19.1.0) und Expo-Go-kompatibel gemacht: react-native-unistyles durch einen eigenen JS-Styling-Shim (src/ui/styles.ts, gleiche API, Tokens aus @elearning/tokens) ersetzt, expo-iap per Lazy-Import gekapselt (Expo Go → sauberer iap_unavailable-Fehler), SecureStore mit localStorage-Fallback für die Web-Vorschau. Dependency-Hygiene fürs Monorepo: `legacy-peer-deps=true` (.npmrc) beendet npm-Peer-Auto-Installs, die wiederholt abweichende react/@types/react-Kopien erzeugten; react/react-dom 19.1.0 als Root-devDependency gepinnt (eine Kopie im ganzen Repo, Web wie App – Next akzeptiert ^19); @tiptap/suggestion als nun nötige direkte Dependency ergänzt; Metro pinnt die react-Familie zusätzlich per resolveRequest. Web-Vitest pinnt react/react-dom via require.resolve-Aliases. Rückweg zu SDK 57 (wenn das Gerät aktuelles Expo Go bekommt): expo hochsetzen + `npx expo install --fix`, VideoView wieder auf fullscreenOptions.
