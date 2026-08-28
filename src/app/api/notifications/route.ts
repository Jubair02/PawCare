import { db } from "@/lib/db";
import { handleError, json, requireUser } from "@/lib/auth";

/** GET /api/notifications — current user's notifications + unread count. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const [notifications, unread] = await Promise.all([
      db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      db.notification.count({ where: { userId: user.id, read: false } }),
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
    });
  } catch (e) {
    return handleError(e);
  }
}
