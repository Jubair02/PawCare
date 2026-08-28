import { db } from "@/lib/db";
import { ApiError, handleError, json, requireRole } from "@/lib/auth";
import { TIME_RE, asNumber, asString, getSetting, readBody } from "@/app/api/_lib/shape";

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
    if (email !== undefined) data.email = email;

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

    if (data.openTime && data.closeTime === undefined) {
      const current = await getSetting();
      if (timeToMinutesSafe(data.openTime) >= timeToMinutesSafe(current.closeTime)) {
        throw new ApiError("openTime must be before closeTime.", 400);
      }
    }
    if (data.closeTime && data.openTime === undefined) {
      const current = await getSetting();
      if (timeToMinutesSafe(current.openTime) >= timeToMinutesSafe(data.closeTime)) {
        throw new ApiError("closeTime must be after openTime.", 400);
      }
    }

    const setting = await db.setting.upsert({ where: { id: "main" }, update: data, create: data });
    return json({ setting });
  } catch (e) {
    return handleError(e);
  }
}

function timeToMinutesSafe(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
