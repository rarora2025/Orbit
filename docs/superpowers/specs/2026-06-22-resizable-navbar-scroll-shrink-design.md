# Resizable navbar — scroll-shrink for the app top-bar

**Date:** 2026-06-22
**Status:** Approved

## Goal

Make the app's top-bar (`src/components/Sidebar.tsx`) shrink/compact when the user
scrolls down, inspired by the Aceternity "resizable-navbar" component. Keep the
existing glass/orange look and the existing items (logo, centered Insights /
Dashboard / Chat nav, Clerk profile). The only new behavior is the scroll-shrink.

Out of scope: the Aceternity sliding hover-pill, the mobile hamburger menu, and
switching to the neutral Aceternity styling. No new dependencies (no
framer-motion).

## Key constraint: the window never scrolls

`html`/`body` are `h-full` and the app shell is a fixed-height flex layout. Each
page scrolls inside its *own* inner container(s):

- Insights (`/`): a `overflow-y-auto` card; plus horizontal `overflow-x-auto`
  card rails.
- Dashboard: inner `overflow-y-auto` / `overflow-auto` containers (board, table,
  archived).
- Chat: inner `overflow-y-auto` message list.

A `window`/`document` scroll listener bound the normal way never fires, because
scroll events do not bubble. The design must observe scrolling from arbitrary
inner containers.

## Approach (chosen)

Capture-phase document scroll listener, fully self-contained in `Sidebar.tsx`.

Scroll events do not bubble but *do* fire during the capture phase. A single
`document.addEventListener('scroll', handler, true)` catches scrolling from any
inner container on any page — no changes to page components.

Rejected alternatives:
- Shared zustand `scrolled` state with each page reporting scroll — more invasive,
  couples pages to a navbar concern, no benefit.
- Making the window scroll — large rewrite of the fixed-height app shell.

## Design

### `useScrolled` hook (inside `Sidebar.tsx`)

- Signature: `useScrolled(threshold = 16): boolean`.
- On mount: `document.addEventListener('scroll', onScroll, true)`; remove on
  unmount.
- `onScroll(e)`:
  - Let `el = e.target` as `Element`.
  - Ignore non-vertical scrollers: only act when `el.scrollHeight > el.clientHeight`.
    This skips the horizontal `overflow-x-auto` card rails on Insights so they
    can't wrongly reset the state.
  - Compute `next = el.scrollTop > threshold` and update state only when it
    changes.
- `requestAnimationFrame`-throttled so rapid scroll events collapse to one update
  per frame; cancel any pending frame on unmount.

### Styling changes in `Sidebar.tsx`

Switch the bar from inset-based (`left-3 right-3`) to centered so width can
animate smoothly:

- Container base: `fixed top-3 left-1/2 -translate-x-1/2 z-40` plus a
  `transition-[width,height,padding,background-color,box-shadow]` with the
  existing easing/duration.
- **At top (`scrolled === false`):** `w-[calc(100%-1.5rem)] h-12`, current
  blur/saturate, current shadow, current `bg-white/40`.
- **Scrolled (`scrolled === true`):** `w-full max-w-5xl h-11`, slightly tighter
  horizontal padding, stronger blur/saturate, deeper shadow, and a hair more
  opaque background (e.g. `bg-white/55`).

Everything else is unchanged: logo, absolutely-centered nav group, active orange
pill, Clerk profile + user name.

## Testing

Manual verification:
- Scroll the Insights list, the Dashboard board/table, and the Chat thread → bar
  compacts; scroll back to top → it expands.
- Horizontal card-rail scrolling on Insights does NOT trigger the shrink.
- Resize across breakpoints: centered shrink stays clear of the logo/profile; the
  centered nav group never collides.

`prefers-reduced-motion`: the size change still occurs but the transition is
short; acceptable for this scope.
