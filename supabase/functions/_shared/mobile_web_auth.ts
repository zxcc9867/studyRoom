type Caller = { id: string; email: string | null };
type GeneratedLink = {
  user: { id: string };
  properties: { hashed_token: string };
};

export class MobileWebTicketError extends Error {
  constructor(message: "Unauthorized" | "Rate limited" | "Unavailable", readonly status: 401 | 429 | 503) {
    super(message);
    this.name = "MobileWebTicketError";
  }
}

export async function issueMobileWebTicket(dependencies: {
  token: string;
  getUser: (token: string) => Promise<Caller | null>;
  allowIssue: (userId: string) => Promise<boolean>;
  generateLink: (email: string) => Promise<GeneratedLink | null>;
}): Promise<{ token_hash: string; user_id: string; verification_type: "magiclink" }> {
  if (!dependencies.token) throw new MobileWebTicketError("Unauthorized", 401);
  const caller = await dependencies.getUser(dependencies.token);
  if (!caller) throw new MobileWebTicketError("Unauthorized", 401);
  if (!caller.email) throw new MobileWebTicketError("Unavailable", 503);
  if (!await dependencies.allowIssue(caller.id)) throw new MobileWebTicketError("Rate limited", 429);

  const generated = await dependencies.generateLink(caller.email);
  if (generated?.user.id !== caller.id || !generated.properties.hashed_token) {
    throw new MobileWebTicketError("Unavailable", 503);
  }
  return {
    token_hash: generated.properties.hashed_token,
    user_id: caller.id,
    verification_type: "magiclink",
  };
}
