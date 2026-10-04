package expo.modules.studyfocusmode

object UpdateInstallState {
  fun reconcile(phase: String, installedCode: Long, targetCode: Long?, installerClosed: Boolean): String {
    if (targetCode != null && installedCode >= targetCode) return "installed"
    if (phase == "install_pending" && installerClosed) return "ready"
    return phase
  }

  fun requireDownloadAllowed(phase: String, downloadActive: Boolean, installPreparing: Boolean) {
    require(!downloadActive && !installPreparing && phase != "install_pending") { "update_busy" }
  }
}
