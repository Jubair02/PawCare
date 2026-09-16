"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  Eye,
  EyeOff,
  FileHeart,
  Loader2,
  Lock,
  Mail,
  PawPrint,
  Phone,
  Receipt,
  Star,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { DEMO_ACCOUNTS, ROLE_LABELS } from "@/lib/constants";
import { useAppStore } from "@/lib/store";
import type { AuthResponse, ForgotResponse, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/shared/site-footer";
import {
  DURATION,
  EASE,
  MotionButton,
  MotionNavButton,
  fadeUp,
  staggerContainer,
} from "@/components/shared/motion";

// ---------- content ----------

type Mode = "login" | "register" | "forgot";

const MODE_COPY: Record<Mode, { title: string; description: string }> = {
  login: {
    title: "Welcome back",
    description: "Log in to manage appointments, pets and health records.",
  },
  register: {
    title: "Create your account",
    description: "Free for pet parents. Book your first visit in a few minutes.",
  },
  forgot: {
    title: "Reset your password",
    description: "Enter your account email and we'll send you a reset link.",
  },
};

const PANEL_POINTS: { icon: LucideIcon; text: string }[] = [
  { icon: CalendarCheck, text: "Live availability for every vet and groomer" },
  { icon: Receipt, text: "Prices shown before you book, never after" },
  { icon: FileHeart, text: "Medical records that follow your pet" },
];

const ROLE_DOT: Record<Role, string> = {
  ADMIN: "bg-violet-500",
  STAFF: "bg-teal-500",
  VET: "bg-emerald-500",
  GROOMER: "bg-amber-500",
  CUSTOMER: "bg-primary",
};

const STAGGER = staggerContainer(0.07, 0.05);
const ITEM_TRANSITION = { duration: DURATION.base, ease: EASE } as const;
const SWAP_TRANSITION = { duration: 0.22, ease: EASE } as const;

// ---------- small pieces ----------

/** Input with a leading icon and an optional trailing control (password toggle). */
function IconInput({
  icon: Icon,
  trailing,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { icon: LucideIcon; trailing?: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className={cn("h-11 rounded-lg bg-card pl-10 text-base shadow-none md:text-sm", trailing && "pr-11", className)}
        {...props}
      />
      {trailing}
    </div>
  );
}

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={shown ? "Hide password" : "Show password"}
    >
      {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}

/** Three-segment strength hint. Length-driven so it never blocks the submit. */
function PasswordStrength({ value }: { value: string }) {
  const mixed = /[A-Z]/.test(value) && /\d|[^A-Za-z0-9]/.test(value);
  const score = value.length === 0 ? 0 : value.length < 6 ? 1 : value.length >= 10 && mixed ? 3 : 2;
  const label = ["", "Too short", "Good", "Strong"][score];
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full bg-muted transition-colors duration-300",
              score >= i && (score === 1 ? "bg-amber-400" : "bg-primary")
            )}
          />
        ))}
      </div>
      <span className={cn("min-w-16 text-right text-xs text-muted-foreground", score === 0 && "invisible")}>
        {label || "—"}
      </span>
    </div>
  );
}

function BrandMark({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "grid place-items-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20",
        size === "sm" ? "h-9 w-9" : "h-10 w-10",
        className
      )}
    >
      <PawPrint className={size === "sm" ? "size-5" : "size-5"} />
    </span>
  );
}

