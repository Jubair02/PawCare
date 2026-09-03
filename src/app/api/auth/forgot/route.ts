import { handleError, json } from "@/lib/auth";
import { ApiError } from "@/lib/auth";
import { asString, readBody } from "@/app/api/_lib/shape";
import { HOUR, clientIp, enforce } from "@/lib/rate-limit";

/** Mock forgot-password — always succeeds so we don't leak which emails exist. */
export async function POST(req: Request) {
  try {
    enforce(`forgot:ip:${clientIp(req)}`, 10, HOUR, "Too many password reset requests.");

    const body = await readBody(req);
    const email = asString(body.email);
    if (!email) throw new ApiError("Email is required.", 400);
    // No mailer is configured, so self-service reset is not available. Kept
    // non-enumerating: the reply is identical whether or not the account exists.
    return json({
      ok: true,
      message:
        "If an account exists for this email, our team has been notified. Please contact the clinic and an administrator will reset your password.",
    });
  } catch (e) {
    return handleError(e);
  }
}
