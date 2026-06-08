# LinkedIn-Seamless Add + Company-Logo Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user add a contact by pasting a LinkedIn URL (name auto-fills from the slug) and typing a company, then show a redesigned card with the company's real logo in a brand banner.

**Architecture:** Three pure helper modules (`linkedin.ts`, `companyLogo.ts`, `cardVisuals.ts`) hold all testable logic. A presentational `CompanyLogo` component renders the logo with a silent image-`onError` fallback chain (Clearbit → favicon → colored initial). `ContactCard` gains a logo banner; `AddContactModal` wires URL→name auto-fill and a live logo preview. No scraping, no API keys, no new `Contact` fields — the company domain is derived at render time.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Zustand. Vitest (added in Task 1) for unit tests of the pure helpers; React components are verified by running the dev server.

---

## File Structure

- Create: `src/lib/linkedin.ts` — `deriveNameFromLinkedInUrl`, `resolveAutoName`
- Create: `src/lib/linkedin.test.ts`
- Create: `src/lib/companyLogo.ts` — `companyDomainGuess`, `companyLogoUrl`, `faviconUrl`
- Create: `src/lib/companyLogo.test.ts`
- Create: `src/lib/cardVisuals.ts` — `bannerGradient`
- Create: `src/lib/cardVisuals.test.ts`
- Create: `src/components/CompanyLogo.tsx` — logo `<img>` with fallback chain
- Modify: `src/components/ContactCard.tsx` — banner layout
- Modify: `src/components/AddContactModal.tsx` — URL→name auto-fill + live preview
- Create: `vitest.config.ts`
- Modify: `package.json` — add `vitest` devDep + `test` script

---

## Task 1: Set up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/smoke.test.ts` (temporary, deleted at end of task)

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install -D vitest@^2
```
Expected: adds `vitest` to devDependencies, no errors.

- [ ] **Step 2: Add the test script**

In `package.json`, add to the `"scripts"` object (after `"lint": "eslint"`):
```json
    "lint": "eslint",
    "test": "vitest run"
```
(Add the trailing comma after the `lint` line.)

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add a temporary smoke test**

Create `src/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test suite**

Run: `npm test`
Expected: PASS — 1 passed (smoke).

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm src/lib/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

## Task 2: Name from LinkedIn URL — `src/lib/linkedin.ts`

**Files:**
- Create: `src/lib/linkedin.ts`
- Test: `src/lib/linkedin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/linkedin.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { deriveNameFromLinkedInUrl, resolveAutoName } from './linkedin';

describe('deriveNameFromLinkedInUrl', () => {
  it('parses a standard /in/ slug', () => {
    expect(deriveNameFromLinkedInUrl('https://linkedin.com/in/shayne-coplan')).toBe('Shayne Coplan');
  });
  it('handles www, trailing slash and query string', () => {
    expect(deriveNameFromLinkedInUrl('https://www.linkedin.com/in/jay-deuskar/?originalSubdomain=us')).toBe('Jay Deuskar');
  });
  it('supports /pub/ paths', () => {
    expect(deriveNameFromLinkedInUrl('https://linkedin.com/pub/ali-hirsa')).toBe('Ali Hirsa');
  });
  it('drops a trailing numeric id token', () => {
    expect(deriveNameFromLinkedInUrl('https://linkedin.com/in/john-smith-12345678')).toBe('John Smith');
  });
  it('drops a trailing alphanumeric id token', () => {
    expect(deriveNameFromLinkedInUrl('https://linkedin.com/in/jane-doe-a1b2c3')).toBe('Jane Doe');
  });
  it('returns empty for non-LinkedIn or empty input', () => {
    expect(deriveNameFromLinkedInUrl('')).toBe('');
    expect(deriveNameFromLinkedInUrl('https://example.com/in/whoever')).toBe('');
  });
});

describe('resolveAutoName', () => {
  it('fills the name when current is empty', () => {
    expect(resolveAutoName('', 'https://linkedin.com/in/shayne-coplan')).toBe('Shayne Coplan');
  });
  it('never overwrites a name the user typed', () => {
    expect(resolveAutoName('Custom Name', 'https://linkedin.com/in/shayne-coplan')).toBe('Custom Name');
  });
  it('leaves blank when current empty and url unparseable', () => {
    expect(resolveAutoName('', 'not a url')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- linkedin`