function InlineError({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          key="error"
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={SWAP_TRANSITION}
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

// ---------- main view ----------

export function AuthView() {
  const authMode = useAppStore((s) => s.authMode);
  const setAuthMode = useAppStore((s) => s.setAuthMode);
  const setView = useAppStore((s) => s.setView);
  const login = useAppStore((s) => s.login);

  // login / forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  // register
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [loadingKey, setLoadingKey] = useState<string | null>(null); // "login" | "register" | "forgot" | demo email
  const [formError, setFormError] = useState<string | null>(null);

  const mode: Mode = showForgot ? "forgot" : authMode;
  const busy = loadingKey !== null;

  function errMessage(err: unknown) {
    return err instanceof Error ? err.message : "Something went wrong";
  }

  function switchMode(next: Mode) {
    setFormError(null);
    if (next === "forgot") {
      setShowForgot(true);
      return;
    }
    setShowForgot(false);
    setAuthMode(next);
  }

  async function doLogin(em: string, pw: string, key: string) {
    setLoadingKey(key);
    setFormError(null);
    try {
      const res = await apiFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: { email: em, password: pw },
      });
      login(res.user, res.token);
      toast.success(`Welcome back, ${res.user.name}`);
    } catch (err) {
      setFormError(errMessage(err));
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    await doLogin(email, password, "login");
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (regPassword.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    setLoadingKey("register");
    setFormError(null);
    try {
      const res = await apiFetch<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: {
          name: regName.trim(),
          email: regEmail.trim(),
          password: regPassword,
          phone: regPhone.trim() || undefined,
        },
      });
      login(res.user, res.token);
      toast.success(`Welcome to PawCare, ${res.user.name} 🐾`);
    } catch (err) {
      setFormError(errMessage(err));
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoadingKey("forgot");
    setFormError(null);
    try {
      const res = await apiFetch<ForgotResponse>("/api/auth/forgot", {
        method: "POST",
        body: { email: forgotEmail.trim() },
      });
      toast.success(res.message || "Password reset link sent to your email");
      setShowForgot(false);
    } catch (err) {
      setFormError(errMessage(err));
    } finally {
      setLoadingKey(null);
    }
  }

  const copy = MODE_COPY[mode];

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* ---------- Brand panel (desktop) ---------- */}
      <aside className="relative hidden overflow-hidden bg-emerald-950 text-emerald-50 lg:flex lg:flex-col">
        <Image
          src="/images/hero.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 52vw, 0px"
          className="object-cover object-[60%_center] opacity-40 mix-blend-luminosity"
          aria-hidden
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/85 to-emerald-900/50"
        />
        <div
          aria-hidden
          className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl"
        />

        <motion.div
          variants={STAGGER}
          initial="hidden"
          animate="visible"
          className="relative flex flex-1 flex-col justify-between p-10 xl:p-14"
        >
          <motion.div variants={fadeUp} transition={ITEM_TRANSITION} className="flex items-center justify-between">
            <MotionNavButton onClick={() => setView("landing")} className="flex items-center gap-2.5" aria-label="Back to home">
              <BrandMark size="sm" />
              <span className="text-lg font-bold tracking-tight text-white">PawCare</span>
            </MotionNavButton>
            <MotionNavButton
              onClick={() => setView("landing")}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-emerald-100/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="size-4" /> Back to home
            </MotionNavButton>
          </motion.div>

          <div className="max-w-md py-16">
            <motion.p
              variants={fadeUp}
              transition={ITEM_TRANSITION}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-emerald-100/90 backdrop-blur"
            >
              <Star className="size-3 fill-amber-300 text-amber-300" /> Trusted by 500+ pet parents
            </motion.p>
            <motion.h2
              variants={fadeUp}
              transition={ITEM_TRANSITION}
              className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white xl:text-5xl"
            >
              Book the visit.
              <br />
              Keep the record.
            </motion.h2>
            <motion.p variants={fadeUp} transition={ITEM_TRANSITION} className="mt-5 max-w-sm text-pretty text-base leading-relaxed text-emerald-100/75">
              Vet consultations, grooming and diagnostics with transparent prices, plus a complete health history
              for every companion.
            </motion.p>
            <motion.ul variants={fadeUp} transition={ITEM_TRANSITION} className="mt-8 space-y-3.5">
              {PANEL_POINTS.map((p) => (
                <li key={p.text} className="flex items-center gap-3 text-sm text-emerald-50/90">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">
                    <p.icon className="size-4 text-emerald-200" />
                  </span>
                  {p.text}
                </li>
              ))}
            </motion.ul>
          </div>

          <motion.div
            variants={fadeUp}
            transition={ITEM_TRANSITION}
            className="flex items-center gap-3 self-start rounded-2xl border border-white/10 bg-white/5 p-3 pr-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur"
          >
            <div className="flex -space-x-2">
              {["RA", "NA", "KH"].map((t) => (
                <Avatar key={t} className="h-8 w-8 border-2 border-emerald-950">
                  <AvatarFallback className="bg-emerald-800 text-[10px] font-semibold text-emerald-100">{t}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium text-white">Loved by pet parents</p>
              <p className="text-xs text-emerald-100/70">Real reviews from verified visits</p>
            </div>
          </motion.div>
        </motion.div>
      </aside>

      {/* ---------- Form column ---------- */}
      <div className="relative flex min-h-dvh flex-col lg:min-h-0">
        {/* soft glow behind the form */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"
        />

        {/* mobile / tablet header */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={ITEM_TRANSITION}
          className="flex items-center justify-between px-5 pt-5 sm:px-8 lg:hidden"
        >
          <MotionNavButton onClick={() => setView("landing")} className="flex items-center gap-2.5" aria-label="Back to home">
            <BrandMark size="sm" />
            <span className="text-lg font-bold tracking-tight">PawCare</span>
          </MotionNavButton>
          <MotionNavButton
            onClick={() => setView("landing")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Home
          </MotionNavButton>
        </motion.header>

        <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:py-12">
          <motion.div
            variants={STAGGER}
            initial="hidden"
            animate="visible"
            className="w-full max-w-md"
          >
            {/* Heading swaps with the mode */}
            <motion.div variants={fadeUp} transition={ITEM_TRANSITION} className="min-h-[4.5rem]">
              <AnimatePresence mode="wait" initial={false}>
                {/* Plain children on purpose: variants here would inherit "hidden"
                    from the stagger parent on every remount and never resolve. */}
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={SWAP_TRANSITION}
                >
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1>
                  <p className="mt-1.5 text-pretty text-sm text-muted-foreground sm:text-base">{copy.description}</p>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            <motion.div variants={fadeUp} transition={ITEM_TRANSITION} className="mt-7">
              <AnimatePresence mode="wait" initial={false}>
                {mode === "forgot" ? (
                  <motion.form
                    key="forgot"
                    onSubmit={handleForgot}
                    className="space-y-5"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={SWAP_TRANSITION}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <IconInput
                        id="forgot-email"
                        icon={Mail}
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                    <InlineError message={formError} />
                    <MotionButton type="submit" size="lg" disabled={busy} className="h-11 w-full rounded-lg text-base sm:text-sm">
                      {loadingKey === "forgot" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                      {loadingKey === "forgot" ? "Sending…" : "Send reset link"}
                    </MotionButton>
                  </motion.form>
                ) : mode === "login" ? (
                  <motion.form
                    key="login"
                    onSubmit={handleLogin}
                    className="space-y-5"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={SWAP_TRANSITION}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <IconInput
                        id="login-email"
                        icon={Mail}
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Password</Label>
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <IconInput
                        id="login-password"
                        icon={Lock}
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your password"
                        autoComplete="current-password"
                        trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
                      />
                    </div>
                    <InlineError message={formError} />
                    <MotionButton type="submit" size="lg" disabled={busy} className="h-11 w-full rounded-lg text-base sm:text-sm">
                      {loadingKey === "login" ? <Loader2 className="size-4 animate-spin" /> : null}
                      {loadingKey === "login" ? "Logging in…" : "Log in"}
                      {loadingKey === "login" ? null : <ArrowRight className="size-4" />}
                    </MotionButton>
                  </motion.form>
                ) : (
                  <motion.form
                    key="register"
                    onSubmit={handleRegister}
                    className="space-y-5"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={SWAP_TRANSITION}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="reg-name">Full name</Label>
                      <IconInput
                        id="reg-name"
                        icon={UserIcon}
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Your name"
                        autoComplete="name"
                      />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="reg-email">Email</Label>
                        <IconInput
                          id="reg-email"
                          icon={Mail}
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="you@example.com"
                          autoComplete="email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-phone">
                          Phone <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <IconInput
                          id="reg-phone"
                          icon={Phone}
                          type="tel"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="+880 1XXX-XXXXXX"
                          autoComplete="tel"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password</Label>
                      <IconInput
                        id="reg-password"
                        icon={Lock}
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
                        trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
                      />
                      <PasswordStrength value={regPassword} />
                    </div>
                    <InlineError message={formError} />
                    <MotionButton type="submit" size="lg" disabled={busy} className="h-11 w-full rounded-lg text-base sm:text-sm">
                      {loadingKey === "register" ? <Loader2 className="size-4 animate-spin" /> : null}
                      {loadingKey === "register" ? "Creating account…" : "Create account"}
                      {loadingKey === "register" ? null : <ArrowRight className="size-4" />}
                    </MotionButton>
                    <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
                      By creating an account you agree to keep your contact details accurate so the clinic can reach you
                      about appointments.
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Mode switch */}
            <motion.p variants={fadeUp} transition={ITEM_TRANSITION} className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  New to PawCare?{" "}
                  <button type="button" onClick={() => switchMode("register")} className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none">
                    Create an account
                  </button>
                </>
              ) : mode === "register" ? (
                <>
                  Already have an account?{" "}
                  <button type="button" onClick={() => switchMode("login")} className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none">
                    Log in
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => switchMode("login")} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none">
                  <ArrowLeft className="size-3.5" /> Back to log in
                </button>
              )}
            </motion.p>

            {/* Demo access */}
            <motion.section variants={fadeUp} transition={ITEM_TRANSITION} className="mt-10" aria-labelledby="demo-heading">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <h2 id="demo-heading" className="text-xs font-medium tracking-wide text-muted-foreground">
                  Or explore with a demo account
                </h2>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DEMO_ACCOUNTS.map((acc) => {
                  const active = loadingKey === acc.email;
                  return (
                    <motion.button
                      key={acc.email}
                      type="button"
                      disabled={busy}
                      onClick={() => void doLogin(acc.email, acc.password, acc.email)}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: DURATION.fast, ease: EASE }}
                      className={cn(
                        "group flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-xl border bg-card px-3 py-2 text-left transition-colors",
                        "hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        "disabled:cursor-not-allowed disabled:opacity-60",
                        active && "border-primary/40 bg-primary/5"
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold">
                        <span className={cn("h-1.5 w-1.5 rounded-full", ROLE_DOT[acc.role])} />
                        {ROLE_LABELS[acc.role]}
                      </span>
                      <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        {active ? <Loader2 className="size-3 animate-spin" /> : null}
                        {acc.name}
                      </span>
                    </motion.button>
                  );
                })}
                <div className="hidden items-center justify-center rounded-xl border border-dashed px-3 text-center text-[11px] leading-snug text-muted-foreground sm:flex">
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-3 text-primary" /> One click, no password
                  </span>
                </div>
              </div>
            </motion.section>
          </motion.div>
        </main>

        <SiteFooter className="relative z-10 bg-transparent" />
      </div>
    </div>
  );
}
