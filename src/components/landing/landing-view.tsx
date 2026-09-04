"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  Clock,
  CalendarPlus,
  Mail,
  MapPin,
  Menu,
  PawPrint,
  Phone,
  Search,
  Sparkles,
  Star,
  Stethoscope,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";
import { LANDING_ANCHORS, categoryTile } from "@/lib/constants";
import { formatBDT, formatTime, initials } from "@/lib/formatters";
import { homeViewForRole, useAppStore } from "@/lib/store";
import type { ProviderDTO, ReviewDTO, ServiceDTO, SettingDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { SiteFooter } from "@/components/shared/site-footer";

// ---------- helpers ----------

function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i < Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

const CATEGORY_BADGE: Record<string, string> = {
  MEDICAL: "bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-200 border-teal-200 dark:border-teal-900",
  GROOMING: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-900",
  DIAGNOSTIC: "bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-200 border-violet-200 dark:border-violet-900",
};

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- sections ----------

interface StatItem {
  value: string;
  label: string;
  icon: LucideIcon;
}

// The stats strip is derived from live data at render time. It used to be a
// hardcoded list ("1,200+ pets cared", "4.9 avg rating") sitting directly above
// the real services, providers and reviews this page fetches — a visitor who
// counted the reviews on screen caught the number out.

const STEPS: { title: string; description: string; icon: LucideIcon }[] = [
  { title: "Search service", description: "Browse vet consultations, grooming, diagnostics and more.", icon: Search },
  { title: "Choose pet", description: "Pick the companion that needs care — or add a new one.", icon: PawPrint },
  { title: "Pick date & time", description: "See live availability per provider and grab a slot.", icon: CalendarClock },
  { title: "Pay & relax", description: "Pay by cash, card or mobile banking after the visit.", icon: Wallet },
];

function ServiceCard({
  service,
  onBook,
}: {
  service: ServiceDTO;
  /** Omitted for viewers who cannot book (staff, vets, admins). */
  onBook?: () => void;
}) {
  return (
    <Card className="gap-3 p-4 transition-shadow hover:shadow-md h-full">
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm",
            categoryTile(service.category)
          )}
          aria-hidden
        >
          {service.icon || "🐾"}
        </div>
        <Badge variant="outline" className={CATEGORY_BADGE[service.category] ?? ""}>
          {service.category}
        </Badge>
      </div>
      <h3 className="font-semibold leading-tight">{service.name}</h3>
      <p className="line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3.5" />
          {service.duration} min
        </span>
        <span className="font-bold text-primary">{formatBDT(service.price)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {service.rating ? (
          <>
            <Stars value={service.rating} />
            <span>
              {service.rating.toFixed(1)} ({service.reviewCount ?? 0})
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1">
            <Star className="size-3.5 text-amber-400" /> New service
          </span>
        )}
      </div>
{onBook ? (
              <Button size="sm" className="mt-auto w-full" onClick={onBook}>
          <CalendarPlus className="size-4" />
          Book now
        </Button>
      ) : null}
    </Card>
  );
}

function ProviderCard({ provider }: { provider: ProviderDTO }) {
  const isVet = provider.specialty === "VET";
  return (
    <Card className="gap-3 p-4 text-center">
      <Avatar className="mx-auto h-16 w-16 border-2 border-primary/20">
        <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-500 text-lg font-bold text-white">
          {initials(provider.name)}
        </AvatarFallback>
      </Avatar>
      <div>
        <h3 className="font-semibold leading-tight">{provider.name}</h3>
        <Badge
          variant="outline"
          className={cn("mt-1.5", isVet ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900" : "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-900")}
        >
          {isVet ? "Veterinarian" : "Groomer"}
        </Badge>
      </div>
      {provider.bio ? <p className="line-clamp-2 text-sm text-muted-foreground">{provider.bio}</p> : null}
      <div className="mt-auto flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        {provider.rating ? (
          <>
            <Stars value={provider.rating} />
            <span>{provider.rating.toFixed(1)}</span>
          </>
        ) : (
          <span className="flex items-center gap-1">
            <Star className="size-3.5 text-amber-400" /> New on PawCare
          </span>
        )}
      </div>
    </Card>
  );
}