Expected: FAIL — cannot resolve module `./linkedin`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/linkedin.ts`:
```ts
function titleCase(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/**
 * Extract a person's name from a LinkedIn profile URL slug.
 * Returns '' if no /in/ or /pub/ slug can be parsed.
 */
export function deriveNameFromLinkedInUrl(url: string): string {
  if (!url) return '';
  const match = url.match(/linkedin\.com\/(?:in|pub)\/([^/?#]+)/i);
  if (!match) return '';

  const slug = decodeURIComponent(match[1]);
  const tokens = slug.split('-').filter(Boolean);

  // Drop trailing id-like tokens (LinkedIn appends a numeric/hex id).
  // Names don't contain digits, so a trailing token with a digit is an id.
  while (tokens.length > 1 && /\d/.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.map(titleCase).join(' ');
}

/**
 * Decide the name field value when a URL changes: auto-fill from the URL only
 * when the user hasn't typed a name; never overwrite an existing name.
 */
export function resolveAutoName(currentName: string, url: string): string {
  if (currentName.trim()) return currentName;
  return deriveNameFromLinkedInUrl(url);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- linkedin`
Expected: PASS — all 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/linkedin.ts src/lib/linkedin.test.ts
git commit -m "feat: derive contact name from LinkedIn URL slug"
```

---

## Task 3: Company logo URLs — `src/lib/companyLogo.ts`

**Files:**
- Create: `src/lib/companyLogo.ts`
- Test: `src/lib/companyLogo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/companyLogo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { companyDomainGuess, companyLogoUrl, faviconUrl } from './companyLogo';

describe('companyDomainGuess', () => {
  it('guesses a .com domain from a single-word company', () => {
    expect(companyDomainGuess('Polymarket')).toBe('polymarket.com');
  });
  it('strips spaces and punctuation', () => {
    expect(companyDomainGuess('Prize Picks!')).toBe('prizepicks.com');
  });
  it('passes through an input that is already a domain', () => {
    expect(companyDomainGuess('columbia.edu')).toBe('columbia.edu');
  });
  it('returns empty for empty input', () => {
    expect(companyDomainGuess('')).toBe('');
    expect(companyDomainGuess('   ')).toBe('');
  });
});

describe('companyLogoUrl / faviconUrl', () => {
  it('builds a Clearbit logo URL', () => {
    expect(companyLogoUrl('Polymarket')).toBe('https://logo.clearbit.com/polymarket.com');
  });
  it('builds a favicon URL', () => {
    expect(faviconUrl('Polymarket')).toBe('https://www.google.com/s2/favicons?domain=polymarket.com&sz=128');
  });
  it('returns empty when there is no company', () => {
    expect(companyLogoUrl('')).toBe('');
    expect(faviconUrl('')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- companyLogo`
Expected: FAIL — cannot resolve module `./companyLogo`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/companyLogo.ts`:
```ts
/**
 * Best-effort guess of a company's primary domain from its display name.
 * 'Polymarket' -> 'polymarket.com'. Passes through values that already look
 * like a domain. Returns '' for empty input.
 */
export function companyDomainGuess(company: string): string {
  const c = company.trim().toLowerCase();
  if (!c) return '';
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(c)) return c; // already a domain
  const slug = c.replace(/[^a-z0-9]/g, '');
  return slug ? `${slug}.com` : '';
}

/** Clearbit logo URL for a company, or '' if no company. */
export function companyLogoUrl(company: string): string {
  const domain = companyDomainGuess(company);
  return domain ? `https://logo.clearbit.com/${domain}` : '';
}

/** Google favicon URL (fallback logo source), or '' if no company. */
export function faviconUrl(company: string): string {
  const domain = companyDomainGuess(company);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : '';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- companyLogo`
Expected: PASS — all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/companyLogo.ts src/lib/companyLogo.test.ts
git commit -m "feat: company logo + favicon URL helpers"
```

---

## Task 4: Banner gradient — `src/lib/cardVisuals.ts`

**Files:**
- Create: `src/lib/cardVisuals.ts`
- Test: `src/lib/cardVisuals.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/cardVisuals.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { bannerGradient } from './cardVisuals';

describe('bannerGradient', () => {
  it('returns a CSS linear-gradient string', () => {
    expect(bannerGradient('Shayne Coplan')).toMatch(/^linear-gradient\(120deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
  });
  it('is deterministic for the same name', () => {
    expect(bannerGradient('Jay Deuskar')).toBe(bannerGradient('Jay Deuskar'));
  });
  it('handles an empty name without throwing', () => {
    expect(bannerGradient('')).toMatch(/^linear-gradient/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cardVisuals`
Expected: FAIL — cannot resolve module `./cardVisuals`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/cardVisuals.ts`:
```ts
const GRADIENTS: [string, string][] = [
  ['#1e3a8a', '#3b82f6'],
  ['#7c2d12', '#ea580c'],
  ['#134e4a', '#14b8a6'],
  ['#4c1d95', '#8b5cf6'],
  ['#831843', '#ec4899'],
  ['#064e3b', '#10b981'],
  ['#713f12', '#f59e0b'],
  ['#1e1b4b', '#6366f1'],
];

/** Deterministic per-contact banner gradient, indexed by a hash of the name. */
export function bannerGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const [from, to] = GRADIENTS[Math.abs(hash) % GRADIENTS.length];
  return `linear-gradient(120deg, ${from}, ${to})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- cardVisuals`
Expected: PASS — all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cardVisuals.ts src/lib/cardVisuals.test.ts
git commit -m "feat: deterministic banner gradient helper"
```

---

## Task 5: CompanyLogo component — `src/components/CompanyLogo.tsx`

This is a presentational React component with an image-`onError` fallback chain. There is no DOM test framework configured, so it is verified by rendering in the app (Tasks 6–7). Keep the logic minimal and self-contained.

**Files:**
- Create: `src/components/CompanyLogo.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/CompanyLogo.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { companyLogoUrl, faviconUrl } from '@/lib/companyLogo';

interface Props {
  company: string;
  /** Single-letter fallback shown when no logo resolves. */
  fallbackInitial: string;
  /** Tailwind classes for the fallback initial block (bg + text color). */
  fallbackColor: string;
  /** Tailwind sizing/shape classes applied to the logo + fallback box. */
  className?: string;
  /** White-knockout the logo so it reads on a dark banner. */
  knockout?: boolean;
}

/**
 * Renders a company logo, silently degrading: Clearbit logo -> Google favicon
 * -> a colored initial block. A broken-image icon is never shown.
 */
export default function CompanyLogo({
  company,
  fallbackInitial,
  fallbackColor,
  className = '',
  knockout = false,
}: Props) {
  // stage 0 = Clearbit, 1 = favicon, 2 = initial block
  const [stage, setStage] = useState(0);

  // Reset to the best source whenever the company changes (live preview).
  useEffect(() => {
    setStage(0);
  }, [company]);

  const logo = companyLogoUrl(company);
  const favicon = faviconUrl(company);
  const src = stage === 0 ? logo : stage === 1 ? favicon : '';

  if (!company || !src) {
    return (
      <div className={`flex items-center justify-center font-bold ${fallbackColor} ${className}`}>
        {fallbackInitial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${company} logo`}
      onError={() => setStage((s) => s + 1)}
      className={`object-contain ${className}`}
      style={knockout ? { filter: 'brightness(0) invert(1)' } : undefined}
    />
  );
}
```

- [ ] **Step 2: Type-check the component**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CompanyLogo.tsx
git commit -m "feat: CompanyLogo with logo->favicon->initial fallback chain"
```

---

## Task 6: Redesign ContactCard with logo banner

**Files:**
- Modify: `src/components/ContactCard.tsx`

The card gains a brand banner when the contact has a company. When `company` is empty, it keeps the existing avatar-row layout so logo-less contacts still look right.

- [ ] **Step 1: Add imports**

In `src/components/ContactCard.tsx`, replace the existing import block:
```tsx
import { Contact } from '@/lib/mockData';
import { formatShortDate } from '@/lib/utils';
import TagChip from './TagChip';
```
with:
```tsx
import { Contact } from '@/lib/mockData';
import { formatShortDate } from '@/lib/utils';
import { bannerGradient } from '@/lib/cardVisuals';
import TagChip from './TagChip';
import CompanyLogo from './CompanyLogo';
```

- [ ] **Step 2: Add an initials helper inside the component**

In `ContactCard`, immediately after `const hasAction = !!contact.actionNote;`, add:
```tsx
  const initials = contact.name.split(' ').map((n) => n[0]).join('').slice(0, 2);
  const companyInitial = (contact.company || contact.name).charAt(0).toUpperCase();
  const hasCompany = !!contact.company;
```

- [ ] **Step 3: Replace the top row (avatar + name + score) with a conditional banner header**

Replace this block:
```tsx
      {/* Top row: avatar + name + score */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${contact.avatarColor}`}>
          {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-stone-900 leading-tight truncate">
            {contact.name}
          </p>
          <p className="text-[11px] text-stone-500 leading-tight mt-0.5 truncate">
            {contact.role}{contact.company ? ` · ${contact.company}` : ''}
          </p>
        </div>
        <div className="flex-shrink-0 w-[30px] h-[30px] rounded-full border-[1.5px] border-orange-400 flex items-center justify-center ml-1">
          <span className="text-[11px] font-bold text-orange-500 leading-none">{contact.score}</span>
        </div>
      </div>
```
with:
```tsx
      {/* Brand banner (only when we have a company) */}
      {hasCompany && (
        <div
          className="-mx-3 -mt-3 mb-2 h-11 rounded-t-xl flex items-center px-3"
          style={{ background: bannerGradient(contact.name) }}
        >
          <CompanyLogo
            company={contact.company}
            fallbackInitial={companyInitial}
            fallbackColor="text-white/90"
            className="h-5 max-w-[55%]"
            knockout
          />
        </div>
      )}

      {/* Name + (avatar when no banner) + score */}
      <div className="flex items-start gap-2 mb-2">
        {!hasCompany && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${contact.avatarColor}`}>
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-stone-900 leading-tight truncate">
            {contact.name}
          </p>
          <p className="text-[11px] text-stone-500 leading-tight mt-0.5 truncate">
            {contact.role}{contact.company ? ` · ${contact.company}` : ''}
          </p>
        </div>
        <div className="flex-shrink-0 w-[30px] h-[30px] rounded-full border-[1.5px] border-orange-400 flex items-center justify-center ml-1">
          <span className="text-[11px] font-bold text-orange-500 leading-none">{contact.score}</span>
        </div>
      </div>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify in the app**

Run: `npm run dev`, open the app, look at the pipeline cards.
Expected: contacts with a company (e.g. Polymarket, PrizePicks) show a colored banner with the company logo (or a clean fallback letter if the domain guess misses); the name, `role · company`, score, tags, and warmth row are intact; no broken-image icons. Stop the dev server when done (Ctrl-C).

- [ ] **Step 6: Commit**

```bash
git add src/components/ContactCard.tsx
git commit -m "feat: company-logo brand banner on contact cards"
```

---

## Task 7: Wire AddContactModal — auto name + live logo preview

**Files:**
- Modify: `src/components/AddContactModal.tsx`

- [ ] **Step 1: Add imports**

In `src/components/AddContactModal.tsx`, replace:
```tsx
import { Contact, Status, Priority } from '@/lib/mockData';
import { X, Sparkles } from 'lucide-react';
```
with:
```tsx
import { Contact, Status, Priority } from '@/lib/mockData';
import { resolveAutoName } from '@/lib/linkedin';
import { X, Sparkles } from 'lucide-react';
import CompanyLogo from './CompanyLogo';
```

- [ ] **Step 2: Auto-fill the name when the LinkedIn URL changes**

Replace the `handleChange` function:
```tsx
  function handleChange(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }
```
with:
```tsx
  function handleChange(key: string, value: string) {
    setForm(f => {
      const next = { ...f, [key]: value };
      // When the LinkedIn URL changes, auto-fill the name if it's still blank.
      if (key === 'linkedinUrl') {
        next.name = resolveAutoName(f.name, value);
      }
      return next;
    });
  }
```

- [ ] **Step 3: Add a live logo preview next to the Company field**

Replace the Company field block:
```tsx
            <div>
              <label className={labelClass}>Company *</label>
              <input className={inputClass} placeholder="Polymarket" required value={form.company} onChange={e => handleChange('company', e.target.value)} />
            </div>
```
with:
```tsx
            <div>
              <label className={labelClass}>Company *</label>
              <div className="flex items-center gap-2">
                <CompanyLogo
                  company={form.company}
                  fallbackInitial={(form.company || '?').charAt(0).toUpperCase()}
                  fallbackColor="bg-stone-100 text-stone-400"
                  className="w-9 h-9 rounded-lg border border-stone-200 flex-shrink-0"
                />
                <input className={inputClass} placeholder="Polymarket" required value={form.company} onChange={e => handleChange('company', e.target.value)} />
              </div>
            </div>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify in the app**

Run: `npm run dev`, open the app, click "Add Contact".
- Paste `https://linkedin.com/in/shayne-coplan` into the LinkedIn URL field → the Name field auto-fills "Shayne Coplan".
- Edit the name, then change the URL → your edited name is NOT overwritten.
- Type "Polymarket" into Company → the logo preview appears next to the field.
- Save → the new card shows the company-logo banner.
Stop the dev server when done (Ctrl-C).

- [ ] **Step 6: Commit**

```bash
git add src/components/AddContactModal.tsx
git commit -m "feat: auto-fill name from LinkedIn URL + live company logo preview"
```

---

## Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites (linkedin, companyLogo, cardVisuals).

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors, no lint errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Final commit (if anything was adjusted)**

```bash
git add -A
git commit -m "chore: linkedin company-logo cards — final verification" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** name-from-slug (Task 2), company logo + fallback (Tasks 3, 5), banner card layout B (Tasks 4, 6), add-form URL→name + live preview (Task 7), no new `Contact` fields / domain derived at render (Tasks 3, 6). No scraping, no API key, no headline field — matches spec scope.
- **Fallback chain:** Clearbit → favicon → colored initial, all via image `onError`, no network probing — matches spec error handling.
- **Type consistency:** `CompanyLogo` prop names (`company`, `fallbackInitial`, `fallbackColor`, `className`, `knockout`) are identical in Tasks 5, 6, 7. Helper names (`deriveNameFromLinkedInUrl`, `resolveAutoName`, `companyDomainGuess`, `companyLogoUrl`, `faviconUrl`, `bannerGradient`) are consistent across definition and use.
