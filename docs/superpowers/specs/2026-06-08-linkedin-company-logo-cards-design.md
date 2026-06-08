# LinkedIn-Seamless Add + Company-Logo Cards — Design

**Date:** 2026-06-08
**Status:** Approved for planning

## Goal

Make adding a contact feel effortless: paste a LinkedIn URL and type the
company, and the contact card shows the company's real logo in a brand banner.
No scraping, no API keys, no cost.

## Why not "paste only the LinkedIn URL"

LinkedIn cannot be read from a pasted URL:

- **Browser:** cross-origin requests to linkedin.com are blocked; our page
  cannot read theirs.
- **Server:** logged-out/bot requests hit a login wall and a bot-block status
  (HTTP 999); it also violates LinkedIn's ToS.

So we extract what the URL *does* give us for free — the person's name, from the
profile slug — and get the rest (company logo) from a separate, freely-fetchable
source.

## Scope

In scope:

1. Add-contact form: paste LinkedIn URL → auto-derive the name; type company →
   live logo preview.
2. Company-logo lookup with graceful fallback.
3. Redesigned contact card: company-logo brand **banner** (layout "B" from
   brainstorm).

Out of scope (explicitly):

- Scraping or any paid enrichment API.
- Profile photos (not reliably obtainable without auth).
- A dedicated "headline" field — the card keeps showing `role · company`.

## Components

### 1. Name from LinkedIn slug — `src/lib/linkedin.ts` (new)

`deriveNameFromLinkedInUrl(url: string): string`

- Parse the path segment after `/in/` (also tolerate `/pub/`).
- Strip a trailing hash/id segment (e.g. `-a1b2c3`), split on `-`,
  title-case each token.
- `https://linkedin.com/in/shayne-coplan` → `"Shayne Coplan"`.
- Returns `""` if no slug can be parsed (caller leaves the field for manual
  entry).

### 2. Company-logo lookup — `src/lib/companyLogo.ts` (new)

`companyDomainGuess(company: string): string`
- Lowercase, strip punctuation/spaces, append `.com`
  (`"Polymarket"` → `polymarket.com`). Best-effort only.

`companyLogoUrl(company: string): string`
- `https://logo.clearbit.com/{domain}` for the guessed domain.

Fallback chain is handled in the UI via image `onError` (see card), not by
network probing:
1. Clearbit logo for guessed domain →
2. Google favicon service (`https://www.google.com/s2/favicons?domain={domain}&sz=128`) →
3. Colored initial block (the contact's existing `avatarColor`).

No new fields are added to `Contact`; the domain is derived from `company` at
render time. (If `company` is empty, the card shows the colored initial only.)

### 3. Card redesign — `src/components/ContactCard.tsx`

Layout "B" (brand banner):

- **Banner** (top strip, ~44px, rounded top corners): a per-contact gradient
  picked from a small fixed palette of gradient pairs (e.g. 6–8 entries),
  indexed by a hash of the contact's name (same hashing already used to pick
  `avatarColor`), so each contact is stable and distinct. The company logo
  rendered on top (white-knockout via CSS filter so it reads on any gradient).
  Banner only renders when a company is present; otherwise fall back to today's
  avatar-row layout so logo-less contacts still look right.
- **Body:** name (bold), `role · company` line, score circle (unchanged), tags
  (unchanged), warmth + last-contacted row (unchanged), action note (unchanged).
- A small `<CompanyLogo>` subcomponent encapsulates the image + `onError`
  fallback chain so the card stays readable.

### 4. Add form — `src/components/AddContactModal.tsx`

- LinkedIn URL field: on change/blur, if the **name field is empty**, auto-fill
  it via `deriveNameFromLinkedInUrl` (never overwrite a name the user typed).
- Company field: show a **live logo preview** (~28px) next to the input as the
  user types, using the same `<CompanyLogo>` component.
- No other structural changes; existing AI tag/angle generator stays, optional.

## Data Flow

```
Paste LinkedIn URL ──► deriveNameFromLinkedInUrl ──► Name field (if empty)
Type company ─────────► companyDomainGuess ──► companyLogoUrl ──► live preview
Save ─────────────────► Contact added to Zustand store (unchanged)
Card render ──────────► company present? banner+logo (fallback chain) : avatar row
```

## Error Handling

- Unparseable URL → name left blank, user types it; no error shown.
- Logo 404 / network fail → `onError` advances the fallback chain silently,
  ending at the colored initial. No broken-image icon ever shows.
- Empty company → no banner; card uses the existing avatar-row layout.

## Testing

- `deriveNameFromLinkedInUrl`: standard `/in/` slug, `/pub/`, trailing id hash,
  trailing slash / query string, non-LinkedIn or empty input → `""`.
- `companyDomainGuess`: spaces, punctuation, already-a-domain-ish input.
- Card: renders banner + `<img>` with Clearbit src when company present;
  renders avatar-row (no banner) when company absent.
- Add form: typing a URL into an empty form fills the name; typing a URL when a
  name already exists does **not** overwrite it.

## Open Questions

None.
