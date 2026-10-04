package expo.modules.studyfocusmode

import org.junit.Assert.*
import org.junit.Test

class UpdateInstallStateTest {
  @Test fun cancelledInstallerReturnMakesDifferentCandidateDownloadable() {
    val afterReturn = UpdateInstallState.reconcile("install_pending", 2, 3, installerClosed = true)
    UpdateInstallState.requireDownloadAllowed(afterReturn, downloadActive = false, installPreparing = false)
    assertEquals("ready", afterReturn)
    val releaseB = AndroidRelease(UpdatePolicy.PACKAGE_NAME, "0.3.0", 4, "2026-10-04T12:00:00Z", emptyList(), "https://github.com/zxcc9867/studyRoom/releases/download/v4/app.apk", "a".repeat(64), 3)
    UpdatePolicy.requireNewer(releaseB, 2)
  }

  @Test fun deniedOrCancelledInstallerNeverReportsInstalledOnReturn() {
    assertEquals("ready", UpdateInstallState.reconcile("install_pending", 2, 3, installerClosed = true))
  }

  @Test fun processRestartInForegroundRecoversRetryableCandidate() {
    val restored = UpdateInstallState.reconcile("install_pending", 2, 3, installerClosed = true)
    assertEquals("ready", restored)
    UpdateInstallState.requireDownloadAllowed(restored, false, false)
  }

  @Test fun processRestartWhileInstallerOpenKeepsCandidateBusyUntilReturn() {
    val stillOpen = UpdateInstallState.reconcile("install_pending", 2, 3, installerClosed = false)
    assertEquals("install_pending", stillOpen)
    assertThrows(IllegalArgumentException::class.java) { UpdateInstallState.requireDownloadAllowed(stillOpen, false, false) }
    val afterReturn = UpdateInstallState.reconcile(stillOpen, 2, 3, installerClosed = true)
    assertEquals("ready", afterReturn)
    UpdateInstallState.requireDownloadAllowed(afterReturn, false, false)
  }

  @Test fun actualNativeVersionIsTheOnlySuccessSignal() {
    assertEquals("install_pending", UpdateInstallState.reconcile("install_pending", 2, 3, false))
    assertEquals("installed", UpdateInstallState.reconcile("install_pending", 3, 3, false))
    assertEquals("installed", UpdateInstallState.reconcile("install_pending", 4, 3, true))
    assertEquals("idle", UpdateInstallState.reconcile("idle", 3, null, true))
  }

  @Test fun installerReturnDoesNotReleaseActiveDownloadOrVerification() {
    assertEquals("downloading", UpdateInstallState.reconcile("downloading", 2, 3, true))
    assertThrows(IllegalArgumentException::class.java) { UpdateInstallState.requireDownloadAllowed("ready", true, false) }
    assertThrows(IllegalArgumentException::class.java) { UpdateInstallState.requireDownloadAllowed("ready", false, true) }
  }
}
