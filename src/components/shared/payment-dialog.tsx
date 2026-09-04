"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiFetch, errMsg } from "@/lib/api";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatBDT } from "@/lib/formatters";
import type { AppointmentDTO, PaymentDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * "Pay for this appointment" dialog.
 *
 * One copy for both entry points — straight after booking, and from the
 * appointments list. They were character-identical apart from their input ids.
 */
export function PaymentDialog({
  appointment,
  open,
  onOpenChange,
  onDone,
  idPrefix = "pay",
}: {
  appointment: AppointmentDTO | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
  /** Prefix for the radio ids, so two of these can live on one page. */
  idPrefix?: string;
}) {
  const [method, setMethod] = useState("CASH");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (open) setMethod("CASH");
  }, [open]);

  async function handlePay() {
    if (!appointment) return;
    setPaying(true);
    try {
      await apiFetch<{ payment: PaymentDTO; appointment: AppointmentDTO }>("/api/payments", {
        method: "POST",
        body: { appointmentId: appointment.id, method },
      });
      // Cash is settled at the counter, so do not claim it was received.
      if (method === "CASH") {
        toast.success(`Reserved — pay ${formatBDT(appointment.price)} at the front desk`);
      } else {
        toast.success("Payment successful 🎉");
      }
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setPaying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay for your appointment</DialogTitle>
          <DialogDescription>
            {appointment
              ? `${appointment.service.name} for ${appointment.pet.name} — ${formatBDT(appointment.price)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={method} onValueChange={setMethod} className="gap-3">
          {PAYMENT_METHODS.map((pm) => (
            <Label
              key={pm.value}
              htmlFor={`${idPrefix}-${pm.value}`}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3 font-normal transition-colors",
                method === pm.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <RadioGroupItem value={pm.value} id={`${idPrefix}-${pm.value}`} />
              {pm.label}
            </Label>
          ))}
        </RadioGroup>
        {method === "CASH" ? (
          <p className="rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/40 px-3 py-2 text-xs text-orange-900 dark:text-orange-200">
            Nothing is charged now. We will hold your appointment and you pay{" "}
            {appointment ? formatBDT(appointment.price) : ""} in cash at the front desk.
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={paying}
            className="min-h-11"
          >
            Cancel
          </Button>
          <Button onClick={handlePay} disabled={paying} className="min-h-11">
            {paying ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
            {method === "CASH"
              ? "Reserve — pay at clinic"
              : `Pay ${appointment ? formatBDT(appointment.price) : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
