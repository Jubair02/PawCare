"use client";

import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailRow } from "@/components/shared/detail-row";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatBDT, formatDate, formatTime, petEmoji } from "@/lib/formatters";
import type { AppointmentDTO } from "@/lib/types";

/**
 * Read-only appointment detail dialog shared by the provider and front-desk
 * appointment lists.
 *
 * The two views showed the same appointment with three small differences, so
 * each is a prop rather than a second copy of the component:
 * - the customer row is labelled "Owner" for providers, "Customer" for staff;
 * - providers list the pet first, staff list the customer first;
 * - providers show whether a treatment record exists, staff show the price as
 *   its own row (both carry the price in the description either way).
 */
export function AppointmentDetailsDialog({
  appointment,
  open,
  onOpenChange,
  actions,
  busy,
  customerLabel = "Customer",
  petFirst = false,
  showTreatment = false,
  showPrice = false,
}: {
  appointment: AppointmentDTO | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Buttons rendered under the detail rows (status transitions, payment, …). */
  actions?: React.ReactNode;
  /** Covers the dialog with a spinner while a status change is in flight. */
  busy?: boolean;
  /** Row label for the appointment's customer — "Owner" in the vet views. */
  customerLabel?: string;
  /** Put the pet row above the customer row (vet views) instead of below. */
  petFirst?: boolean;
  /** Show whether a treatment record exists for this visit. */
  showTreatment?: boolean;
  /** Show the price as its own row, not just in the description. */
  showPrice?: boolean;
}) {
  const petRow = appointment ? (
    <DetailRow label="Pet">
      {petEmoji(appointment.pet.type)} {appointment.pet.name}
      {appointment.pet.breed ? ` · ${appointment.pet.breed}` : ""}
    </DetailRow>
  ) : null;

  const customerRow = appointment ? (
    <DetailRow label={customerLabel}>
      <span>
        {appointment.customer.name}
        {appointment.customer.phone ? (
          <span className="block text-xs font-normal text-muted-foreground">
            {appointment.customer.phone}
          </span>
        ) : null}
        <span className="block text-xs font-normal text-muted-foreground">
          {appointment.customer.email}
        </span>
      </span>
    </DetailRow>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
        {appointment ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="text-lg">{appointment.service.icon}</span>
                {appointment.service.name}
              </DialogTitle>
              <DialogDescription>
                {formatDate(appointment.date)} at {formatTime(appointment.time)} ·{" "}
                {formatBDT(appointment.price)}
              </DialogDescription>
            </DialogHeader>
            <div>
              <DetailRow label="Status">
                <span className="inline-flex flex-wrap justify-end gap-1.5">
                  <StatusBadge status={appointment.status} />
                  <StatusBadge status={appointment.paymentStatus} />
                </span>
              </DetailRow>
              {petFirst ? petRow : customerRow}
              {petFirst ? customerRow : petRow}
              <DetailRow label="Provider">{appointment.provider.name}</DetailRow>
              <DetailRow label="Duration">{appointment.service.duration} min</DetailRow>
              {showTreatment ? (
                <DetailRow label="Treatment">
                  {appointment.treatment ? (
                    <span className="text-primary">Record available</span>
                  ) : (
                    <span className="text-muted-foreground">No record yet</span>
                  )}
                </DetailRow>
              ) : null}
              {showPrice ? (
                <DetailRow label="Price">{formatBDT(appointment.price)}</DetailRow>
              ) : null}
              {appointment.notes ? (
                <DetailRow label="Notes">
                  <span className="block max-w-xs whitespace-pre-wrap text-left text-sm font-normal text-muted-foreground">
                    {appointment.notes}
                  </span>
                </DetailRow>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
          </>
        ) : null}
        {busy ? (
          <div className="absolute inset-0 grid place-items-center rounded-lg bg-background/60">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
