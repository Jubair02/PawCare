# PawCare — Shared Worklog

Multi-agent build of the **Pet Care Platform MVP** (Next.js 16 App Router SPA on `/`, TypeScript, Prisma + SQLite, shadcn/ui).

---

Task ID: 1
Agent: Z.ai (orchestrator)
Task: Foundation — theme, schema, seed, shared libs, contracts

Work Log:
- Designed Prisma schema: User, Pet, Service, Appointment, Treatment, Payment, Review, Notification, Setting (`prisma/schema.prisma`), pushed with `bun run db:push`.
- Seeded rich demo data (`bun prisma/seed.ts`): 8 users (all roles), 6 pets, 8 services, 50 appointments across last 6 months + next 7 days, 46 payments, treatments, reviews, notifications.
- Theme: emerald/teal primary + amber accent set in `src/app/globals.css` (oklch vars). Custom `.scrollbar-thin` utility added.
- `src/lib/password.ts` — sha256 salted hash (`hashPassword`). Seed + login API must use it.
- `src/lib/auth.ts` — ApiError, getAuthUser/requireUser/requireRole (reads `Authorization: Bearer <userId>`), publicUser(), json(), handleError().
- `src/lib/db.ts` — Prisma client as `db`.
- Generated `public/images/hero.png` (1344x768) and `public/images/spa.png` (1024x1024).
- `layout.tsx` metadata = PawCare, Toaster = sonner (toast from "sonner" works globally).
- favicon.svg added.

Stage Summary:
- AUTH MODEL (demo-grade): token = user.id. Client sends header `Authorization: Bearer <token>`. API derives user via requireUser/requireRole.
- DB DATE FORMAT: appointment/payment dates as `yyyy-MM-dd` strings; times as `HH:mm`. formatISO for charts.
- CURRENCY: BDT `৳`.

---

# 📐 CONTRACT (all agents MUST follow)

## Stack rules
- Single user-visible route `/` (src/app/page.tsx). NO new pages. API routes under `src/app/api/**` only.
- Data access: `import { db } from "@/lib/db"`. NEVER edit prisma schema or run db:push (orchestrator only).
- Next.js 16 route handlers: dynamic params are async — `export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> })` then `const { id } = await params;`.
- UI: shadcn/ui (New York) from `src/components/ui` + lucide-react icons + framer-motion for subtle transitions. Tailwind 4.
- Toasts: `import { toast } from "sonner"`.
- NO blue/indigo colors. Palette: primary emerald (`primary`), accent amber-400/500, danger rose-500/600, info teal-600, warn amber-500, success emerald-600, special violet-500. Gradients: `from-emerald-600 to-teal-500`.
- Long lists: `max-h-96 overflow-y-auto scrollbar-thin`. Cards: consistent `p-4`/`p-6`, `gap-4`/`gap-6`. Rounded-2xl for feature cards.
- Money format: `৳1,200` via `formatBDT`. Status text UPPERCASE via StatusBadge.
- Use `next/image` OR plain `<img>` for local images (`/images/hero.png`, `/images/spa.png` exist).
- After finishing your files run `bun run lint` and fix ONLY errors in files you own.

## Design system
- Font: default Geist. Page headers: `text-2xl font-bold tracking-tight` + muted description.
- Sidebar (desktop) + Sheet (mobile) + topbar + sticky footer (`mt-auto`) — handled by AppShell.
- Status colors (badge classes):
  - PENDING: `bg-amber-100 text-amber-800 border-amber-200`
  - CONFIRMED: `bg-emerald-100 text-emerald-800 border-emerald-200`
  - CHECKED_IN: `bg-teal-100 text-teal-800 border-teal-200`
  - IN_PROGRESS: `bg-violet-100 text-violet-800 border-violet-200`
  - COMPLETED: `bg-green-100 text-green-800 border-green-200`
  - CANCELLED: `bg-rose-100 text-rose-800 border-rose-200`
  - UNPAID: amber (same as PENDING), PAID: emerald (same as CONFIRMED), REFUNDED: `bg-stone-100 text-stone-700 border-stone-200`
  - Review APPROVED: emerald, PENDING: amber, HIDDEN: stone.
- Appointment status flow: PENDING → CONFIRMED → CHECKED_IN → IN_PROGRESS → COMPLETED (or CANCELLED).
- Pet types: DOG 🐶, CAT 🐱, BIRD 🐦, OTHER 🐾. Service icons stored in DB `icon` field (emoji).
- Booking hours: from Setting (09:00–17:00, 60-min slots).

## Client libs (created by Task 3 — all UI agents import these)
`src/lib/types.ts` — all DTO interfaces (below).
`src/lib/api.ts`:
```ts
export async function apiFetch<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T>
// adds Authorization: Bearer <token from store>, JSON body, throws Error(res.error) on !ok
```
`src/lib/store.ts` (zustand + persist "pawcare-session", partialize user/token/view):
```ts
export interface AppState {
  user: SessionUser | null;
  token: string | null;
  view: string;
  selectedPetId: string | null;
  authMode: "login" | "register";
  login: (user: SessionUser, token: string) => void; // also sets view = homeViewForRole(user.role)
  logout: () => void; // clears + view="landing"
  setView: (v: string) => void;
  setSelectedPetId: (id: string | null) => void;
  setAuthMode: (m: "login" | "register") => void;
}
export function homeViewForRole(role: Role): string
// ADMIN→admin-dashboard STAFF→staff-dashboard VET/GROOMER→vet-dashboard CUSTOMER→cust-dashboard
```
`src/lib/constants.ts` — NAV per role (view/label/icon), DEMO_ACCOUNTS, STATUS flow arrays, PET_TYPES, SERVICE_CATEGORIES.
`src/lib/formatters.ts` — formatBDT(n), formatDate(yyyy-MM-dd → "20 Nov 2025"), formatTime("14:00"→"2:00 PM"), timeAgo(iso), petEmoji(type), initials(name).
`src/components/shared/`:
- `status-badge.tsx` → `StatusBadge({status}: {status:string})` (handles all statuses above)
- `stat-card.tsx` → `StatCard({title, value, icon?, hint?, tone?}: {title:string; value:string|number; icon?:React.ReactNode; hint?:string; tone?: "default"|"amber"|"rose"|"violet"|"teal"})`
- `empty-state.tsx` → `EmptyState({icon?, title, description?, action?})`
- `section-header.tsx` → `SectionHeader({title, description?, children?})`
- `profile-view.tsx` → `ProfileView()` (edit name/phone/bio via PATCH /api/auth/profile; change password POST /api/auth/change-password; shows role + email)
- `notifications-view.tsx` → `NotificationsView()` (list w/ unread highlight, mark all/one read)

