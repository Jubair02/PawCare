import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole } from "@/lib/auth";
import { EMAIL_RE, TIME_RE, asNumber, asString, getSetting, readBody, timeToMinutes } from "@/app/api/_lib/shape";

export const dynamic = "force-dynamic";

/** GET /api/settings — public clinic settings. */
export async function GET() {
  try {
    const setting = await getSetting();
    return json({ setting });
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/settings — ADMIN. */
export async function PATCH(req: Request) {
  try {
    await requireRole(req, "ADMIN");
    const body = await readBody(req);

    const data: {
      clinicName?: string;
      address?: string;
      phone?: string;
      email?: string;
      openTime?: string;
      closeTime?: string;
      slotMinutes?: number;
    } = {};

    const clinicName = asString(body.clinicName);
    if (clinicName !== undefined) {
      if (!clinicName) throw new ApiError("Clinic name cannot be empty.", 400);
      data.clinicName = clinicName;
    }
    const address = asString(body.address);
    if (address !== undefined) data.address = address;
    const phone = asString(body.phone);
    if (phone !== undefined) data.phone = phone;
    const email = asString(body.email);
    if (email !== undefined) {
      if (!EMAIL_RE.test(email)) throw new ApiError("A valid clinic email is required.", 400);
      data.email = email;
    }

    const openTime = asString(body.openTime);
    if (openTime !== undefined) {
      if (!TIME_RE.test(openTime)) throw new ApiError("openTime must be in HH:mm format.", 400);
      data.openTime = openTime;
    }
    const closeTime = asString(body.closeTime);
    if (closeTime !== undefined) {
      if (!TIME_RE.test(closeTime)) throw new ApiError("closeTime must be in HH:mm format.", 400);
      data.closeTime = closeTime;
    }
    const slotMinutes = asNumber(body.slotMinutes);
    if (slotMinutes !== undefined) {
      if (!Number.isInteger(slotMinutes) || slotMinutes < 5) {
        throw new ApiError("slotMinutes must be a whole number of at least 5.", 400);
      }
      data.slotMinutes = slotMinutes;
    }

    // Validate the resulting window, not just the field that happened to be sent.
    // The old pair of guards only fired when exactly one of the two times was
    // present, so the admin form - which always sends both - could save
    // open=18:00 / close=09:00 and silently make every slot list empty.
    if (data.openTime !== undefined || data.closeTime !== undefined || data.slotMinutes !== undefined) {
      const current = await getSetting();
      const openTime = data.openTime ?? current.openTime;
      const closeTime = data.closeTime ?? current.closeTime;
      const slotMinutes = data.slotMinutes ?? current.slotMinutes;

      const open = timeToMinutes(openTime);
      const close = timeToMinutes(closeTime);
      if (open >= close) {
        throw new ApiError("Opening time must be before closing time.", 400);
      }
      if (slotMinutes > close - open) {
        throw new ApiError(
          `A ${slotMinutes}-minute slot does not fit between ${openTime} and ${closeTime}.`,
          400,
        );
      }
    }

    const setting = await db.setting.upsert({ where: { id: "main" }, update: data, create: data });
    return json({ setting });
  } catch (e) {
    return handleError(e);
  }
}

