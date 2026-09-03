import { db } from "@/lib/db";
import { handleError, json, requireUser } from "@/lib/auth";
import { pageMeta, readPage } from "@/app/api/_lib/shape";

/** GET /api/notifications — current user's notifications + unread count. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const page = readPage(new URL(req.url));
    const where = { userId: user.id };
    const [notifications, unread, total] = await Promise.all([
      db.notification.findMany({ where, orderBy: { createdAt: "desc" }, ...page }),
      db.notification.count({ where: { userId: user.id, read: false } }),
      db.notification.count({ where }),
    ]);
    return json({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        createdAt: n.createdAt,
      })),
      unread,
      page: pageMeta(total, page),
    });
  } catch (e) {
    return handleError(e);
  }
}
