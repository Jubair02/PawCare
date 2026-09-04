"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Clock, Info, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/shared/section-header";
import { apiFetch } from "@/lib/api";
import { formatTime } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { SettingDTO } from "@/lib/types";

/* --------------------------------- view ----------------------------------- */

interface SettingsForm {
  clinicName: string;
  address: string;
  phone: string;
  email: string;
  openTime: string;
  closeTime: string;
  slotMinutes: string;
}

const EMPTY_FORM: SettingsForm = {
  clinicName: "",
  address: "",
  phone: "",
  email: "",
  openTime: "09:00",
  closeTime: "17:00",
  slotMinutes: "60",
};

export function AdminSettingsView() {
  const me = useAppStore((s) => s.user);
  const [setting, setSetting] = useState<SettingDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ setting: SettingDTO }>("/api/settings");
      setSetting(res.setting);
      setLoadError(null);
      setForm({
        clinicName: res.setting.clinicName ?? "",
        address: res.setting.address ?? "",
        phone: res.setting.phone ?? "",
        email: res.setting.email ?? "",
        openTime: res.setting.openTime ?? "09:00",
        closeTime: res.setting.closeTime ?? "17:00",
        slotMinutes: String(res.setting.slotMinutes ?? 60),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load settings";
      toast.error(msg);
      setSetting(null);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (me?.role !== "ADMIN") {
      toast.error("Only admins can change clinic settings.");
      return;
    }
    const slot = Number(form.slotMinutes);
    if (!form.clinicName.trim()) {
      toast.error("Clinic name is required.");
      return;
    }
    if (!Number.isInteger(slot) || slot < 10 || slot > 240) {
      toast.error("Slot duration must be a whole number between 10 and 240 minutes.");
      return;
    }
    if (form.openTime && form.closeTime && form.closeTime <= form.openTime) {
      toast.error("Closing time must be after opening time.");
      return;
    }
    if (!form.email.trim() && setting?.email) {
      toast.error("The clinic email cannot be removed — enter a replacement address.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ setting: SettingDTO }>("/api/settings", {
        method: "PATCH",
        body: {
          clinicName: form.clinicName.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          // The API validates any email it receives, so an untouched field must
          // be omitted rather than sent as "" (which came back a 400).
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          openTime: form.openTime,
          closeTime: form.closeTime,
          slotMinutes: slot,
        },
      });
      setSetting(res.setting);
      toast.success("Settings saved");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  /* -------------------------------- render -------------------------------- */

  if (loading && !setting) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <Skeleton className="h-14 rounded-2xl" />
      </div>
    );
  }

  // Without this branch a failed GET fell through to the form filled with
  // EMPTY_FORM, so 09:00-17:00 / 60 min looked like the clinic's saved hours -
  // and saving would have written those placeholder values for real.
  if (loadError && !setting) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Settings" description="Clinic profile and booking schedule used across the platform.">
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-10">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Retry
          </Button>
        </SectionHeader>
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="rounded-full bg-rose-100 p-3 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            <Info className="size-6" />
          </span>
          <div>
            <p className="font-semibold">Could not load clinic settings</p>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          </div>
          <p className="max-w-md text-xs text-muted-foreground">
            The form is hidden on purpose: editing it now would overwrite the clinic&apos;s real hours with
            placeholder defaults.
          </p>
        </Card>
      </div>
    );
  }

  const previewOpen = form.openTime ? formatTime(form.openTime) : "—";
  const previewClose = form.closeTime ? formatTime(form.closeTime) : "—";
  const previewSlot = Number(form.slotMinutes) || 60;

  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" description="Clinic profile and booking schedule used across the platform.">
        <Button variant="outline" onClick={() => void load()} disabled={loading || saving} className="min-h-10">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <Button onClick={() => void handleSave()} disabled={saving || loading} className="min-h-10 min-w-32">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </SectionHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Clinic info */}
        <Card className="rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </span>
            <div>
              <p className="font-semibold">Clinic information</p>
              <p className="text-xs text-muted-foreground">Shown on the landing page, footer and invoices.</p>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="set-clinic">Clinic name *</Label>
              <Input
                id="set-clinic"
                value={form.clinicName}
                onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
                placeholder="PawCare Veterinary Clinic"
                disabled={saving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="set-address">Address</Label>
              <Input
                id="set-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="House 12, Road 5, Dhanmondi, Dhaka"
                disabled={saving}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="set-phone">Phone</Label>
                <Input
                  id="set-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+880 1XXX-XXXXXX"
                  disabled={saving}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="set-email">Email</Label>
                <Input
                  id="set-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="hello@pawcare.com"
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Booking schedule */}
        <Card className="rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300">
              <Clock className="size-4" />
            </span>
            <div>
              <p className="font-semibold">Booking schedule</p>
              <p className="text-xs text-muted-foreground">Controls the slot picker customers see when booking.</p>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="set-open">Opens at</Label>
                <Input
                  id="set-open"
                  type="time"
                  value={form.openTime}
                  onChange={(e) => setForm({ ...form, openTime: e.target.value })}
                  disabled={saving}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="set-close">Closes at</Label>
                <Input
                  id="set-close"
                  type="time"
                  value={form.closeTime}
                  onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="set-slot">Slot duration (minutes)</Label>
              <Input
                id="set-slot"
                type="number"
                min={10}
                max={240}
                step={5}
                value={form.slotMinutes}
                onChange={(e) => setForm({ ...form, slotMinutes: e.target.value })}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">minutes per appointment slot</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Preview strip derived from the form */}
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-200">
          <Info className="size-4" />
        </span>
        <p className="text-sm text-emerald-900 dark:text-emerald-200">
          <span className="font-semibold">Customer booking preview:</span> Open daily {previewOpen} – {previewClose} •{" "}
          {previewSlot}-min slots
        </p>
      </div>
    </div>
  );
}
