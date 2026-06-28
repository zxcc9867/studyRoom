export function shouldResumeStartAfterRecoveryUnlock({
  resumeRequested,
  blockingRecoveryCount,
  recoveryModalOpen,
  activeSession,
  busy,
  refreshing = false,
}) {
  return Boolean(
    resumeRequested &&
      blockingRecoveryCount === 0 &&
      !recoveryModalOpen &&
      !activeSession &&
      !busy &&
      !refreshing,
  );
}
