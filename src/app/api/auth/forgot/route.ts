import { handleError, json } from "@/lib/auth";
import { ApiError } from "@/lib/auth";
import { asString, readBody } from "@/app/api/_lib/shape";

/** Mock forgot-password — always succeeds so we don't leak which emails exist. */
export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const email = asString(body.email);
    if (!email) throw new ApiError("Email is required.", 400);
    return json({
      ok: true,
      message: "If an account exists for this email, a password reset link has been sent. (Demo: reset is simulated.)",
    });
  } catch (e) {
    return handleError(e);
  }
}
