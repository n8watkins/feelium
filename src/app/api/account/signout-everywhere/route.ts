import { NextResponse, type NextRequest } from "next/server";

import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { isSameOriginPost } from "@/lib/same-origin";
import { bumpSessionVersionForUser } from "@/server/data/session-operations";

/**
 * "Sign out on every device" (Settings > Account). Bumps the user's session version, so
 * every session minted before now is refused (see requireUserId), then signs this browser
 * out. Under /api, outside the proxy, for the same reason as /api/account/signout.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const session = await auth();
  if (session?.user?.id) {
    await bumpSessionVersionForUser(db, session.user.id);
  }
  const { redirect } = await signOut({ redirect: false, redirectTo: "/login" });
  return NextResponse.redirect(new URL(redirect ?? "/login", request.url), 303);
}
