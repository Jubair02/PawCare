"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Search, Trash2, UserPlus, Users } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { apiFetch, isAbortError } from "@/lib/api";
import { ListNotice } from "@/components/shared/list-notice";
import { formatDate, formatInstantDate, initials } from "@/lib/formatters";
import { useAppStore } from "@/lib/store";
import type { PageMeta, Role, UserDTO } from "@/lib/types";

/* ------------------------------- constants -------------------------------- */

const ROLE_TABS: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "CUSTOMER", label: "Customers" },
  { value: "VET", label: "Vets" },
  { value: "GROOMER", label: "Groomers" },
  { value: "STAFF", label: "Staff" },
  { value: "ADMIN", label: "Admins" },
];

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-violet-100 dark:bg-violet-950/50 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-900",
  STAFF: "bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-900",
  VET: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900",
  GROOMER: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900",
  CUSTOMER: "bg-stone-100 dark:bg-stone-950/50 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-900",
};

const SPECIALTY_OPTIONS = [
  { value: "VET", label: "Veterinarian" },
  { value: "GROOMER", label: "Groomer" },
];

const ALL_ROLES: Role[] = ["CUSTOMER", "VET", "GROOMER", "STAFF", "ADMIN"];

/** ISO datetime → "20 Nov 2025" (formatDate expects yyyy-MM-dd). */
const fmtJoined = formatInstantDate;

/* --------------------------------- view ----------------------------------- */

