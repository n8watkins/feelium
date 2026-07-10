import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { exportUserData } from "@/server/data";

/**
 * Downloads the signed-in user's complete data export as a JSON file (PRD 20).
 *
 * Lives under /api, which the route guard (proxy) excludes, so it enforces auth itself:
 * exportUserData() is strictly session-scoped and `auth()` gates access here. A dated
 * Content-Disposition filename makes the browser save it directly - the Settings > Data
 * button is just a link to this route.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const data = await exportUserData();
  const body = JSON.stringify(data, null, 2);
  const date = data.exportedAt.slice(0, 10); // YYYY-MM-DD
  const filename = `feelium-export-${date}.json`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
