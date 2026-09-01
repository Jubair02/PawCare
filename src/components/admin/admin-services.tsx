"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, Pencil, Plus, RefreshCw, Scissors, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { apiFetch } from "@/lib/api";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { formatBDT } from "@/lib/formatters";
import type { ServiceDTO } from "@/lib/types";

/* ------------------------------- constants -------------------------------- */

const CATEGORY_BADGE: Record<string, string> = {
  MEDICAL: "bg-emerald-100 text-emerald-800 border-emerald-200",
  GROOMING: "bg-amber-100 text-amber-800 border-amber-200",
  DIAGNOSTIC: "bg-teal-100 text-teal-800 border-teal-200",
};

const ICON_PRESETS = ["🩺", "💉", "🦷", "✂️", "🛁", "🐕", "🏥", "🧪", "🐾"];

interface ServiceForm {
  name: string;
  category: string;
  description: string;
  duration: string;
  price: string;
  icon: string;
  active: boolean;
}

const EMPTY_FORM: ServiceForm = {
  name: "",
  category: "MEDICAL",
  description: "",
  duration: "30",
  price: "500",
  icon: "🩺",
  active: true,
};

/* --------------------------------- view ----------------------------------- */

export function AdminServicesView() {
  const [services, setServices] = useState<ServiceDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Create / edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceDTO | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ services: ServiceDTO[] }>("/api/services");
      setServices(res.services);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load services");
      setServices(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------------------ mutations ------------------------------- */

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(s: ServiceDTO) {
    setEditing(s);
    setForm({
      name: s.name,
      category: s.category,
      description: s.description,
      duration: String(s.duration),
      price: String(s.price),
      icon: s.icon || "🐾",
      active: s.active,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    const duration = Number(form.duration);
    const price = Number(form.price);
    if (!form.name.trim()) {
      toast.error("Service name is required.");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Description is required.");
      return;
    }
    if (!Number.isInteger(duration) || duration <= 0) {
      toast.error("Duration must be a positive whole number of minutes.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Price must be a non-negative number.");
      return;
    }
    setSaving(true);
    const body = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      duration,
      price,
      icon: form.icon,
      active: form.active,
    };
    try {
      if (editing) {
        await apiFetch(`/api/services/${editing.id}`, { method: "PATCH", body });
        toast.success("Service updated");
      } else {
        await apiFetch("/api/services", { method: "POST", body });
        toast.success("Service created");
      }
      setFormOpen(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save service");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(s: ServiceDTO) {
    setTogglingId(s.id);
    try {
      await apiFetch(`/api/services/${s.id}`, { method: "PATCH", body: { active: !s.active } });
      toast.success(s.active ? "Service deactivated" : "Service activated");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update service");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/services/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Service deleted");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete service";
      toast.error(
        msg.toLowerCase().includes("deactivate") || msg.includes("appointments") || msg.includes("409")
          ? "Service has bookings — deactivate instead"
          : msg
      );
    } finally {
      setDeleting(false);
    }
  }

  /* -------------------------------- render -------------------------------- */

  return (
    <div className="space-y-6">
      <SectionHeader title="Services" description="Manage the clinic catalogue — pricing, duration and availability.">
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-10">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <Button onClick={openAdd} className="min-h-10">
          <Plus className="size-4" /> Add service
        </Button>
      </SectionHeader>

      {/* Content */}
      {loading && !services ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : !services || services.length === 0 ? (
        <EmptyState
          icon={<Scissors />}
          title="No services yet"
          description="Add your first service so customers can start booking."
          action={
            <Button variant="outline" onClick={openAdd}>
              <Plus className="size-4" /> Add service
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden max-h-96 overflow-y-auto scrollbar-thin rounded-xl border md:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="text-center">Bookings</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-lg ${s.active ? "bg-primary/10" : "bg-muted opacity-50"}`}
                          aria-hidden
                        >
                          {s.icon}
                        </span>
                        <div className="min-w-0">
                          <p className={`truncate font-medium ${s.active ? "" : "text-muted-foreground"}`}>{s.name}</p>
                          <p className="max-w-56 truncate text-xs text-muted-foreground">{s.description}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={CATEGORY_BADGE[s.category] ?? ""}>
                        {s.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{s.duration} min</TableCell>
                    <TableCell className="whitespace-nowrap text-sm font-semibold">{formatBDT(s.price)}</TableCell>
                    <TableCell>
                      {s.rating != null ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="flex" aria-hidden>
                            {[0, 1, 2, 3, 4].map((i) => (
                              <Star
                                key={i}
                                className={`size-3.5 ${i < Math.round(s.rating!) ? "fill-amber-400 text-amber-400" : "text-stone-300"}`}
                              />
                            ))}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {s.rating.toFixed(1)} ({s.reviewCount ?? 0})
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No reviews</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">{s._count?.appointments ?? 0}</TableCell>
                    <TableCell>
                      <span className="inline-flex h-11 items-center">
                        <Switch
                          checked={s.active}
                          onCheckedChange={() => void handleToggle(s)}
                          disabled={togglingId === s.id}
                          aria-label={s.active ? `Deactivate ${s.name}` : `Activate ${s.name}`}
                        />
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-10" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => setDeleteTarget(s)}
                          aria-label={`Delete ${s.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {services.map((s) => (
              <li key={s.id} className="rounded-xl border p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl ${s.active ? "bg-primary/10" : "bg-muted opacity-50"}`}
                    aria-hidden
                  >
                    {s.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`truncate font-medium ${s.active ? "" : "text-muted-foreground"}`}>{s.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                      </div>
                      <Badge variant="outline" className={CATEGORY_BADGE[s.category] ?? ""}>
                        {s.category}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {s.duration} min
                      </span>
                      <span className="font-semibold text-foreground">{formatBDT(s.price)}</span>
                      {s.rating != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="size-3 fill-amber-400 text-amber-400" /> {s.rating.toFixed(1)} ({s.reviewCount ?? 0})
                        </span>
                      ) : null}
                      <span>{s._count?.appointments ?? 0} bookings</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch
                          checked={s.active}
                          onCheckedChange={() => void handleToggle(s)}
                          disabled={togglingId === s.id}
                        />
                        {s.active ? "Active" : "Inactive"}
                      </label>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="size-10" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 text-rose-600"
                          onClick={() => setDeleteTarget(s)}
                          aria-label={`Delete ${s.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Add / edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit service" : "Add service"}</DialogTitle>
            <DialogDescription>
              {editing ? `Update “${editing.name}” — changes apply immediately.` : "Create a new bookable service for the catalogue."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="svc-name">Name *</Label>
              <Input
                id="svc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Full grooming session"
              />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_CATEGORIES.map((c) => (
                  <Button
                    key={c.value}
                    type="button"
                    variant={form.category === c.value ? "default" : "outline"}
                    size="sm"
                    className="min-h-9"
                    onClick={() => setForm({ ...form, category: c.value })}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="svc-desc">Description *</Label>
              <Textarea
                id="svc-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this service include?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="svc-duration">Duration (min) *</Label>
                <Input
                  id="svc-duration"
                  type="number"
                  min={5}
                  step={5}
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="svc-price">Price (৳) *</Label>
                <Input
                  id="svc-price"
                  type="number"
                  min={0}
                  step={50}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm({ ...form, icon: emoji })}
                    aria-label={`Icon ${emoji}`}
                    aria-pressed={form.icon === emoji}
                    className={`flex size-11 items-center justify-center rounded-xl border text-xl transition-colors ${
                      form.icon === emoji
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    <span aria-hidden>{emoji}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-xl border p-3">
              <span className="text-sm">
                <span className="font-medium">Active</span>
                <span className="block text-xs text-muted-foreground">Inactive services are hidden from booking.</span>
              </span>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
                aria-label="Service active"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="min-w-28">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {editing ? "Save changes" : "Create service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” (${formatBDT(deleteTarget.price)}) will be permanently removed. Services with existing bookings cannot be deleted — deactivate them instead.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
