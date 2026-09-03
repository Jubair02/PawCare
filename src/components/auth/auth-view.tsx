"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  PawPrint,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { DEMO_ACCOUNTS, ROLE_LABELS } from "@/lib/constants";
import { useAppStore } from "@/lib/store";
import type { AuthResponse, ForgotResponse, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/shared/site-footer";

const ROLE_DOT: Record<Role, string> = {
  ADMIN: "bg-violet-500",
  STAFF: "bg-teal-500",
  VET: "bg-emerald-500",
  GROOMER: "bg-amber-500",
  CUSTOMER: "bg-primary",
};

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

  function errMessage(err: unknown) {
    return err instanceof Error ? err.message : "Something went wrong";
  }

  async function doLogin(em: string, pw: string, key: string) {
    setLoadingKey(key);
    try {
      const res = await apiFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: { email: em, password: pw },
      });
      login(res.user, res.token);
      toast.success(`Welcome back, ${res.user.name}!`);
    } catch (err) {
      toast.error(errMessage(err));
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
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoadingKey("register");
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
      toast.success(`Welcome to PawCare, ${res.user.name}! 🐾`);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoadingKey("forgot");
    try {
      const res = await apiFetch<ForgotResponse>("/api/auth/forgot", {
        method: "POST",
        body: { email: forgotEmail.trim() },
      });
      toast.success(res.message || "Password reset link sent to your email");
      setShowForgot(false);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoadingKey(null);
    }
  }

  const tabValue = showForgot ? "login" : authMode;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-emerald-50 via-background to-amber-50/60">
      {/* decorative blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative w-full max-w-md"
        >
          {/* Brand header */}
          <div className="mb-6 text-center">
            <button
              type="button"
              onClick={() => setView("landing")}
              className="mx-auto flex items-center gap-2.5"
              aria-label="Back to home"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-md">
                <PawPrint className="size-6" />
              </div>
            </button>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">PawCare</h1>
            <p className="text-sm text-muted-foreground">Expert care for your furry, feathery friends</p>
          </div>
  
          <Card className="p-6">
            <Tabs
              value={tabValue}
              onValueChange={(v) => {
                setShowForgot(false);
                setAuthMode(v === "register" ? "register" : "login");
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" className="min-h-9">
                  Log in
                </TabsTrigger>
                <TabsTrigger value="register" className="min-h-9">
                  Register
                </TabsTrigger>
              </TabsList>
  
              {/* ---- LOGIN ---- */}
              <TabsContent value="login" className="mt-4">
                {showForgot ? (
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <h2 className="font-semibold">Reset your password</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Enter your account email and we&apos;ll send you a reset link.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="forgot-email"
                          type="email"
                          required
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="pl-9"
                          autoComplete="email"
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={loadingKey === "forgot"} className="w-full min-h-11">
                      {loadingKey === "forgot" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                      {loadingKey === "forgot" ? "Sending…" : "Send reset link"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowForgot(false)}
                      className="flex min-h-11 w-full items-center justify-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ArrowLeft className="size-3.5" /> Back to login
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="pl-9"
                          autoComplete="email"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pl-9 pr-10"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-sm text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Button type="submit" disabled={loadingKey === "login"} className="w-full min-h-11">
                      {loadingKey === "login" ? <Loader2 className="size-4 animate-spin" /> : <PawPrint className="size-4" />}
                      {loadingKey === "login" ? "Logging in…" : "Log in"}
                    </Button>
                  </form>
                )}
              </TabsContent>
  
              {/* ---- REGISTER ---- */}
              <TabsContent value="register" className="mt-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Full name</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="reg-name"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Your name"
                        className="pl-9"
                        autoComplete="name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="reg-email"
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-9"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">Phone (optional)</Label>
                    <Input
                      id="reg-phone"
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+880 1XXX-XXXXXX"
                      autoComplete="tel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="reg-password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="pl-9 pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 6 characters.</p>
                  </div>
                  <Button type="submit" disabled={loadingKey === "register"} className="w-full min-h-11">
                    {loadingKey === "register" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PawPrint className="size-4" />
                    )}
                    {loadingKey === "register" ? "Creating account…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
  
            <Separator className="my-5" />
  
            {/* Quick demo access */}
            <div>
              <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quick demo access
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={loadingKey !== null}
                    onClick={() => void doLogin(acc.email, acc.password, acc.email)}
                    className={cn(
                      "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border bg-card px-3 py-1.5 text-center transition-all",
                      "hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm",
                      loadingKey === acc.email && "opacity-60"
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className={cn("h-2 w-2 rounded-full", ROLE_DOT[acc.role])} />
                      {ROLE_LABELS[acc.role]}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {loadingKey === acc.email ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : null}
                      {acc.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
  
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setView("landing")}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to home
            </button>
          </div>
        </motion.div>
      </div>

      <SiteFooter className="relative z-10 bg-transparent" />
    </div>
  );
}
