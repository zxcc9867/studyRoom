const trustedOrigin = 'https://study-room-attendance.vercel.app';

export function isEmbeddedStudyApp(host) {
  return host?.location?.origin === trustedOrigin
    && typeof host?.ReactNativeWebView?.postMessage === 'function';
}

export function parseEmbeddedTicket(value) {
  if (!value || typeof value !== 'object' || value.type !== 'STUDY_WEB_AUTH_TICKET') return null;
  if (typeof value.requestId !== 'string' || value.requestId.length < 1 || value.requestId.length > 128) return null;
  if (typeof value.userId !== 'string' || value.userId.length < 1 || value.userId.length > 128) return null;
  if (typeof value.tokenHash !== 'string' || value.tokenHash.length < 1 || value.tokenHash.length > 4096) return null;
  return {
    type: 'STUDY_WEB_AUTH_TICKET',
    requestId: value.requestId,
    userId: value.userId,
    tokenHash: value.tokenHash,
  };
}

export async function consumeEmbeddedTicket(supabase, value, expectedRequestId) {
  const ticket = parseEmbeddedTicket(value);
  if (!ticket || ticket.requestId !== expectedRequestId) throw new Error('Invalid ticket');

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: ticket.tokenHash,
    type: 'magiclink',
  });
  if (error || !data?.session || !data.user) throw new Error('Ticket exchange failed');
  if (data.user.id !== ticket.userId || data.session.user.id !== ticket.userId) {
    await supabase.auth.signOut({ scope: 'local' });
    throw new Error('Account mismatch');
  }
  return data.session;
}

export function postEmbeddedMessage(host, message) {
  if (!isEmbeddedStudyApp(host)) return false;
  host.ReactNativeWebView.postMessage(JSON.stringify(message));
  return true;
}

export async function beginEmbeddedAuthentication(supabase, host, requestId) {
  await supabase.auth.signOut({ scope: 'local' });
  if (!postEmbeddedMessage(host, { type: 'STUDY_WEB_READY', requestId })) {
    throw new Error('Native bridge unavailable');
  }
}