## DTOs (backend MUST return these shapes; UI consumes them)
All dates/ISO strings as noted. Include relations as specified (camelCase).

```ts
type Role = "ADMIN" | "STAFF" | "VET" | "GROOMER" | "CUSTOMER";
type AppointmentStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED";
type PaymentMethod = "CASH" | "CARD" | "MOBILE";

interface SessionUser { id, name, email, role: Role, phone?, specialty?, bio? }
interface UserDTO { id, name, email, role: Role, phone?, specialty?, bio?, active, createdAt, _count?: { pets?, customerAppointments? } }
interface PetDTO { id, name, type, breed?, gender?, birthDate?, weight?, color?, photo?, medicalNotes?, vaccinationStatus?, ownerId, createdAt, owner?: { id, name, email, phone? }, _count?: { appointments? } }
interface ServiceDTO { id, name, category, description, duration, price, icon, active, createdAt, _count?: { appointments? }, rating?: number | null, reviewCount?: number }
interface ProviderDTO { id, name, email, specialty: "VET"|"GROOMER", bio?, phone?, active, rating?: number | null, reviewCount?: number }
interface AppointmentDTO {
  id, date, time, status, paymentStatus, price, notes?, createdAt,
  customer: { id, name, email, phone? },
  pet: { id, name, type, breed?, photo? },
  service: { id, name, category, icon, duration, price },
  provider: { id, name, specialty? },
  treatment?: { id } | null, review?: { id, rating } | null
}
interface TreatmentDTO { id, symptoms?, diagnosis?, treatmentPlan?, prescription?, medication?, dosage?, followUpDate?, notes?, createdAt, appointment: { id, date, time, status }, pet: { id, name, type }, provider: { id, name, specialty? } }
interface PaymentDTO { id, invoiceId, amount, method, transactionId, status, paidAt, customer: { id, name, email }, appointment: { id, date, time, service: { name, icon }, pet: { name } } }
interface ReviewDTO { id, rating, comment?, status, createdAt, customer: { id, name }, pet?: { id, name } | null, service: { id, name, icon }, provider: { id, name, specialty? }, appointment: { id, date } }
interface NotificationDTO { id, title, message, type, read, createdAt }
interface CustomerDashboardData { totalPets, upcomingAppointments, completedServices, pendingPayments, pendingAmount, unreadNotifications, recentAppointments: AppointmentDTO[] (5), nextAppointment: AppointmentDTO | null }
interface ProviderDashboardData { todayAppointments, pendingAppointments, completedToday, totalPatients, todaySchedule: AppointmentDTO[] }
interface StaffDashboardData { todayAppointments, pendingAppointments, checkedInToday, revenueToday, totalCustomers, totalPets, todaySchedule: AppointmentDTO[] }
interface AdminOverviewData {
  totalCustomers, totalPets, todayAppointments, totalRevenue, pendingAppointments, activeProviders,
  appointmentsByMonth: { month: "Feb", count: number }[]  // last 6 months chronological
  revenueByMonth: { month: string, amount: number }[]     // last 6 months chronological
  popularServices: { name: string, count: number }[]      // top 5
  statusDistribution: { status: string, count: number }[] // only non-zero
  recentAppointments: AppointmentDTO[] (6)
}
```

