# OAuth einrichten: Google & LinkedIn

Schritt-für-Schritt-Anleitung, um „Mit Google anmelden" und „Mit LinkedIn
anmelden" zum Laufen zu bringen. Am Ende hast du vier Werte, die in die
`.env` gehören:

| Variable | woher |
| --- | --- |
| `AUTH_GOOGLE_ID` | Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | Google Cloud Console |
| `AUTH_LINKEDIN_ID` | LinkedIn Developer Portal |
| `AUTH_LINKEDIN_SECRET` | LinkedIn Developer Portal |

Ohne diese Werte sind die Buttons einfach wirkungslos – die App startet
trotzdem. Du kannst also erst Google einrichten und LinkedIn später.

---

## 0. Das Wichtigste vorab: die Redirect-URI

Beide Anbieter fragen nach einer **Redirect-URI** (auch „Callback-URL",
„Weiterleitungs-URI"). Das ist die Adresse, an die der Anbieter den Nutzer
nach dem Login zurückschickt. Sie muss **exakt** stimmen – ein fehlendes
`s` in `https` oder ein Schrägstrich zu viel, und der Login scheitert mit
`redirect_uri_mismatch`.

Für LearnSphere lautet das Muster immer:

```
<deine-Domain>/api/auth/callback/<anbieter>
```

Konkret brauchst du je Anbieter **zwei** URIs – eine für Produktion, eine
zum lokalen Entwickeln:

| Zweck | Google | LinkedIn |
| --- | --- | --- |
| Produktion | `https://learnsphere.one/api/auth/callback/google` | `https://learnsphere.one/api/auth/callback/linkedin` |
| Lokal | `http://localhost:3000/api/auth/callback/google` | `http://localhost:3000/api/auth/callback/linkedin` |

> Nutzt du eine andere Domain, ersetze `learnsphere.one` überall. Der Pfad
> `/api/auth/callback/…` bleibt immer gleich – den gibt Auth.js vor, daran
> lässt sich nichts ändern.

---

## 1. Google

### 1.1 Projekt anlegen

1. Öffne die **Google Cloud Console**: <https://console.cloud.google.com/>
2. Oben in der Projektauswahl (neben dem Google-Cloud-Logo) auf **Projekt
   auswählen → Neues Projekt**.
3. Name z. B. `LearnSphere`, **Erstellen**. Warte, bis das Projekt oben
   ausgewählt ist.

### 1.2 OAuth-Zustimmungsbildschirm (Consent Screen)

Das ist das Fenster, das der Nutzer sieht („LearnSphere möchte auf dein
Google-Konto zugreifen"). Es muss einmal eingerichtet sein, bevor du
Zugangsdaten erstellen kannst.

1. Linkes Menü → **APIs & Dienste → OAuth-Zustimmungsbildschirm**
   (englisch: *OAuth consent screen*).
   Direktlink: <https://console.cloud.google.com/apis/credentials/consent>
2. Nutzertyp **Extern** wählen → **Erstellen**.
3. Pflichtfelder:
   - **App-Name**: `LearnSphere`
   - **Support-E-Mail**: deine Adresse
   - **Kontakt-E-Mail** des Entwicklers (ganz unten): deine Adresse
   - Logo, Startseite usw. sind optional.
4. **Speichern und fortfahren**.
5. **Bereiche (Scopes)**: Hier musst du nichts hinzufügen. Die App fragt
   nur Name und E-Mail ab (`email`, `profile`, `openid`) – das sind
   nicht-sensible Standardbereiche. **Speichern und fortfahren**.
6. **Testnutzer**: Solange die App im Status „Test" ist, dürfen sich nur
   hier eingetragene Google-Konten anmelden. Trag dich selbst ein zum
   Ausprobieren. **Speichern und fortfahren**.

> **Freischalten für alle:** Damit sich beliebige Nutzer anmelden können,
> gehst du im Zustimmungsbildschirm später auf **App veröffentlichen →
> In Produktion**. Für die Bereiche E-Mail/Profil ist **keine
> Google-Überprüfung** nötig; der Nutzer sieht dann keinen
> „nicht verifiziert"-Warnhinweis mehr.

### 1.3 Zugangsdaten erstellen

1. Linkes Menü → **APIs & Dienste → Anmeldedaten** (*Credentials*).
   Direktlink: <https://console.cloud.google.com/apis/credentials>
2. Oben **+ Anmeldedaten erstellen → OAuth-Client-ID**.
3. **Anwendungstyp: Webanwendung**.
4. Name z. B. `LearnSphere Web`.
5. Unter **Autorisierte Weiterleitungs-URIs** → **+ URI hinzufügen** und
   **beide** Google-URIs aus Abschnitt 0 eintragen:
   ```
   https://learnsphere.one/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```
   („Autorisierte JavaScript-Quellen" darüber kannst du leer lassen.)
6. **Erstellen**.
7. Es erscheint ein Fenster mit **Client-ID** und **Clientschlüssel**.
   - Die **Client-ID** → `AUTH_GOOGLE_ID`
   - Der **Clientschlüssel** (Client Secret) → `AUTH_GOOGLE_SECRET`

   Du kannst beide später jederzeit unter **Anmeldedaten** wieder öffnen.

Weiter bei [Abschnitt 3](#3-die-werte-eintragen).

---

## 2. LinkedIn

LinkedIn nutzt „Sign In with LinkedIn using OpenID Connect". Das ist ein
eigenes **Produkt**, das du der App hinzufügen musst – sonst fehlen die
Berechtigungen für E-Mail und Name.

### 2.1 App anlegen

1. Öffne das **LinkedIn Developer Portal**:
   <https://www.linkedin.com/developers/apps>
2. **Create app**.
3. Felder:
   - **App name**: `LearnSphere`
   - **LinkedIn Page**: LinkedIn verlangt eine zugeordnete
     Unternehmensseite. Hast du keine, lege unter
     <https://www.linkedin.com/company/setup/new/> in zwei Minuten eine an
     (auch für ein Einzelprojekt möglich) und wähle sie hier aus.
   - **App logo** hochladen (Pflicht).
   - Nutzungsbedingungen bestätigen → **Create app**.

### 2.2 Produkt „Sign In with LinkedIn" hinzufügen

1. In der App oben auf den Reiter **Products**.
2. Bei **Sign In with LinkedIn using OpenID Connect** auf **Request
   access** → Bedingungen bestätigen.
   Das wird in der Regel sofort freigeschaltet, keine manuelle Prüfung.

### 2.3 Redirect-URLs und Zugangsdaten

1. Reiter **Auth**.
2. Abschnitt **OAuth 2.0 settings → Authorized redirect URLs for your
   app** → **Add redirect URL** und **beide** LinkedIn-URIs aus
   Abschnitt 0 eintragen:
   ```
   https://learnsphere.one/api/auth/callback/linkedin
   http://localhost:3000/api/auth/callback/linkedin
   ```
3. Oben im selben Reiter unter **Application credentials**:
   - **Client ID** → `AUTH_LINKEDIN_ID`
   - **Primary Client Secret** → `AUTH_LINKEDIN_SECRET`

> Prüfe im Reiter **Auth** unter **OAuth 2.0 scopes**, dass `openid`,
> `profile` und `email` gelistet sind. Sie erscheinen automatisch, sobald
> das Produkt aus 2.2 freigeschaltet ist. Fehlen sie, ist der
> Produkt-Schritt noch nicht durch.

---

## 3. Die Werte eintragen

Es gibt **zwei** Orte, je nachdem, wo du testest. Dieselben vier Werte,
nur eine andere Datei.

### Lokal (Entwicklung)

In `apps/web/.env` (die Datei ist nicht eingecheckt – Vorlage:
`apps/web/.env.example`):

```env
AUTH_GOOGLE_ID="…deine Client-ID…"
AUTH_GOOGLE_SECRET="…dein Google-Secret…"
AUTH_LINKEDIN_ID="…deine LinkedIn Client-ID…"
AUTH_LINKEDIN_SECRET="…dein LinkedIn-Secret…"
```

Danach den Dev-Server neu starten (`npm run dev`), damit die Werte gelesen
werden.

### Produktion (Server)

Auf dem Server in `/opt/learnsphere/apps/web/.env.production` dieselben vier
Zeilen ergänzen bzw. füllen, dann den Container neu starten, damit er die
Umgebung neu einliest:

```bash
cd /opt/learnsphere
nano apps/web/.env.production      # die vier AUTH_…-Zeilen füllen
docker compose up -d web           # Container mit neuer Env neu erstellen
```

> Die Secrets gehören **nur** in diese `.env`-Dateien auf dem jeweiligen
> Rechner – niemals ins Git-Repository und nicht in Chats posten. Landet
> ein Secret doch einmal öffentlich, im Anbieter-Portal ein neues
> erzeugen und das alte widerrufen.

Voraussetzungen, die in Produktion ohnehin schon gesetzt sein sollten
(siehe `.env.example`):

- `AUTH_SECRET` – zufälliger Schlüssel, in Produktion Pflicht.
- `AUTH_TRUST_HOST=true` – nötig, weil die App hinter dem Reverse-Proxy
  läuft; ohne das erkennt Auth.js die Callback-Domain falsch.
- `NEXT_PUBLIC_APP_URL="https://learnsphere.one"` – muss der echten Domain
  entsprechen.

---

## 4. Testen

1. Öffne `https://learnsphere.one/de/login` (bzw. lokal
   `http://localhost:3000/de/login`).
2. Auf **Mit Google anmelden** bzw. **Mit LinkedIn anmelden** klicken.
3. Beim Anbieter zustimmen → du solltest angemeldet zurückkommen.

Beim ersten OAuth-Login gilt die E-Mail automatisch als bestätigt. Meldet
sich jemand mit einer Google-/LinkedIn-Adresse an, für die schon ein
Passwort-Konto besteht, werden beide verknüpft (gleiche E-Mail, vom
Anbieter verifiziert).

---

## 5. Wenn etwas klemmt

| Meldung / Symptom | Ursache & Lösung |
| --- | --- |
| `redirect_uri_mismatch` (Google) | Die aufgerufene Redirect-URI steht nicht exakt in der Liste. Auf Tippfehler, `http` vs. `https` und den genauen Pfad `/api/auth/callback/google` achten. Änderungen greifen bei Google nach ein paar Minuten. |
| `The redirect_uri does not match` (LinkedIn) | Wie oben, aber im Reiter **Auth** des LinkedIn-Portals. |
| Google: „App nicht verifiziert" / nur Testnutzer kommen rein | App ist noch im Test-Status. Entweder das eigene Konto als **Testnutzer** eintragen, oder die App **veröffentlichen** (Abschnitt 1.2). |
| LinkedIn: „scope … is not authorized" | Das Produkt aus 2.2 ist nicht freigeschaltet. Reiter **Products** prüfen. |
| Button bewirkt nichts, keine Weiterleitung | Die `AUTH_…`-Werte sind leer oder wurden nach dem Setzen nicht neu geladen (Dev-Server / Container neu starten). |
| Lokal geht's, in Produktion nicht | In `.env.production` fehlen die Werte, oder `AUTH_TRUST_HOST` / `NEXT_PUBLIC_APP_URL` stimmen nicht. Container neu erstellen (`docker compose up -d web`). |
