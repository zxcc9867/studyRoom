export function emailChannelConnected(targets, profile) {
  return profile?.email_reminders_enabled === true && Boolean(profile.email) &&
    targets.some(target => target.kind === 'email' && target.enabled === true);
}

export function setEmailConnection(request, connected) {
  // The authenticated server selects the verified email; never send an address
  // from profile/UI state, which may be stale or user-edited.
  return request('coach-notifications', {action:connected?'connect_email':'disconnect_email'});
}
