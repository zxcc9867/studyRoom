export type RecoveryStartResumeInput = {
  resumeRequested: boolean;
  blockingRecoveryCount: number;
  recoveryModalOpen: boolean;
  activeSession: boolean;
  busy: boolean;
  refreshing?: boolean;
};

export function shouldResumeStartAfterRecoveryUnlock(input: RecoveryStartResumeInput): boolean;
