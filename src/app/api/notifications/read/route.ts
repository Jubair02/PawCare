import { db } from "@/lib/db";
import { ApiError, handleError, json, requireUser } from "@/lib/auth";
import { readBody } from "@/app/api/_lib/shape";

/** POST /api/notifications/read — {ids?: string[]} or {all: true}. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await readBody(req);

    const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string") : undefined;
    const all = body.all === true;

    if (!all && (!ids || ids.length === 0)) {
      throw new ApiError("Provide notification ids or all=true.", 400);
    }

    if (all) {
      await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    } else {
      await db.notification.updateMany({
        where: { userId: user.id, id: { in: ids ?? [] } },
        data: { read: true },
      });
    }
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
