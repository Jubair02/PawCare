---
target: whole project UI
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-09-02T10-49-25Z
slug: src-app-page-tsx
---
Method: dual-agent (A: design review · B: detector + evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons and toasts are thorough, but `customer-dashboard.tsx:64` swallows load failure into `console.error`, and the shell's notification poll fails silently. |
| 2 | Match System / Real World | 2 | Raw enums reach end users: `booking-flow.tsx:909` prints `MEDICAL`; the shell avatar badge prints `CUSTOMER` while `ROLE_LABELS` sits unused; "Mobile Banking" in a market that says bKash/Nagad. |
| 3 | User Control and Freedom | 3 | Good `AlertDialog` confirms and working Back via `use-view-url-sync.ts`, but the booking wizard's Cancel discards four steps with no confirm. |
| 4 | Consistency and Standards | 2 | Two step-indicator implementations; `CATEGORY_TILE` duplicated verbatim in three files; role rendered by two different colour systems three feet apart (`StatusBadge` grey vs shell `ROLE_BADGE` violet). |
| 5 | Error Prevention | 2 | The treatment dialog will POST an entirely blank record and irreversibly mark the visit COMPLETED. Validation surfaces as transient toasts, never inline. |
| 6 | Recognition Rather Than Recall | 2 | Booking step 4 shows no summary of the chosen service/pet/provider; the vet writing a treatment sees none of the pet's `medicalNotes` or prior records. |
| 7 | Flexibility and Efficiency | 2 | Zero keyboard shortcuts in authored code. No bulk actions, no column sorting, no server-side paging. "Reports" has no export. |
| 8 | Aesthetic and Minimalist Design | 2 | 10-column payments table exposing raw `invoiceId`/`transactionId`; admin dashboard opens with 6 KPIs + 4 charts + a table and no primary. |
| 9 | Error Recovery | 2 | Every failure is a non-actionable toast carrying a raw server message. A failed payment offers no retry; the dashboard's only recovery is `window.location.reload()`. |
| 10 | Help and Documentation | 1 | No cancellation policy, refund policy, what-to-bring, or support entry point. The clinic phone appears once, at 12px, in the footer. |
| **Total** | | **21/40** | **Needs work** |

## Design Specificity Verdict

**Authored at the domain layer, generic at the interaction layer.** A SaaS admin template could not swap in unchanged — but it could swap in for roughly 60% of the surface area and nobody would notice.

Genuinely product-specific: the vet/groomer polymorphism (one component set serving two professions with no clinical language leaking into the groomer's view), the clinical treatment-record shape, `formatBDT` with `en-IN` grouping, the Dhaka timezone handling, vaccination status on the pet profile, Bengali names throughout.

Category-interchangeable: `globals.css` is the stock shadcn token block with the primary hue rotated to emerald — no type scale, no spacing scale, no elevation or motion tokens, default Geist face. The app shell is the canonical 256px-sidebar dashboard; nothing about it says clinic. Every admin table and chart.

Character left on the table: **urgency has no representation anywhere** — a sick dog and a spa day run through identical steps in identical order. The pet is never the hero in any operate surface; `vet-appointments.tsx`, where the vet actually works, renders the animal as a 36px emoji and leads with a mono timestamp.

**Deterministic scan**: 5 findings, all `warning`/`slop`, zero in `src/app`, zero in vendored `src/components/ui/*`. Three "AI color palette" hits are false positives — the same `CATEGORY_TILE` violet used as one of three service-category encodings — though they incidentally confirm that map is duplicated in three files. One real: gradient-clipped text on live `<h1>` words at `landing-view.tsx:352`. One low-weight: a semantic status border at `vet-schedule.tsx:211` that carries a full `aria-label`, so colour is not the sole channel.

The important synthesis: **the detector is nearly clean, and that is not reassuring.** There are no AI-slop visual tells here. The genericness is structural — in flows and information architecture, where no automated rule looks.

**Visual overlays**: none. No browser automation tool is exposed in this session and no database is reachable, so no live render, no injection, and no user-visible overlay was produced.

## Overall Impression

The domain thinking is better than the interaction design. Someone understood that a groomer is not a vet with different words, and that empty states should teach the data model. That care stops at the component boundary: the flows underneath are stock CRUD, and the one user with the highest stakes — an owner whose animal is sick right now — is the user the product serves worst.

The single biggest opportunity: **give urgency a first-class representation.** It would reshape the booking flow, the vet's queue, the staff dashboard, and the empty states all at once.

## What's Working

1. **The vet/groomer polymorphism is real product thinking, not a role flag.** `vet-dashboard.tsx` forks icon, greeting, stat labels and quick-links on `isVet`; `vet-appointments.tsx` retitles to "Grooming Sessions" with "record notes" instead of "record treatments"; `NAV_ITEMS.GROOMER` swaps Stethoscope for Scissors. It works because a groomer never meets clinical language that would make them feel like a second-class user of a vet tool — the most common way multi-role products feel cheap.

2. **Empty-state copy explains the mechanism instead of naming the void.** "Records appear here after completed appointments — your vet or groomer adds them after each visit." And for cancelled: "Good news — nothing has been cancelled." These teach the data model and set the emotional register in one line.

3. **Accessibility fundamentals are genuinely solid, and that is rare.** All 17 `size="icon"` buttons carry `aria-label`, verified individually. All 8 `<img>` tags have meaningful `alt`. A 44px tap-target floor is applied deliberately at 85 authored call sites. `StepHint` gives every disabled wizard button a stated precondition, which removes the most common wizard dead-end.

## Priority Issues

### [P0] Lists are capped at 200, and the filters meant to rescue you run on the truncated set

Six main list views — `staff-appointments`, `admin-payments`, `staff-payments`, `customer/appointments-view`, `vet-appointments`, `treatments-view` — fetch a bare endpoint with no query params and filter the returned array in `useMemo`. No component sends `offset`, and only four send `limit`-adjacent params at all. The `ListNotice` banner says *"Showing the most recent 200 of 431. Use the filters or search to narrow this list"* — but those filters operate on the 200 already in memory. A front-desk staffer searching for a customer whose appointment is record 250 is told, definitively and wrongly, that it does not exist.

This is a direct consequence of the pagination compromise shipped in the P2 pass: the API was bounded correctly, but the client was left filtering locally, which turned a safety bound into a correctness bug.

**Why it matters**: silently wrong answers in the surface staff use under time pressure. **Fix**: push `status`, `date` and `q` to the API as query params and refetch on change; add offset paging to every table. Until that lands, `ListNotice` must stop claiming filters help.
**Suggested command**: `/impeccable harden`

### [P1] Cash payments are marked PAID before any money moves

`PaymentDialog.handlePay` POSTs the instant the user picks a method and toasts *"Payment successful 🎉"*. Selecting **Cash** produces a `PAID` invoice, flips the appointment to CONFIRMED, and feeds the admin revenue chart — while nobody has handed over a taka. In a market where cash is the default, this corrupts reconciliation and tells the customer something untrue.

**Why it matters**: financial records that don't match reality, and a trust breach at the highest-stakes moment. **Fix**: cash should create a `PENDING` payment with copy like "Pay ৳1,200 at the front desk", and only staff should mark it received. Reserve the success toast for money that actually moved.
**Suggested command**: `/impeccable clarify`

### [P1] The treatment record saves blank, completes the visit irreversibly, and shows the vet no patient context

`vet-appointments.tsx:127-205`. Eight optional fields, none required — `submit()` will POST `{appointmentId}` alone, and the dialog's own description says saving marks the appointment completed. So an accidental empty save irreversibly closes a visit with a blank medical record. Meanwhile the vet writing it cannot see the pet's `medicalNotes` (allergies, chronic conditions), the owner's booking notes, or any prior treatment. And a shadcn `Dialog` closes on Escape or outside-click, so a half-written record vanishes without warning.

**Why it matters**: clinical data integrity, and the most valuable text in the product is the easiest to lose. **Fix**: require diagnosis or plan; render `medicalNotes` and the last treatment read-only inside the dialog; guard close-with-content; separate "Save record" from "Mark completed".
**Suggested command**: `/impeccable harden`

### [P1] The booking flow is built for a spa day, not a sick pet

Four compounding failures on one path. A logged-out owner tapping "Book an appointment" hits `goAuth("register")` — **an account is required before a single slot is visible**. Step 1 is a flat grid of every service with no label meaning *my dog is sick right now*. Step 3 makes you commit to a provider by star rating with **no availability shown**, so choosing wrong costs a back-track. Step 4's zero-slot state says only *"All slots are booked or past. Try another date."* — no next-available date, no alternative provider, no phone number. The clinic's phone exists only in the footer at 12px. Separately, all wizard state lives in local `useState`, so a sidebar click at step 5 discards everything with no confirm.

**Why it matters**: the highest-stakes, lowest-patience user is the one the flow serves worst. **Fix**: add "Soonest available" across all eligible providers; surface the next date with capacity plus a `tel:` link in the empty state; show availability on provider cards; move the register wall to after slot selection; persist wizard state and confirm on cancel.
**Suggested command**: `/impeccable shape`

### [P2] A dark theme and chart tokens that exist, can't be reached, and would break if they were

`globals.css:81` defines 31 dark tokens and `@custom-variant dark`, and 22 `dark:` utilities exist in components. But nothing ever applies `.dark`: `next-themes` is installed yet imported only by `ui/sonner.tsx`, there is no `ThemeProvider`, no toggle, no `classList` manipulation. Against that sit hundreds of light-only literals — `bg-amber-100 text-amber-800` throughout `status-badge.tsx`, `bg-white`/`text-stone-800` in the chart tooltip, `bg-emerald-950` on the landing footer. Meanwhile `--chart-1` … `--chart-5` are defined and ignored: `admin-dashboard.tsx` and `admin-reports.tsx` carry **50 hardcoded hex values plus 4 `rgba()`**, so the charts can never follow a theme.

Related, and cheaper to fix: **`prefers-reduced-motion` is honoured nowhere.** Zero matches across all of `src/`, while framer-motion is imported in 21 component files, the landing hero cards float on `repeat: Infinity`, and every list item animates in.

**Why it matters**: a promise in the codebase the UI cannot keep, plus an accessibility failure for motion-sensitive users. **Fix**: either delete the dark block and chart tokens, or ship a toggle and route palette utilities through semantic tokens. Add a reduced-motion guard regardless.
**Suggested command**: `/impeccable colorize`

## Persona Red Flags

**The distressed pet owner — 9pm, dog vomiting, phone in hand.** Taps "Book an appointment" and is sent to `register` before seeing whether anyone is available (`landing-view.tsx:254`). Four fields later: a flat service grid with prices and star ratings, nothing meaning *urgent* (`booking-flow.tsx:663`). Picks a vet by stars with no availability shown (`:801`). Step 4 finally loads; the clinic closed at 5pm, so she gets *"Try another date."* (`:865`) — no next date, no other provider, no phone. The only clinic number in the authenticated app is `text-xs` in the footer, below the fold.

**The front-desk staffer — 10:15am, three people at the counter, phone ringing.** `staff-appointments.tsx` renders up to **five buttons per row** (`:951`), so a 12-row morning is ~50 competing targets. Booking the caller opens a **4-step dialog** starting with a customer search she must type while holding a phone; if that customer has no pet, step 2 dead-ends with "they must add one first" and offers no way to add it (`:478`). **No keyboard shortcuts exist in authored code** — the only `keydown` handler is in `ui/sidebar.tsx`, which the shell doesn't use. No bulk confirm: ten pending requests are ten dialogs.

**The clinic owner reviewing the month.** `admin-dashboard.tsx` opens with 6 KPI cards, 4 charts and a table — no single answer, and `stat-card.tsx` supports only a static hint, so **no deltas anywhere**. Clicks Reports to pull numbers for the accountant: the only control is Refresh — no date range, no CSV, no print (`admin-reports.tsx:193`). Goes to Payments to reconcile: a 10-column table with raw `invoiceId`/`transactionId`, **no column sorting**, no paging, filtered client-side over the first 200 records (`admin-payments.tsx:229`). Her own profile isn't in the nav — admins get it as a modal behind the avatar.

## Minor Observations

- `profile-view.tsx` passes `user.role` to `StatusBadge`, which has no role entries — renders grey, while the shell's `ROLE_BADGE` colours the identical value violet/teal/emerald. Two colour systems for one datum, visible three feet apart.
- The shell prints the raw enum `{role}` in both badges; `ROLE_LABELS` exists and is used only by auth.
- `CATEGORY_TILE` duplicated verbatim in `landing-view.tsx:82`, `booking-flow.tsx:50`, `appointments-view.tsx:55`.
- The notification bell has two behaviours behind one affordance: customers navigate, everyone else gets a popover.
- `landing-view.tsx` hardcodes "1,200+ Pets cared", "4.9 Avg rating" and a fake "Today · 3:00 PM / Dr. Nusrat Jahan" card, on a page that fetches live providers and reviews two sections below. A visitor who counts three reviews under "120+ verified reviews" has caught the product lying.
- Tap-target minimums use four different conventions (`min-h-11`, `min-h-11 sm:min-h-9`, `min-h-10`, bare `h-9`), and `src/components/ui/*` has zero `min-h-11` — so any unadorned shadcn `<Button>` is 36px. Two password-reveal buttons are 28px (`auth-view.tsx:249`, `:336`).
- Status enums leak inconsistently: `admin-payments.tsx` shows "UNPAID"/"PAID" in caps; `staff-appointments.tsx:1131` renders "CHECKED IN".
- `Toaster` is mounted bare — no position, no duration — while the app routes 100% of error recovery through it.
- The `SiteFooter` portfolio credit appears on every authenticated screen, including staff and admin operate surfaces.

## Questions to Consider

1. **If the pet is the product, why does no operate surface lead with the pet?** `vet-dashboard` renders `pet.photo`; `vet-appointments`, where the vet actually works, does not. What would this feel like if the animal's face were the primary object in every clinical list?
2. **Who is the instant-PAID cash record for** — the customer, the front desk, or the revenue chart?
3. **Were the dark palette and `--chart-1..5` authored, or inherited from `shadcn init` and never removed?** The answer decides whether that's a missing feature or dead weight to delete.
4. **Booking a vomiting dog and booking a spa day run through identical steps in identical order.** What does the flow become if step 0 is "Is this urgent?" — and what does it say that the question was never asked?
5. **The best moment in the product lasts four seconds** before `setView("cust-appointments")` drops the user into a table. If peak-end is real, why does no surface ever say "we'll see you Tuesday"?
