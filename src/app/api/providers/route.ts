import { db } from "@/lib/db";
import { ApiError, handleError, json } from "@/lib/auth";
import { asString, providerRatings } from "@/app/api/_lib/shape";

/** GET /api/providers — public list of active VET/GROOMER users with approved-review ratings. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const specialty = asString(url.searchParams.get("specialty"));
    if (specialty && specialty !== "VET" && specialty !== "GROOMER") {
      throw new ApiError("specialty must be VET or GROOMER.", 400);
    }

    // Filter on `role`, which is what booking validates against. Filtering on the
    // editable `specialty` column let the two disagree, so a provider could list
    // themselves under a profession whose services they cannot be booked for.
    const providers = await db.user.findMany({
      where: {
        active: true,
        role: specialty ? specialty : { in: ["VET", "GROOMER"] },
      },
      orderBy: { name: "asc" },
    });

    const ratings = await providerRatings(providers.map((p) => p.id));
    return json({
      providers: providers.map((p) => {
        const agg = ratings.get(p.id);
        return {
          id: p.id,
          name: p.name,
          email: p.email,
          specialty: p.specialty ?? p.role,
          bio: p.bio,
          phone: p.phone,
          active: p.active,
          rating: agg?.rating ?? null,
          reviewCount: agg?.reviewCount ?? 0,
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}
