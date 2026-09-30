import { issueMobileWebTicket, MobileWebTicketError } from "./mobile_web_auth.ts";

type Dependencies = Omit<Parameters<typeof issueMobileWebTicket>[0], "token">;

const responseHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

export async function handleMobileWebAuthRequest(request: Request, dependencies: Dependencies): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: responseHeaders });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!match) return Response.json({ error: "Unauthorized" }, { status: 401, headers: responseHeaders });

  try {
    const ticket = await issueMobileWebTicket({ token: match[1], ...dependencies });
    return Response.json(ticket, { status: 200, headers: responseHeaders });
  } catch (error) {
    const known = error instanceof MobileWebTicketError ? error : null;
    return Response.json(
      { error: known?.message ?? "Unavailable" },
      { status: known?.status ?? 503, headers: responseHeaders },
    );
  }
}