function ReviewCard({ review }: { review: ReviewDTO }) {
  return (
    <Card className="gap-3 p-4 h-full">
      <Stars value={review.rating} />
      {review.comment ? (
        <p className="line-clamp-3 text-sm text-muted-foreground">“{review.comment}”</p>
      ) : null}
      <div className="mt-auto flex items-center gap-2.5">
        <Avatar className="h-9 w-9 border">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials(review.customer.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{review.customer.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {review.service.icon} {review.service.name}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ---------- main view ----------

export function LandingView() {
  const user = useAppStore((s) => s.user);
  const setView = useAppStore((s) => s.setView);
  const setAuthMode = useAppStore((s) => s.setAuthMode);

  const [services, setServices] = useState<ServiceDTO[] | null>(null);
  const [providers, setProviders] = useState<ProviderDTO[] | null>(null);
  const [reviews, setReviews] = useState<ReviewDTO[] | null>(null);
  const [setting, setSetting] = useState<SettingDTO | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    apiFetch<{ services: ServiceDTO[] }>("/api/services?active=true")
      .then((r) => setServices(r.services))
      .catch(() => setServices([]));
    apiFetch<{ providers: ProviderDTO[] }>("/api/providers")
      .then((r) => setProviders(r.providers))
      .catch(() => setProviders([]));
    apiFetch<{ reviews: ReviewDTO[] }>("/api/reviews")
      .then((r) => setReviews(r.reviews.slice(0, 6)))
      .catch(() => setReviews([]));
    apiFetch<{ setting: SettingDTO }>("/api/settings")
      .then((r) => setSetting(r.setting))
      .catch(() => undefined);
  }, []);

  const goAuth = (mode: "login" | "register") => {
    setAuthMode(mode);
    setView("auth");
  };

  // Approved reviews are the only ones the public endpoint returns, so these are
  // exactly the ratings a visitor can scroll down and verify.
  const reviewCount = reviews?.length ?? 0;
  const avgRating =
    reviewCount > 0
      ? Math.round((reviews!.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
      : null;
  const providerCount = providers?.length ?? 0;
  const serviceCount = services?.length ?? 0;

  const liveStats: StatItem[] = [
    { value: providerCount > 0 ? String(providerCount) : "—", label: "Vets & groomers", icon: Stethoscope },
    { value: serviceCount > 0 ? String(serviceCount) : "—", label: "Services offered", icon: Sparkles },
    {
      value: avgRating !== null ? avgRating.toFixed(1) : "—",
      label: reviewCount === 1 ? "From 1 review" : `From ${reviewCount} reviews`,
      icon: Star,
    },
    {
      value: setting ? `${setting.openTime.slice(0, 5)}–${setting.closeTime.slice(0, 5)}` : "—",
      label: "Open daily",
      icon: PawPrint,
    },
  ];

  // Only visitors who can actually book see a booking CTA. A signed-in vet or
  // admin used to get "Book an appointment" that silently dropped them on their
  // own dashboard, which reads as a broken button on a marketing page.
  const canBook = !user || user.role === "CUSTOMER";

  const bookNow = () => {
    if (user?.role === "CUSTOMER") setView("cust-book");
    else if (user) setView(homeViewForRole(user.role));
    else goAuth("register");
  };


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 md:px-6">
          <button type="button" className="flex items-center gap-2.5" onClick={() => scrollToId("top")}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-sm">
              <PawPrint className="size-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">PawCare</span>
          </button>

          <nav aria-label="Landing sections" className="ml-6 hidden items-center gap-1 md:flex">
            {LANDING_ANCHORS.map((a) => (
              <button
                key={a.href}
                type="button"
                onClick={() => scrollToId(a.href.slice(1))}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {a.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Button onClick={() => setView(homeViewForRole(user.role))} className="min-h-11 md:min-h-9">
                Go to dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => goAuth("login")} className="min-h-11 md:min-h-9">
                  Log in
                </Button>
                <Button onClick={() => goAuth("register")} className="min-h-11 md:min-h-9">
                  Get started
                </Button>
              </>
            )}
            {/* Mobile anchors */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11 md:hidden" aria-label="Open sections menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <PawPrint className="size-5 text-primary" /> PawCare
                  </SheetTitle>
                </SheetHeader>
                <nav aria-label="Mobile sections" className="space-y-1 px-3">
                  {LANDING_ANCHORS.map((a) => (
                    <button
                      key={a.href}
                      type="button"
                      onClick={() => {
                        scrollToId(a.href.slice(1));
                        setMobileNavOpen(false);
                      }}
                      className="flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {a.label}
                    </button>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="top" className="relative overflow-hidden">
        {/* decorative blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem]">
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="absolute left-1/3 top-96 h-64 w-64 rounded-full bg-teal-200/30 blur-3xl" />
        </div>

        {/* Hero */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 md:px-6 md:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <FadeIn>
              <Badge variant="outline" className="border-amber-200 dark:border-amber-900 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200">
                <Sparkles className="size-3" /> Trusted by 500+ pet parents
              </Badge>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Expert care for your{" "}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                  furry, feathery
                </span>{" "}
                friends
              </h1>
              <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
                Book trusted vet consultations, grooming and diagnostics in minutes. Transparent pricing,
                real reviews, and complete medical records — all in one friendly platform.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg" onClick={bookNow} className="min-h-11">
                  <CalendarPlus className="size-4" />
                  {canBook ? "Book an appointment" : "Go to your dashboard"}
                </Button>
                <Button size="lg" variant="outline" onClick={() => scrollToId("services")} className="min-h-11">
                  Browse services
                </Button>
              </div>
              {avgRating !== null ? (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Stars value={Math.round(avgRating)} />
                  <span className="text-sm font-semibold">{avgRating.toFixed(1)} avg rating</span>
                  <span className="text-sm text-muted-foreground">
                    · from {reviewCount} verified {reviewCount === 1 ? "review" : "reviews"}
                  </span>
                </div>
              ) : null}
            </FadeIn>

            <FadeIn delay={0.15} className="relative">
              <div className="relative">
                <Image
                  src="/images/hero.png"
                  alt="A happy dog being cared for by a PawCare veterinarian"
                  width={1344}
                  height={768}
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="w-full rounded-3xl border shadow-xl object-cover"
                />
                {/* floating card: next available */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -right-3 top-6 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:-right-6"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Clinic hours
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {setting ? `${formatTime(setting.openTime)} – ${formatTime(setting.closeTime)}` : "Open daily"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {providerCount > 0
                      ? `${providerCount} ${providerCount === 1 ? "provider" : "providers"} available`
                      : "Book online anytime"}
                  </p>
                </motion.div>
                {/* floating card: happy clients */}
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                  className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:-left-6"
                >
                  <div className="flex -space-x-2">
                    {["RA", "NA", "KH"].map((t) => (
                      <Avatar key={t} className="h-8 w-8 border-2 border-card">
                        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                          {t}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {reviewCount > 0
                        ? `${reviewCount} verified ${reviewCount === 1 ? "review" : "reviews"}`
                        : "Trusted local care"}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="size-3 fill-amber-400 text-amber-400" /> loved by pet parents
                    </p>
                  </div>
                </motion.div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Stats strip */}
        <section className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <FadeIn>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-4">
              {liveStats.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1 bg-card p-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="size-5" />
                  </div>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </section>

        {/* Services */}
        <section id="services" className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 md:px-6">
          <FadeIn>
            <div className="mb-8 text-center">
              <Badge variant="outline" className="border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-200">
                Our services
              </Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Everything your pet needs</h2>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                From routine check-ups to a full spa day — transparent prices, real reviews, instant booking.
              </p>
            </div>
          </FadeIn>
          {services === null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="gap-3 p-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-9 w-full" />
                </Card>
              ))}
            </div>
          ) : services.length === 0 ? (
            <p className="text-center text-muted-foreground">
              Services are being prepared — please check back soon.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {services.map((s, i) => (
                <FadeIn key={s.id} delay={Math.min(i * 0.05, 0.3)} className="h-full">
                  <ServiceCard service={s} onBook={canBook ? bookNow : undefined} />
                </FadeIn>
              ))}
            </div>
          )}
        </section>

        {/* How it works */}
        <section id="how" className="border-y bg-muted/40">
          <div className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 md:px-6">
            <FadeIn>
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
                <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                  Four simple steps between you and a happy, healthy pet.
                </p>
              </div>
            </FadeIn>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <FadeIn key={step.title} delay={i * 0.08} className="h-full">
                  <Card className="relative h-full gap-3 p-6">
                    <span className="absolute right-4 top-4 text-4xl font-extrabold text-muted-foreground/10">
                      {i + 1}
                    </span>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-sm">
                      <step.icon className="size-5" />
                    </div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </Card>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        <section id="team" className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 md:px-6">
          <FadeIn>
            <div className="mb-8 text-center">
              <Badge variant="outline" className="border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-200">
                Our team
              </Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Meet the caregivers</h2>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                Experienced veterinarians and certified groomers who treat pets like family.
              </p>
            </div>
          </FadeIn>
          {providers === null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="items-center gap-3 p-6">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-2/3" />
                </Card>
              ))}
            </div>
          ) : providers.length === 0 ? (
            <p className="text-center text-muted-foreground">Our team list is being updated — check back soon.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((p, i) => (
                <FadeIn key={p.id} delay={i * 0.08} className="h-full">
                  <ProviderCard provider={p} />
                </FadeIn>
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section id="reviews" className="border-y bg-muted/40">
          <div className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 md:px-6">
            <FadeIn>
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold tracking-tight">Loved by pet parents</h2>
                <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                  Real reviews from verified visits on PawCare.
                </p>
              </div>
            </FadeIn>
            {reviews === null ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="gap-3 p-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-9 w-40" />
                  </Card>
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No reviews published yet — be the first to share your experience!
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {reviews.map((r, i) => (
                  <FadeIn key={r.id} delay={i * 0.06} className="h-full">
                    <ReviewCard review={r} />
                  </FadeIn>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA banner */}
        <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6">
          <FadeIn>
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-500 shadow-xl">
              <div className="grid items-center gap-6 p-8 md:grid-cols-2 md:p-12">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    {canBook ? "Ready to pamper your pet?" : "Thanks for all you do"}
                  </h2>
                  <p className="mt-3 max-w-md text-emerald-50">
                    {canBook
                      ? "Create a free account, add your companions and book your first visit in under two minutes."
                      : "Your schedule, patients and records are waiting in your dashboard."}
                  </p>
                  <Button
                    size="lg"
                    onClick={bookNow}
                    className="mt-6 min-h-11 bg-white text-emerald-700 dark:text-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/40"
                  >
                    <CalendarPlus className="size-4" />
                    {canBook ? "Book an appointment" : "Go to your dashboard"}
                  </Button>
                </div>
                <div className="overflow-hidden rounded-2xl shadow-lg">
                  <Image
                    src="/images/spa.png"
                    alt="A relaxed pet enjoying a spa grooming session"
                    width={1024}
                    height={1024}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="h-56 w-full object-cover md:h-64"
                  />
                </div>
              </div>
            </div>
          </FadeIn>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-emerald-950 text-emerald-100">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 md:grid-cols-3 md:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white">
                <PawPrint className="size-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">PawCare</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-emerald-200/80">
              One friendly platform for vet visits, grooming, diagnostics, payments and complete pet health records.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">Quick links</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {LANDING_ANCHORS.map((a) => (
                <li key={a.href}>
                  <button
                    type="button"
                    onClick={() => scrollToId(a.href.slice(1))}
                    className="text-emerald-200/80 transition-colors hover:text-white"
                  >
                    {a.label}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => goAuth("login")}
                  className="text-emerald-200/80 transition-colors hover:text-white"
                >
                  Log in
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">Contact</h3>
            <ul className="mt-3 space-y-3 text-sm text-emerald-200/80">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                {setting?.address ?? "House 12, Road 5, Banani, Dhaka 1213"}
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-emerald-300" />
                {setting?.phone ?? "+880 1700-000000"}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-emerald-300" />
                {setting?.email ?? "hello@pawcare.com"}
              </li>
              <li className="flex items-center gap-2">
                <Clock className="size-4 shrink-0 text-emerald-300" />
                Open daily{" "}
                {setting
                  ? `${formatTime(setting.openTime)} – ${formatTime(setting.closeTime)}`
                  : "9:00 AM – 5:00 PM"}
              </li>
            </ul>
          </div>
        </div>
        <SiteFooter as="div" tone="dark" note={<p>Made with ❤ for pets</p>} />
      </footer>
    </div>
  );
}
