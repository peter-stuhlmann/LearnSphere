---
name: learnsphere-api
description: Fetch and display LearnSphere course data in a project. Covers the free public catalog API and the creator API (API plan) including auth, pagination, error handling, and security rules. Use when integrating LearnSphere courses into a website, shop, or app.
---

# LearnSphere API

Integrate LearnSphere course data. Two APIs are available today; both return
JSON (UTF-8) over HTTPS and wrap results in `{ "data": … }`, errors in
`{ "error": "code" }`. Full docs: `/en/api-docs` (or `/de/api-doku`) on the
LearnSphere host.

Base URL:

```
BASE = https://learnsphere.one
```

## Non-negotiable security rules

1. **Never use a creator API key (`ls_…`) in browser code.** It must only
   appear in server-side code, loaded from an environment variable
   (e.g. `LEARNSPHERE_API_KEY`). If the user asks for a client-side
   integration of the creator API, route it through their own server
   endpoint instead.
2. Never commit keys to the repository.
3. Prices are integer **cents** (`priceCents`). Divide by 100 only for
   display; never do float math on prices.
4. Ignore unknown fields in responses (the v1 contract may gain optional
   fields; breaking changes only ever ship as `/v2/`).

## 1. Public catalog API (free, no key)

Only courses that are published **and** listed in the LearnSphere shop.
Rate limit: 60 requests/minute/IP. Responses are cacheable for 60 s.
CORS is open — this API may be called from the browser.

```
GET {BASE}/api/public/v1/courses?q=<search>&page=<n>&per=<1-48>&lang=<de|en>
```

Response:

```json
{
  "data": [
    {
      "id": "…", "slug": "…", "title": "…", "subtitle": "…",
      "language": "de", "priceCents": 4900, "currency": "EUR",
      "creatorName": "…", "sectionCount": 6, "lessonCount": 42,
      "averageRating": 4.8, "reviewCount": 31,
      "url": "https://…/de/courses/<slug>", "createdAt": "ISO-8601"
    }
  ],
  "meta": { "total": 1, "page": 1, "pages": 1, "per": 12 }
}
```

```
GET {BASE}/api/public/v1/courses/{slug}
```

Adds `description` and `sections[]` (each `{ title, lessons: [{ title,
durationSeconds, isPreview }] }`). Curriculum metadata only — no content.

Courses can be multilingual: `language` is the base language, `languages`
lists all available ones. Pass `?lang=<code>` (public + affiliate endpoints)
to get titles/subtitles/descriptions and curriculum titles in that language;
fields without a translation fall back to the base language.

## 2. Creator API (requires API plan + key)

Returns **all** published courses of the key owner, including courses not
listed in the shop. Sales via the returned `url` (contains `?via=api`) are
credited to the creator's own channel (75% share) — always link with that
URL, never strip the query.

```
GET {BASE}/api/v1/courses
GET {BASE}/api/v1/courses/{slug}
Authorization: Bearer ls_<64 hex chars>
```

List items additionally include `listedInShop` and `embedUrl` (iframe
widget). The detail endpoint returns the full curriculum metadata.

Server-side fetch example (Next.js route handler / Node):

```ts
const res = await fetch(`${process.env.LEARNSPHERE_BASE_URL}/api/v1/courses`, {
  headers: { Authorization: `Bearer ${process.env.LEARNSPHERE_API_KEY}` },
  next: { revalidate: 300 }, // Next.js: cache for 5 minutes
});
if (!res.ok) {
  const { error } = await res.json().catch(() => ({ error: "unknown" }));
  // see error table below
}
const { data } = await res.json();
```

## Error handling

| Status | `error` code        | What to do                                        |
| ------ | ------------------- | ------------------------------------------------- |
| 401    | `unauthorized`      | Key missing/invalid/revoked — check env var       |
| 403    | `api_plan_required` | Account has no active API plan — inform the user  |
| 404    | `not_found`         | Course unpublished/removed — hide it gracefully   |
| 429    | `rate_limited`      | Back off and retry after a short delay            |

Degrade gracefully: if the API is unreachable, render a fallback instead of
crashing the page.

## Display guidance

- Format prices with `Intl.NumberFormat(locale, { style: "currency",
  currency })` from `priceCents / 100`; treat `priceCents === 0` as "free".
- `durationSeconds` → format as `m:ss` or `h:mm:ss`.
- `averageRating` may be `null` (no reviews yet) — hide the rating then.
- Link each course card to its `url` so purchases run through the secure
  LearnSphere checkout (payment data never touches your server).

## 3. Affiliate API (requires affiliate program membership + key)

The full shop catalog with personal commission links (15% on referred
sales, valid for any purchase within 7 days of the click). An API plan is
NOT required — only membership in the affiliate program (join at
`/de/partnerprogramm` or `/en/affiliate`).

```
GET {BASE}/api/v1/affiliate/courses?affiliate=true
Authorization: Bearer ls_<64 hex chars>
```

Rules:

- `affiliate=true` is mandatory for the commission: only then the returned
  `url`s carry the affiliate code (`?aff=…`). Without the parameter the
  links are neutral and earn nothing. Never strip the `?aff=` query from
  the URLs when rendering links.
- Response shape matches the public catalog list; `meta.affiliate` echoes
  whether commission links are active.
- 403 `affiliate_membership_required` → the key owner has not joined the
  affiliate program.
- No commission on the affiliate's own purchases or own courses — do not
  try to work around this; it is enforced server-side.
