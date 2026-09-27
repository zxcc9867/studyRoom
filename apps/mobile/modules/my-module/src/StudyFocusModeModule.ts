import { requireOptionalNativeModule } from "expo";

type FocusModeNativeModule = {
  getStatus(): { supported: boolean; hasAccess: boolean; active: boolean };
  openPolicySettings(): void;
  setOwnRule(enabled: boolean, leaseExpiresAtMs: number): void;
};

export default requireOptionalNativeModule<FocusModeNativeModule>("StudyFocusMode");