## API CONTRACT (all under /api; JSON; errors `{ error: string }` w/ 4xx/5xx)
Auth: token = user.id, header `Authorization: Bearer <id>`.
- POST /auth/register {name,email,password,phone?} → {user: SessionUser, token} (409 if email exists)
- POST /auth/login {email,password} → {user: SessionUser, token} (401 invalid)
- POST /auth/forgot {email} → {ok, message} (always ok — mock)
- POST /auth/change-password 🔒 {currentPassword,newPassword} → {ok} (400 if current wrong)
- PATCH /auth/profile 🔒 {name?,phone?,bio?,specialty?} → {user: SessionUser}
- GET /users 🔒 ADMIN/STAFF ?role=&q=&active= → {users: UserDTO[]}
- POST /users 🔒 ADMIN {name,email,password,role,phone?,specialty?} → {user}
- PATCH /users/:id 🔒 ADMIN {name?,phone?,role?,specialty?,active?,bio?} → {user}
- DELETE /users/:id 🔒 ADMIN → {ok} (block deleting self/admins)
- GET /pets 🔒 (CUSTOMER→own; ADMIN/STAFF→all ?ownerId=&q=; VET/GROOMER→pets having appointments with them) → {pets: PetDTO[]}
- POST /pets 🔒 CUSTOMER {name,type,breed?,gender?,birthDate?,weight?,color?,photo?,medicalNotes?,vaccinationStatus?} → {pet: PetDTO}
- GET /pets/:id 🔒 owner/ADMIN/STAFF (provider allowed) → {pet: PetDTO & {appointments: AppointmentDTO[], treatments: TreatmentDTO[]}}
- PATCH /pets/:id 🔒 owner/ADMIN → {pet}
- DELETE /pets/:id 🔒 owner/ADMIN → {ok}
- GET /services 🌐 ?active=true&category= → {services: ServiceDTO[]} (with avg APPROVED review rating + reviewCount)
- POST /services 🔒 ADMIN → {service}; PATCH /services/:id 🔒 ADMIN → {service}; DELETE /services/:id 🔒 ADMIN → {ok}
- GET /providers 🌐 ?specialty= → {providers: ProviderDTO[]} (active VET/GROOMER users + approved-review ratings)
- GET /appointments 🔒 scope auto by role; ?status=&date=&from=&to=&q= → {appointments: AppointmentDTO[]} sorted desc by date+time
- GET /appointments/:id 🔒 involved/STAFF/ADMIN → {appointment: AppointmentDTO}
- POST /appointments 🔒 CUSTOMER/STAFF/ADMIN {petId,serviceId,providerId,date,time,notes?} → {appointment} (409 slot taken; validate service/pet ownership for CUSTOMER). Notifications: provider ("New appointment booked"), customer ("Appointment booked" w/ PENDING note), ADMIN+STAFF ("New booking received").
- GET /appointments/slots 🌐 ?providerId=&date= → {slots: string[]} (Setting openTime→closeTime step slotMinutes; exclude booked (non-CANCELLED same provider/date/time); exclude past times today)
- PATCH /appointments/:id 🔒 STAFF/ADMIN or owner (PENDING only) {date?,time?,notes?} → {appointment} (re-validate slot; notify provider+customer "Appointment rescheduled")
- PATCH /appointments/:id/status 🔒 {status} → {appointment}. Rules: CUSTOMER may only set CANCELLED on own; VET/GROOMER/STAFF/ADMIN full flow. Valid transitions: PENDING→CONFIRMED|CANCELLED; CONFIRMED→CHECKED_IN|CANCELLED; CHECKED_IN→IN_PROGRESS|CANCELLED; IN_PROGRESS→COMPLETED. (ADMIN can also allow PENDING→CHECKED_IN walk-in.) Notifications to customer + (when cancelled by customer) provider.
- GET /treatments 🔒 ?petId=&customerId=&providerId= (role-scoped: CUSTOMER→own pets', VET/GROOMER→own, STAFF/ADMIN→all) → {treatments: TreatmentDTO[]}
- POST /treatments 🔒 VET/GROOMER/STAFF/ADMIN {appointmentId, symptoms?, diagnosis?, treatmentPlan?, prescription?, medication?, dosage?, followUpDate?, notes?} → {treatment} (upsert; sets appointment COMPLETED; notification to customer "Treatment record added")
- GET /payments 🔒 scope auto ?status=&method= → {payments: PaymentDTO[]}
- POST /payments 🔒 CUSTOMER/STAFF/ADMIN {appointmentId, method} → {payment, appointment} (mock: PAID, invoiceId INV-<seq>, transactionId TXN<ts><rand>; sets appointment paymentStatus=PAID; if PENDING→CONFIRMED; notifications customer "Payment successful" + ADMIN/STAFF "Payment received")
- PATCH /payments/:id/refund 🔒 ADMIN → {payment} (status REFUNDED + appointment paymentStatus REFUNDED)
- GET /reviews 🌐 ?status=APPROVED|PENDING|HIDDEN|ALL (default APPROVED; 🔒 needed for PENDING/HIDDEN/ALL)&serviceId=&providerId=&mine=true🔒 → {reviews: ReviewDTO[]}
- POST /reviews 🔒 CUSTOMER {appointmentId, rating 1-5, comment?} → {review} (own COMPLETED appointment, 409 if exists; status PENDING)
- PATCH /reviews/:id 🔒 ADMIN {status} → {review}; DELETE /reviews/:id 🔒 ADMIN → {ok}
- GET /notifications 🔒 → {notifications: NotificationDTO[], unread: number}
- POST /notifications/read 🔒 {ids?: string[], all?: boolean} → {ok}
- GET /dashboard/customer 🔒 CUSTOMER → CustomerDashboardData
- GET /dashboard/provider 🔒 VET/GROOMER → ProviderDashboardData
- GET /dashboard/staff 🔒 STAFF → StaffDashboardData
- GET /dashboard/admin 🔒 ADMIN → AdminOverviewData
- GET /settings 🌐 → {setting}; PATCH /settings 🔒 ADMIN → {setting}

## View registry (SPA views — components take NO props, use store for nav/session)
- Public: `landing` → LandingView, `auth` → AuthView
- CUSTOMER: cust-dashboard, cust-pets, cust-pet-detail (uses store.selectedPetId), cust-book, cust-appointments, cust-treatments, cust-payments, cust-reviews, cust-notifications, cust-profile
- VET/GROOMER: vet-dashboard, vet-appointments, vet-patients, vet-treatments, vet-schedule, vet-profile
- STAFF: staff-dashboard, staff-appointments, staff-customers, staff-pets, staff-payments, staff-profile
- ADMIN: admin-dashboard, admin-users, admin-pets, admin-services, admin-appointments, admin-payments, admin-reviews, admin-reports, admin-settings
- cust-notifications/vet-profile/staff-profile reuse shared NotificationsView/ProfileView.
- Shell performs role-guard: if user opens a view outside their role prefix → redirect homeViewForRole.

## Demo accounts (login page shows quick-login chips)
- admin@pawcare.com / admin123 (ADMIN)
- staff@pawcare.com / staff123 (STAFF)
- vet@pawcare.com / vet123 (VET — Dr. Nusrat Jahan)
- groomer@pawcare.com / groomer123 (GROOMER — Sadia Karim)
- customer@pawcare.com / customer123 (CUSTOMER — Rahim Uddin)

## File ownership map (DO NOT touch files you don't own)
- Task 2 (backend): `src/app/api/**` only.
- Task 3 (shell): `src/lib/{types,api,store,constants,formatters}.ts`, `src/components/shared/**`, `src/components/shell/**`, `src/components/landing/**`, `src/components/auth/**`.
- Task 4 (customer): `src/components/customer/**`.
- Task 5 (vet/staff): `src/components/vet/**`, `src/components/staff/**`.
- Task 6 (admin): `src/components/admin/**`.
- Orchestrator only: page.tsx, layout.tsx, globals.css, prisma/*, src/lib/{db,auth,password}.ts.

---

---
Task ID: 3
Agent: full-stack-developer
Task: Client foundation — libs, shared components, shell, landing, auth

Work Log:
- Wrote `src/lib/types.ts`: every contract DTO + Role/status unions + SettingDTO, AuthResponse, ProfileResponse, ForgotResponse, NotificationsResponse, SlotsResponse, OkResponse, PetDetailDTO helpers.
- Wrote `src/lib/api.ts`: `apiFetch<T>(path, {method, body})` — sends `Authorization: Bearer <token>` from store, JSON body, throws `Error(data.error || "Request failed")` on !ok, no-store caching.
- Wrote `src/lib/store.ts`: zustand + persist ("pawcare-session"), partialize {user, token, view, selectedPetId, authMode}; login() sets view=homeViewForRole(role); logout() → landing; exported `homeViewForRole` + `rolePrefixFor`; profile updates via `useAppStore.setState({user})` (contract shape untouched).
- Wrote `src/lib/constants.ts`: NAV_ITEMS per role (customer 9 nav items — cust-pet-detail is programmatic; vet/groomer 6; staff 6; admin 9), ROLE_LABELS, DEMO_ACCOUNTS (5 quick-login accounts, names matched to seed), STATUS_FLOW + STATUS_TRANSITIONS, PET_TYPES (emoji), SERVICE_CATEGORIES, VACCINATION_STATUSES, PAYMENT_METHODS, LANDING_ANCHORS.
- Wrote `src/lib/formatters.ts`: formatBDT (৳ en-IN), formatDate ("20 Nov 2025", tz-safe), formatDateShort, formatTime ("2:00 PM"), timeAgo, dateRelation, petEmoji, initials.
- Shared components: StatusBadge (all contract colors + vaccination statuses), StatCard (5 tones, icon bubble), EmptyState, SectionHeader, ProfileView (PATCH /api/auth/profile + POST /api/auth/change-password, role badge, email, provider specialty select, loading/success toasts), NotificationsView (unread dot + highlight, mark one/all read, icons per type, max-h-96 scrollbar-thin, skeletons) + exported NotificationsMiniList for the shell bell popover.
- `src/components/shell/app-shell.tsx`: hydration gate via useSyncExternalStore (splash = pulsing PawPrint; avoids setState-in-effect lint error); public passthrough for landing/auth; role guard effect (rolePrefixFor → homeViewForRole); desktop w-64 sidebar (brand, active nav = bg-primary/10 text-primary, scrollable nav, user card + logout); sticky topbar (mobile hamburger → Sheet nav, view title, bell with unread badge — customer navigates to cust-notifications, vet/staff/admin get Popover with NotificationsMiniList + mark-all-read, 30s polling); user dropdown (initials avatar, role badge, Profile → <prefix>-profile, admin opens ProfileView in a Dialog since admin has no profile view, Logout); main flex-1 max-w-7xl p-4/p-6; sticky mt-auto footer (clinic tagline + phone from GET /api/settings).
- `src/components/landing/landing-view.tsx`: sticky translucent header (anchors w/ smooth scrollIntoView + mobile Sheet, Log in/Get started, "Go to dashboard" when logged in); hero w/ hero.png, floating next-available + happy-clients cards (subtle framer-motion float), emerald/amber blobs, trust row; 4-stat strip; #services from GET /api/services?active=true (gradient emoji tiles per category, price ৳, duration, rating+reviewCount, Book now → cust-book for logged-in customers else auth, skeletons); #how 4 steps; #team from GET /api/providers (initials avatars, specialty badges, ratings, skeletons); #reviews from GET /api/reviews take 6; gradient CTA banner with spa.png; 3-column emerald-950 footer with contact from GET /api/settings (graceful fallbacks) + bottom bar.
- `src/components/auth/auth-view.tsx`: centered card on gradient w/ blobs, brand header, controlled Tabs from store authMode; login (show/hide eye, forgot panel → POST /api/auth/forgot → toast + back), register (min 6 validation → POST /api/auth/register → login + welcome toast), "Quick demo access" 5 role-colored chips with per-chip spinners; loading states on all buttons; back-to-home.
- `bun run lint` → clean; tsc --noEmit → no errors in owned files. Fixed react-hooks/set-state-in-effect by replacing mounted useState with useSyncExternalStore hydration flag.

Stage Summary:
- Files created: src/lib/{types,api,store,constants,formatters}.ts, src/components/shared/{status-badge,stat-card,empty-state,section-header,profile-view,notifications-view}.tsx, src/components/shell/app-shell.tsx, src/components/landing/landing-view.tsx, src/components/auth/auth-view.tsx.
- Named exports — types.ts: all Role/status types, SessionUser, UserDTO, PetDTO, ServiceDTO, ProviderDTO, AppointmentDTO, TreatmentDTO, PaymentDTO, ReviewDTO, NotificationDTO, SettingDTO, AuthResponse, ForgotResponse, ProfileResponse, CustomerDashboardData, ProviderDashboardData, StaffDashboardData, AdminOverviewData, NotificationsResponse, SlotsResponse, OkResponse, PetDetailDTO. api.ts: apiFetch. store.ts: AppState, useAppStore, homeViewForRole, rolePrefixFor. constants.ts: NavItem, NAV_ITEMS, ROLE_LABELS, DemoAccount, DEMO_ACCOUNTS, STATUS_FLOW, STATUS_TRANSITIONS, Option, PET_TYPES, SERVICE_CATEGORIES, VACCINATION_STATUSES, PAYMENT_METHODS, LANDING_ANCHORS. formatters.ts: formatBDT, formatDate, formatDateShort, formatTime, timeAgo, dateRelation, petEmoji, initials. shared: StatusBadge, StatCard(+StatTone), EmptyState, SectionHeader, ProfileView, NotificationsView, NotificationsMiniList. shell: AppShell. landing: LandingView. auth: AuthView.
- Deviations: (1) admin Profile opens ProfileView in a Dialog (no admin-profile view exists in registry — role guard still passes "admin-*"); (2) NAV_ITEMS customer has 9 entries (cust-pet-detail reached programmatically, per view registry having 10 views); (3) store exposes extra helper rolePrefixFor; (4) landing "Book now" sends logged-in customers to cust-book instead of auth.
- Note for orchestrator: page.tsx should render `<AppShell>{viewSwitch(view)}</AppShell>`; public views landing/auth render standalone (AppShell passes children through when !user or view is landing/auth). /api/settings 404 observed during build (Task 2 pending) — landing/shell fail gracefully.
---
Task ID: 2
Agent: full-stack-developer (completed + verified by orchestrator)
Task: Backend API routes

Work Log:
- Created all 30 route files under src/app/api/** per contract (auth, users, pets, services, providers, appointments + slots + status, treatments, payments + refund, reviews, notifications + read, dashboards x4, settings) with shared shaping helpers in src/app/api/_lib/shape.ts.
- Agent hit context deadline before self-verification; orchestrator verified via curl: login/register OK, services list w/ ratings OK, customer dashboard OK, pets OK, slots OK (09:00-16:00 respecting bookings), notifications OK, admin dashboard OK (6-month buckets, popular services, status distribution).

Stage Summary:
- All API endpoints from contract exist and function. Auth: Bearer <userId>. Errors: {error} with 4xx/5xx. Never verified: refund, review moderation, treatment create, reschedule — implementers of UI should test these paths; endpoints follow contract.
- Note: orchestrator re-seeded DB after agent finished (fixed seed PRNG short-cycle bug that skewed service/time distribution). Data now: 54 appointments over 6 months + next 7 days, varied statuses/payment methods/times.

---

---
Task ID: 4-b
Agent: Z.ai Code (customer-module finisher)
Task: Customer module — create the 4 remaining views (appointments, treatments, payments, reviews)

Work Log:
- Read worklog CONTRACT + studied existing conventions (api.ts, store.ts, types.ts, formatters.ts, shared components, pets-view.tsx, booking-flow.tsx) before writing any code. Only created the 4 missing files; no existing file touched.
- `src/components/customer/appointments-view.tsx` → `CustomerAppointmentsView`: GET /api/appointments; Tabs Upcoming (dateRelation !== past && status not CANCELLED/COMPLETED) / Completed / Cancelled / All with live counts in labels; Card rows with category-gradient service icon tile, pet emoji+name · provider, formatDate+formatTime+duration, StatusBadge (status) + StatusBadge (paymentStatus) + formatBDT price. Row actions: "Pay now" (UNPAID && not CANCELLED/COMPLETED → Dialog RadioGroup CASH/CARD/MOBILE from PAYMENT_METHODS → POST /api/payments → toast "Payment successful 🎉"), "Reschedule" (PENDING → Dialog with date Input min=today + slot pills from GET /api/appointments/slots?providerId=&date= (seeded with appointment.date unless past) → PATCH /api/appointments/:id {date,time} → toast), "Cancel" (PENDING/CONFIRMED → AlertDialog destructive → PATCH /api/appointments/:id/status {status:"CANCELLED"} → toast), "Review" (COMPLETED && !review → Dialog with 5 amber star button selector + optional comment textarea → POST /api/reviews {appointmentId,rating,comment} → toast "Review submitted"), "Details" (Dialog with all fields: service/pet/provider/customer/date/time/status/payment/price/notes + treatment & review presence incl. star rating). Skeletons while loading, per-tab EmptyState with "Book an appointment" CTA → setView("cust-book"), refetch (loadAppointments) after every mutation, framer-motion fade-in rows, min-h-11 touch targets, Loader2 spinners on pending buttons.
- `src/components/customer/treatments-view.tsx` → `CustomerTreatmentsView`: GET /api/treatments; grouped by pet (Map by pet.id, first-seen order) with 🐶/🐱 section headers + record counts; record Card: appointment date·time + StatusBadge, provider label+name, diagnosis semibold with Stethoscope icon, Symptoms/Treatment plan/Prescription dl sections, medication + dosage chips (muted pills) and follow-up date amber chip, notes italic; per-pet card stack wrapped in max-h-96 overflow-y-auto scrollbar-thin; skeleton groups; EmptyState "No treatment records yet — records appear after completed appointments".
- `src/components/customer/payments-view.tsx` → `CustomerPaymentsView`: GET /api/payments; 3 summary StatCards (Total paid = Σ amount where PAID + Receipt icon, Invoices count + FileText teal, Last payment date + CalendarDays amber); status Select filter All/PAID/REFUNDED in SectionHeader; Table (hidden md:block) with invoiceId font-mono, paidAt date, service icon+name, pet, amount formatBDT primary, method label map (CASH→Cash/CARD→Card/MOBILE→Mobile Banking), transactionId font-mono text-xs, StatusBadge; stacked motion Cards on mobile with the same fields; note: paidAt is an ISO DateTime (Prisma) → sliced to yyyy-MM-dd before formatDate; skeletons; EmptyState with per-filter copy.
- `src/components/customer/reviews-view.tsx` → `CustomerReviewsView`: GET /api/reviews?mine=true; SectionHeader + Button "Review a completed visit" → setView("cust-appointments"); 2-col Card grid: service icon tile + name, provider · visit date, 5-star row (filled amber for rating), comment in curly quotes, StatusBadge (PENDING/APPROVED/HIDDEN), "Written {timeAgo(createdAt)}"; skeletons; EmptyState "You haven't written any reviews yet" with CTA.
- Verified against live API with curl (customer@pawcare.com): /api/appointments (21), /api/reviews?mine=true (11), /api/payments (19, ISO paidAt), /api/treatments (8, grouped Bruno/Momo, all fields present).
- `bun run lint` → clean (no output); `bunx tsc --noEmit` → no errors in owned files (remaining tsc output only from pre-existing examples/ and skills/ folders, not mine).

Stage Summary:
- Files created: src/components/customer/{appointments-view,treatments-view,payments-view,reviews-view}.tsx — exports CustomerAppointmentsView, CustomerTreatmentsView, CustomerPaymentsView, CustomerReviewsView (all no-prop, store-driven navigation).
- Customer module (Task 4) is now complete: 8/8 files (pets-view, pet-detail-view, customer-dashboard, booking-flow + these 4). All views follow the shared conventions: apiFetch + DTO types from lib, StatusBadge-only status colors, formatBDT/formatDate/formatTime/timeAgo/petEmoji, EmptyState/SectionHeader/StatCard, sonner toasts, framer-motion subtle entrances, p-4/p-6 cards + gap-4/6, min-h-11 buttons, max-h-96 scrollbar-thin long lists.
- Note for orchestrator: view switch in page.tsx can now map cust-appointments → CustomerAppointmentsView, cust-treatments → CustomerTreatmentsView, cust-payments → CustomerPaymentsView, cust-reviews → CustomerReviewsView.
---
Task ID: 6-b
Agent: Z.ai (admin module finisher)
Task: Admin module — create the 7 remaining admin views (pets, services, appointments, payments, reviews, reports, settings)

Work Log:
- Read contract + conventions (admin-dashboard.tsx chart patterns/colors, admin-users.tsx table/dialog/switch patterns, shared components, libs) before writing.
- `src/components/admin/admin-pets.tsx` → `AdminPetsView`: GET /api/pets (server ?q= debounced) + client type filter (All/DOG/CAT/BIRD/OTHER); desktop table (emoji tile+name+breed, type badge, owner name+email, gender, age from birthDate via local calcAge, weight, vaccination StatusBadge, visits _count.appointments, registered date) / mobile cards; row (and card) click → detail Dialog with full info, medicalNotes (amber callout), owner contact block (initials avatar, email, phone), visits + registered; EmptyState; Refresh button.
- `src/components/admin/admin-services.tsx` → `AdminServicesView`: GET /api/services (admin sees all incl. inactive + _count + rating); desktop table (icon tile, name+description, category badge MEDICAL/GROOMING/DIAGNOSTIC emerald/amber/teal, duration, formatBDT price, 5-star amber rating + reviewCount, bookings, active Switch → PATCH {active}) / mobile cards; Add/Edit shared Dialog (name*, category tile-group Select buttons, description Textarea*, duration/price number inputs with validation, 9-preset emoji icon grid [🩺💉🦷✂️🛁🐕🏥🧪🐾], active Switch) → POST /api/services or PATCH /api/services/:id; Delete AlertDialog destructive → DELETE, 409/deactivate error mapped to toast "Service has bookings — deactivate instead"; refetch after every mutation.
- `src/components/admin/admin-appointments.tsx` → `AdminAppointmentsView`: GET /api/appointments with server ?status= (Select incl. All) + ?date= (date input), client-side search across customer/pet/service/provider; summary chips (total + per-status StatusBadge chips with counts, from loaded set); desktop table (date+time, customer+email, pet emoji, service icon+name, provider, price, StatusBadge, payment StatusBadge, Actions DropdownMenu) / mobile cards; DropdownMenu = View details + valid transitions only (STATUS_TRANSITIONS: PENDING→CONFIRMED/CANCELLED, CONFIRMED→CHECKED_IN/CANCELLED, CHECKED_IN→IN_PROGRESS/CANCELLED, IN_PROGRESS→COMPLETED) via PATCH /api/appointments/:id/status, CANCELLED item styled rose; Details Dialog with all fields incl. notes, price, treatment/review flags, booking ref; refetch + optimistic status sync in open dialog.
- `src/components/admin/admin-payments.tsx` → `AdminPaymentsView`: GET /api/payments (fetch all, filters client-side so stats stay global); 4 StatCards (Total Revenue sum PAID, This Month sum PAID via paidAt month check, Transactions count, Refunded sum) + status/method Select filters; desktop table (invoiceId font-mono, paidAt formatDate, customer+email, service icon+name, pet, amount formatBDT, method label Cash/Card/Mobile Banking, transactionId font-mono text-xs, StatusBadge) / mobile cards; Refund button only when status==="PAID" → AlertDialog warning → PATCH /api/payments/:id/refund → toast + refetch; two-level EmptyState (none at all vs none matching filters).
- `src/components/admin/admin-reviews.tsx` → `AdminReviewsView`: GET /api/reviews?status=ALL; filter tabs All/Pending/Approved/Hidden with count badges, Pending count highlighted amber when >0; review cards in responsive grid (framer-motion subtle fade-in): 5-star amber row, comment, service icon+name, provider (+specialty), customer+pet, appointment date + timeAgo, StatusBadge; actions — Approve (PATCH {status:"APPROVED"}) when PENDING/HIDDEN, Hide (PATCH {status:"HIDDEN"}) when APPROVED/PENDING, Delete AlertDialog → DELETE /api/reviews/:id; per-tab EmptyStates; refetch.
- `src/components/admin/admin-reports.tsx` → `AdminReportsView`: GET /api/dashboard/admin; insight KPI row (Revenue ৳, Bookings 6-mo sum, Avg booking value revenue÷bookings, Cancellation rate cancelled÷statusTotal %, Completion rate completed÷statusTotal %); charts replicating admin-dashboard styling exactly (same ChartTip white card, CartesianGrid #e7e5e4, axis tick fills, unique gradient id revGradReport): revenue AreaChart emerald gradient, bookings BarChart emerald, service-popularity donut PieChart with palette emerald #10b981 / amber #f59e0b / teal #0d9488 / violet #8b5cf6 / rose #f43f5e, status distribution as horizontal stacked Bar (layout vertical, one Bar per present status, exact STATUS_COLORS hexes) + custom dot legends; monthly breakdown table (month, bookings, revenue ৳, totals row). No blue/indigo anywhere.
- `src/components/admin/admin-settings.tsx` → `AdminSettingsView`: GET /api/settings → SettingDTO; two form Cards — Clinic info (clinicName, address, phone, email) + Booking schedule (openTime/closeTime input type="time", slotMinutes number + hint "minutes per appointment slot"); Save (disabled+Loader2 while saving, ADMIN-only guard via store role, validates clinicName/slot 10–240/close>open) → PATCH /api/settings → toast.success("Settings saved") + refetch; derived preview strip "Customer booking preview: Open daily 9:00 AM – 5:00 PM • 60-min slots" via formatTime; loading skeletons.
- Verified against live backend with curl (admin token): pets (owner + _count.appointments), services (all + rating + _count), appointments ?status=, payments (ISO paidAt), reviews?status=ALL, dashboard/admin buckets, settings; reversible PATCH /api/services/:id {active} toggle round-trip OK.
- `bun run lint` clean; `bunx tsc --noEmit` — no errors in src/ (only pre-existing errors in examples/ + skills/, not owned). No existing files modified.

Stage Summary:
- Files created (7/7 — admin module complete): src/components/admin/{admin-pets,admin-services,admin-appointments,admin-payments,admin-reviews,admin-reports,admin-settings}.tsx.
- Named exports: AdminPetsView, AdminServicesView, AdminAppointmentsView, AdminPaymentsView, AdminReviewsView, AdminReportsView, AdminSettingsView (all no-prop client components; store-driven, apiFetch-based).
- Conventions honored: StatusBadge-only status colors in tables (chart hexes only inside recharts, mirroring admin-dashboard), formatBDT/formatDate/formatTime/timeAgo/petEmoji/initials, EmptyState/SectionHeader/StatCard, sonner toasts, AlertDialog destructive rose-600, min-h-10 buttons, p-4/p-6 cards + gap-4/6, max-h-96 overflow-y-auto scrollbar-thin long tables, desktop-table/mobile-card responsive split, skeletons + error toasts + retry, refetch after mutations, no blue/indigo.
- Note for orchestrator: wire view switch in page.tsx — admin-pets → AdminPetsView, admin-services → AdminServicesView, admin-appointments → AdminAppointmentsView, admin-payments → AdminPaymentsView, admin-reviews → AdminReviewsView, admin-reports → AdminReportsView, admin-settings → AdminSettingsView.
Task ID: 5-b
Agent: Z.ai Code (vet/staff UI finisher)
Task: Finish vet module (3 missing files) + build staff module (5 files)

Work Log:
- Read contract in worklog.md + libs (api/store/types/formatters/constants), shared components, and finished patterns in vet-dashboard/vet-appointments (fetch via useCallback+apiFetch, errMsg helper, Dialog DetailRow pattern, AlertDialog destructive, spinner-on-pending buttons, refetch-after-mutation).
- `src/components/vet/vet-patients.tsx` → `VetPatientsView`: GET /api/pets (provider-scoped) → patient cards (photo or petEmoji emerald→teal gradient tile, name, breed + type badge from PET_TYPES, owner, "{_count.appointments} visits", vaccination StatusBadge); client search (name/breed/owner); card click → Dialog with profile (gender, age from birthDate yr/mo calc, weight, color, vaccination badge, medicalNotes) + treatment history via GET /api/treatments?petId= (max-h-96 overflow-y-auto scrollbar-thin: date, diagnosis, provider w/ "Dr."/"Groomer" label); loading skeletons + dialog spinner + empty states; role-aware titles VET→"Patients" / GROOMER→"Grooming clients".
- `src/components/vet/vet-treatments.tsx` → `VetTreatmentsView`: GET /api/treatments (role-scoped) → record cards: date+time tile, petEmoji+name, provider, appointment StatusBadge; diagnosis semibold; symptoms/plan/prescription labeled; medication·dosage emerald chip, follow-up amber chip (formatDate), notes italic; empty state "Create records from Appointments when completing a visit"; role-aware (VET→Treatments, GROOMER→"Session records" + Scissors icon).
- `src/components/vet/vet-schedule.tsx` → `VetScheduleView`: week planner anchored on Monday (anchor useState, prev/next ±7d, "This week" reset); GET /api/appointments?from=&to= (week bounds yyyy-MM-dd); header formatDate(start)–formatDate(end) + count; grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3, day columns w/ weekday+day-number, today ring-2 ring-primary bg-primary/5; per-appointment chips (time chip, pet name+emoji, service icon, owner) with contract left-border status colors (PENDING amber-400, CONFIRMED emerald-400, CHECKED_IN teal-400, IN_PROGRESS violet-400, COMPLETED green-400, CANCELLED rose-300 opacity-70); chip click → details Dialog (all fields incl. owner phone/email, payment badge, price, duration, notes); 7-column skeletons; empty-week EmptyState.
- `src/components/staff/staff-dashboard.tsx` → `StaffDashboard`: GET /api/dashboard/staff → SectionHeader "Front desk overview"; 4 StatCards (Today's Appointments, Pending Confirmations amber, Checked-in teal, Revenue Today formatBDT violet) + 2 secondary (Total Customers, Total Pets); quick-action outline buttons (New appointment→staff-appointments, Customers→staff-customers, Payments→staff-payments); todaySchedule list (time chip, customer, pet+service, StatusBadge, "Check in" button on CONFIRMED rows → PATCH /api/appointments/:id/status CHECKED_IN → toast + refetch, per-row spinner); skeletons + EmptyState with New appointment CTA.
- `src/components/staff/staff-appointments.tsx` → `StaffAppointmentsView`: filters (status Select ALL+6, optional date input w/ Clear, search customer/pet/service) + "New appointment" → CreateAppointmentDialog 4-step wizard (single dialog, step state, numbered indicator w/ Check marks): (1) customers GET /api/users?role=CUSTOMER&q= debounced 300ms, initials rows w/ pet counts; (2) pets GET /api/pets?ownerId= — empty → amber hint "This customer has no pets — they must add one first" + Next blocked; (3) services GET /api/services?active=true cards + providers GET /api/providers?specialty=GROOMER|VET (derived from category GROOMING); (4) date input (min today) + GET /api/appointments/slots?providerId=&date= slot pills + notes → POST /api/appointments {customerId,petId,serviceId,providerId,date,time,notes} → toast + refetch + close; list = Table md+ (when/customer/pet/service/provider/status/payment/price/actions, row-click details) + mobile cards; status actions: Confirm/Decline (PENDING, decline via AlertDialog), Check in (CONFIRMED), Start (CHECKED_IN), Complete (IN_PROGRESS), Cancel (AlertDialog), Reschedule (PENDING → Dialog date+slots → PATCH /api/appointments/:id), Record payment (UNPAID & !CANCELLED/COMPLETED → Dialog RadioGroup CASH/CARD/MOBILE → POST /api/payments); DetailsDialog shared (status+payment badges, customer phone/email, notes); busyId spinner per action; refetch after every mutation.
- `src/components/staff/staff-customers.tsx` → `StaffCustomersView`: GET /api/users?role=CUSTOMER&q= w/ 300ms debounce → cards (gradient initials avatar, name, email, phone, "{_count.pets} pets", joined timeAgo); click → Dialog: pets via GET /api/pets?ownerId= (mini cards + vaccination badge) + recent appointments (GET /api/appointments → client filter by customerId, latest 5, max-h-96 scrollbar-thin rows: date·time chip, service+pet, StatusBadge); skeletons + empty states.
- `src/components/staff/staff-pets.tsx` → `StaffPetsView`: GET /api/pets → Table md+ (pet emoji+name+breed, type badge, owner, vaccination StatusBadge, visits, registered formatDate(createdAt)) / cards mobile; search (name/breed/owner) + type Select from PET_TYPES; click → Dialog full info (gender, age, weight, color, vaccination, visits, registered, medicalNotes, owner contact name/phone/email); skeletons + empty state.
- `src/components/staff/staff-payments.tsx` → `StaffPaymentsView`: GET /api/payments → 4 StatCards computed client-side (Total Collected = Σ PAID, Collected Today = Σ PAID w/ paidAt date = today, Transactions count, Refunded Σ); filters (status Select UNPAID/PAID/REFUNDED, method Select CASH/CARD/MOBILE w/ PAYMENT_METHODS labels) + "x of y shown"; Table md+ (invoiceId mono, paidAt date+time+timeAgo, customer name+email, service+icon, pet, amount formatBDT, method label, transactionId mono, StatusBadge) / mobile cards; Info Alert "Record payments from the Appointments page"; empty states.
- Conventions: "use client", useCallback load + useEffect void, toast.error(errMsg), Skeletons everywhere, StatusBadge-only status colors (schedule chips use contract left-border exceptions), max-h-96 overflow-y-auto scrollbar-thin long lists, ≥44px dialog/footer buttons (min-h-11 sm:min-h-9) & 44px list rows, framer-motion subtle card fades, no blue/indigo.
- `bun run lint` → clean; `bunx tsc --noEmit` → no errors in src/** (only pre-existing examples/skills errors outside scope). dev.log healthy.

Stage Summary:
- Files created (8): src/components/vet/{vet-patients,vet-treatments,vet-schedule}.tsx, src/components/staff/{staff-dashboard,staff-appointments,staff-customers,staff-pets,staff-payments}.tsx.
- Named exports — vet: VetPatientsView, VetTreatmentsView, VetScheduleView; staff: StaffDashboard, StaffAppointmentsView, StaffCustomersView, StaffPetsView, StaffPaymentsView. All take NO props (store-driven nav per contract view registry).
- Vet module now complete: vet-dashboard, vet-appointments, vet-patients, vet-treatments, vet-schedule (vet-profile = shared ProfileView). Staff module complete: staff-dashboard, staff-appointments, staff-customers, staff-pets, staff-payments (staff-profile = shared ProfileView).
- Notes for orchestrator: view switch should map vet-patients→VetPatientsView, vet-treatments→VetTreatmentsView, vet-schedule→VetScheduleView, staff-dashboard→StaffDashboard, staff-appointments→StaffAppointmentsView, staff-customers→StaffCustomersView, staff-pets→StaffPetsView, staff-payments→StaffPaymentsView. POST /api/appointments ignores customerId (derives owner from pet) — sent anyway per spec, harmless. No existing files modified.
---
---
Task ID: 7+8
Agent: Z.ai (orchestrator)
Task: Integration + browser verification

Work Log:
- Wired src/app/page.tsx SPA view registry (35 views: landing, auth, 10 customer, 6 vet, 6 staff, 9 admin) inside AppShell; fixed shared component imports.
- Fixed defects found during verification: missing PawPrint import (pets-view), unused eslint-disable directives, duplicate hint props after title shortening, truncated KPI labels (shortened titles + responsive grid + wrap instead of truncate).
- Re-seeded twice: fixed seed PRNG short-cycle bug (mulberry32); extended upcoming horizon to +14/+30/+45 days so dashboards always show upcoming bookings; final seed = 62 appointments, 49 payments.
- Browser-verified via agent-browser (desktop 1280 + mobile 375): landing render, demo-chip login x4 roles, customer booking wizard 5 steps -> mobile-banking payment -> auto-confirm, vet accept -> check-in -> start -> treatment record (auto-complete), staff dashboard + today schedule, admin dashboard 4 charts + review moderation (approve) + KPI polish, register (201/409), forgot password, notifications badge increments, sticky footer, no console/page errors.

Stage Summary:
- All MVP phases (1-12) from the user's spec are implemented and browser-verified on the golden paths.
- Known demo-grade simplifications: auth token = user id (no JWT expiry), mock payment processing, in-app notifications only (per spec MVP).