export function AdminUsersView() {
  const me = useAppStore((s) => s.user);

  const [users, setUsers] = useState<UserDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", password: "", role: "CUSTOMER", phone: "", specialty: "" });
  const [saving, setSaving] = useState(false);

  // Edit dialog
  const [editing, setEditing] = useState<UserDTO | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", role: "CUSTOMER", specialty: "", bio: "", password: "" });

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search → q
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const [page, setPage] = useState<PageMeta | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (roleFilter !== "ALL") params.set("role", roleFilter);
        if (q) params.set("q", q);
        const qs = params.toString();
        const res = await apiFetch<{ users: UserDTO[]; page?: PageMeta }>(
          `/api/users${qs ? `?${qs}` : ""}`,
          { signal }
        );
        setUsers(res.users);
        setPage(res.page ?? null);
      } catch (e) {
        if (isAbortError(e)) return;
        toast.error(e instanceof Error ? e.message : "Failed to load users");
        setUsers(null);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [roleFilter, q]
  );

  // Aborting on cleanup keeps a slow result for an earlier search term or role
  // filter from landing after the newer one and replacing the visible list.
  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  /* ------------------------------ mutations ------------------------------- */

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.email.trim() || addForm.password.length < 6) {
      toast.error("Name, email and a password of at least 6 characters are required.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: {
          name: addForm.name.trim(),
          email: addForm.email.trim(),
          password: addForm.password,
          role: addForm.role,
          phone: addForm.phone.trim() || undefined,
          specialty: addForm.role === "VET" || addForm.role === "GROOMER" ? addForm.specialty || undefined : undefined,
        },
      });
      toast.success("User created");
      setAddOpen(false);
      setAddForm({ name: "", email: "", password: "", role: "CUSTOMER", phone: "", specialty: "" });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create user");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(u: UserDTO) {
    setEditing(u);
    setEditForm({
      name: u.name,
      phone: u.phone ?? "",
      role: u.role,
      specialty: u.specialty ?? "",
      bio: u.bio ?? "",
      password: "",
    });
  }

  async function handleEdit() {
    if (!editing) return;
    if (!editForm.name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/users/${editing.id}`, {
        method: "PATCH",
        // Emptied fields must go as "" — `undefined` omits the key and the API
        // skips it, so clearing a phone/bio/specialty silently did nothing.
        body: {
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          role: editForm.role,
          specialty:
            editForm.role === "VET" || editForm.role === "GROOMER" ? editForm.specialty || "" : "",
          bio: editForm.bio.trim(),
          ...(editForm.password ? { password: editForm.password } : {}),
        },
      });
      toast.success(editForm.password ? "User updated — password reset" : "User updated");
      setEditing(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update user");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(u: UserDTO) {
    setTogglingId(u.id);
    try {
      await apiFetch(`/api/users/${u.id}`, { method: "PATCH", body: { active: !u.active } });
      toast.success(u.active ? "User deactivated" : "User activated");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("User deleted");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      // Show the server's message, which already names the reason ("This user
      // has pets or appointments and cannot be deleted. Deactivate the account
      // instead."). The old code looked for "409" in the text to detect that
      // case, but apiFetch throws `Error(data.error)` and never includes the
      // status code, so that branch was dead.
      toast.error(e instanceof Error ? e.message : "Could not delete user.");
    } finally {
      setDeleting(false);
    }
  }

  /* -------------------------------- render -------------------------------- */

  const showSpecialty = addForm.role === "VET" || addForm.role === "GROOMER";
  const showEditSpecialty = editForm.role === "VET" || editForm.role === "GROOMER";

  return (
    <div className="space-y-6">
      <SectionHeader title="Users" description="Manage customers, providers, staff and admin accounts.">
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-10">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <Button onClick={() => setAddOpen(true)} className="min-h-10">
          <UserPlus className="size-4" /> Add user
        </Button>
      </SectionHeader>
      <ListNotice page={page} noun="users" />

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={roleFilter} onValueChange={setRoleFilter}>
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            {ROLE_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="min-h-9">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="pl-9"
            aria-label="Search users"
          />
        </div>
      </div>

      {/* Content */}
      {loading && !users ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : !users || users.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No users found"
          description={q ? `No accounts match “${q}”.` : "Try a different role filter or add a new user."}
          action={
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Add user
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
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Pets</TableHead>
                  <TableHead className="text-center">Bookings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === me?.id;
                  const isCustomer = u.role === "CUSTOMER";
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {initials(u.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {u.name}
                              {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant="outline" className={ROLE_BADGE[u.role] ?? ""}>
                            {u.role}
                          </Badge>
                          {u.specialty ? <span className="text-xs text-muted-foreground">{u.specialty}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                      {/*
                        Both counts come from customer-only relations, so a vet,
                        groomer, staff or admin row always read a hard "0" —
                        indistinguishable from a customer who genuinely has none.
                      */}
                      <TableCell className="text-center text-sm">
                        {isCustomer ? (
                          u._count?.pets ?? 0
                        ) : (
                          <span className="text-muted-foreground" title="Only customers register pets">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {isCustomer ? (
                          u._count?.customerAppointments ?? 0
                        ) : (
                          <span
                            className="text-muted-foreground"
                            title="Only customers book appointments — a provider's workload is on their own dashboard"
                          >
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isSelf ? (
                          <Badge variant="outline" className="bg-stone-100 dark:bg-stone-950/50 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-900">
                            YOU
                          </Badge>
                        ) : (
                          <span className="inline-flex h-11 items-center">
                            <Switch
                              checked={u.active}
                              onCheckedChange={() => void handleToggle(u)}
                              disabled={togglingId === u.id}
                              aria-label={u.active ? `Deactivate ${u.name}` : `Activate ${u.name}`}
                            />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatDate(fmtJoined(u.createdAt))}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-10" onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-10 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-200"
                            disabled={isSelf || u.role === "ADMIN"}
                            onClick={() => setDeleteTarget(u)}
                            aria-label={`Delete ${u.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {users.map((u) => {
              const isSelf = u.id === me?.id;
              const isCustomer = u.role === "CUSTOMER";
              return (
                <li key={u.id} className="rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {initials(u.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <Badge variant="outline" className={ROLE_BADGE[u.role] ?? ""}>
                          {u.role}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{u.phone || "No phone"}</span>
                        {isCustomer ? (
                          <>
                            <span>{u._count?.pets ?? 0} pets</span>
                            <span>{u._count?.customerAppointments ?? 0} bookings</span>
                          </>
                        ) : null}
                        <span>Joined {formatDate(fmtJoined(u.createdAt))}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        {isSelf ? (
                          <Badge variant="outline" className="bg-stone-100 dark:bg-stone-950/50 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-900">
                            YOU
                          </Badge>
                        ) : (
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Switch
                              checked={u.active}
                              onCheckedChange={() => void handleToggle(u)}
                              disabled={togglingId === u.id}
                            />
                            {u.active ? "Active" : "Inactive"}
                          </label>
                        )}
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="size-10" onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-10 text-rose-600 dark:text-rose-300"
                            disabled={isSelf || u.role === "ADMIN"}
                            onClick={() => setDeleteTarget(u)}
                            aria-label={`Delete ${u.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>Create a new account for a customer, provider or staff member.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Name *</Label>
              <Input id="add-name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-email">Email *</Label>
              <Input id="add-email" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="name@example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-password">Password * <span className="text-xs text-muted-foreground">(min 6 characters)</span></Label>
              <Input id="add-password" type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={addForm.role} onValueChange={(v) => setAddForm({ ...addForm, role: v })}>
                <SelectTrigger className="min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-phone">Phone</Label>
              <Input id="add-phone" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="Optional" />
            </div>
            {showSpecialty ? (
              <div className="grid gap-2">
                <Label>Specialty</Label>
                <Select value={addForm.specialty || undefined} onValueChange={(v) => setAddForm({ ...addForm, specialty: v })}>
                  <SelectTrigger className="min-h-10 w-full">
                    <SelectValue placeholder="Select specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTY_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleAdd()} disabled={saving} className="min-w-28">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>{editing ? `${editing.name} · ${editing.email}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger className="min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showEditSpecialty ? (
              <div className="grid gap-2">
                <Label>Specialty</Label>
                <Select value={editForm.specialty || undefined} onValueChange={(v) => setEditForm({ ...editForm, specialty: v })}>
                  <SelectTrigger className="min-h-10 w-full">
                    <SelectValue placeholder="Select specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTY_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea id="edit-bio" rows={3} value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} placeholder="Short professional bio" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-password">Reset password</Label>
              <Input
                id="edit-password"
                type="password"
                autoComplete="new-password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Leave blank to keep current password"
              />
              <p className="text-xs text-muted-foreground">
                Account recovery for a locked-out user. Takes effect immediately and notifies them.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleEdit()} disabled={saving} className="min-w-28">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.name} (${deleteTarget.email}) will be permanently removed. Users with pets, appointments or treatments cannot be deleted — deactivate them instead.`
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
