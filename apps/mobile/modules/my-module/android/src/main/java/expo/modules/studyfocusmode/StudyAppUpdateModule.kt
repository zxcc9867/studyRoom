package expo.modules.studyfocusmode

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.OutputStream
import java.security.MessageDigest
import java.util.concurrent.CancellationException
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

private data class NativeUpdateState(
  val phase: String = "idle", val downloadedBytes: Long = 0,
  val release: AndroidRelease? = null, val errorCode: String? = null,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "phase" to phase, "downloadedBytes" to downloadedBytes, "totalBytes" to (release?.sizeBytes ?: 0L),
    "versionCode" to release?.versionCode, "errorCode" to errorCode, "release" to release?.toMap(),
  )
}

class StudyAppUpdateModule : Module() {
  private val lock = Any()
  private val workers = Executors.newCachedThreadPool { task -> Thread(task, "study-app-update").apply { isDaemon = true } }
  private var state = NativeUpdateState()
  private var recovered = false
  private var active: DownloadControl? = null
  private var installing = false
  private val main = Handler(Looper.getMainLooper())

  private fun context(): Context = appContext.reactContext?.applicationContext ?: throw IllegalStateException("context_unavailable")
  private fun prefs() = context().getSharedPreferences("study_app_updates", Context.MODE_PRIVATE)
  private fun storage() = UpdateStorage(context().cacheDir)
  @Suppress("DEPRECATION")
  private fun installedInfo(): PackageInfo = context().packageManager.getPackageInfo(context().packageName, signerFlags())
  @Suppress("DEPRECATION")
  private fun signerFlags() = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
  @Suppress("DEPRECATION")
  private fun code(info: PackageInfo): Long = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
  @Suppress("DEPRECATION")
  private fun signers(info: PackageInfo): Set<String> {
    val certificates = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures
    return certificates?.map { cert -> MessageDigest.getInstance("SHA-256").digest(cert.toByteArray()).joinToString("") { "%02x".format(it) } }?.toSet() ?: emptySet()
  }

  private fun installedVersion(): Map<String, Any> {
    val info = installedInfo()
    return mapOf("supported" to (Build.VERSION.SDK_INT >= 26 && info.packageName == UpdatePolicy.PACKAGE_NAME), "packageName" to info.packageName, "versionName" to (info.versionName ?: ""), "versionCode" to code(info))
  }

  private fun parseRelease(json: JSONObject): AndroidRelease {
    val values = json.keys().asSequence().associateWith { key ->
      when (val value = json.get(key)) {
        is JSONArray -> (0 until value.length()).map { value.get(it) }
        JSONObject.NULL -> null
        else -> value
      }
    }
    return UpdatePolicy.validateRelease(values)
  }

  private fun persist(candidate: NativeUpdateState) {
    val editor = prefs().edit()
    if (candidate.phase in setOf("ready", "install_pending") && candidate.release != null) {
      editor.putString("release", JSONObject(candidate.release.toMap()).toString()).putString("phase", candidate.phase)
    } else editor.remove("release").remove("phase")
    // Recovery metadata is best-effort. Missing metadata cannot authorize an install.
    editor.commit()
  }

  private fun emit(next: NativeUpdateState, save: Boolean = false) {
    state = next
    if (save) persist(next)
    sendEvent("onUpdateState", next.toMap())
  }

  private fun recover() {
    if (recovered) return
    recovered = true
    val files = storage()
    files.cleanup(installedCode = code(installedInfo()))
    val saved = prefs().getString("release", null) ?: return
    try {
      val release = parseRelease(JSONObject(saved))
      if (code(installedInfo()) >= release.versionCode) {
        files.completedFile(release).delete()
        emit(NativeUpdateState("installed", release.sizeBytes, release), true)
      } else if (files.completedFile(release).isFile && files.completedFile(release).length() == release.sizeBytes) {
        state = NativeUpdateState(if (prefs().getString("phase", "ready") == "install_pending") "install_pending" else "ready", release.sizeBytes, release)
      } else emit(NativeUpdateState("failed", release = release, errorCode = "download_missing"), true)
    } catch (_: Exception) { emit(NativeUpdateState("failed", errorCode = "recovery_failed"), true) }
  }

  private fun readState(): Map<String, Any?> = synchronized(lock) {
    recover()
    val release = state.release
    if (active == null && release != null && code(installedInfo()) >= release.versionCode) {
      storage().completedFile(release).delete()
      emit(NativeUpdateState("installed", release.sizeBytes, release), true)
    } else if (active == null && !installing && release != null && state.phase in setOf("ready", "install_pending")) {
      storage().cleanup(installedCode = code(installedInfo()))
      if (!storage().completedFile(release).isFile) emit(NativeUpdateState("failed", release = release, errorCode = "download_missing"), true)
    }
    state.toMap()
  }

  @Suppress("DEPRECATION")
  private fun verifyArchive(file: File, release: AndroidRelease) {
    require(file.canonicalFile == storage().completedFile(release).canonicalFile || (file.canonicalFile.parentFile == storage().directory.canonicalFile && file.name.endsWith(".part"))) { "invalid_storage_path" }
    require(file.isFile && file.length() == release.sizeBytes) { "size_mismatch" }
    val info = installedInfo()
    val archive = context().packageManager.getPackageArchiveInfo(file.absolutePath, signerFlags()) ?: throw IllegalArgumentException("invalid_apk")
    UpdatePolicy.validateArchive(release, archive.packageName, code(archive), signers(archive), signers(info), code(info))
  }

  private fun verifyFile(file: File, release: AndroidRelease) {
    storage().cleanup(installedCode = code(installedInfo()))
    val hash = file.inputStream().use { input ->
      UpdatePolicy.copyAndHash(input, object : OutputStream() {
        override fun write(value: Int) = Unit
        override fun write(bytes: ByteArray, offset: Int, length: Int) = Unit
      }, release.sizeBytes, { false }, {})
    }
    UpdatePolicy.requireHash(hash, release.sha256)
    verifyArchive(file, release)
  }

  private fun download(value: Map<String, Any?>, promise: Promise) {
    val release: AndroidRelease
    val control = DownloadControl()
    try {
      release = UpdatePolicy.validateRelease(value)
      require(Build.VERSION.SDK_INT >= 26 && context().packageName == UpdatePolicy.PACKAGE_NAME) { "unsupported" }
      synchronized(lock) {
        recover()
        require(active == null && !installing && state.phase != "install_pending") { "update_busy" }
        UpdatePolicy.requireNewer(release, code(installedInfo()))
        require(storage().directory.usableSpace >= release.sizeBytes + 1024 * 1024) { "insufficient_space" }
        emit(NativeUpdateState("downloading", release = release), true)
        active = control
      }
    } catch (_: Exception) { promise.reject("update_unavailable", "업데이트 다운로드를 시작할 수 없습니다", null); return }
    workers.execute {
      var part: File? = null
      try {
        part = storage().newPart()
        var lastProgress = 0L
        UpdateDownloader().download(release, part, control) { count ->
          val now = SystemClock.elapsedRealtime()
          if (now - lastProgress >= 250) synchronized(lock) {
            control.check()
            emit(NativeUpdateState("downloading", count, release))
            lastProgress = now
          }
        }
        synchronized(lock) { control.check(); emit(NativeUpdateState("verifying", release.sizeBytes, release)) }
        verifyArchive(part, release)
        synchronized(lock) {
          control.check()
          storage().commit(part, release)
          active = null
          emit(NativeUpdateState("ready", release.sizeBytes, release), true)
          promise.resolve(state.toMap())
        }
      } catch (error: Exception) {
        synchronized(lock) {
          active = null
          val cancelled = error is CancellationException || state.phase == "cancelled"
          emit(NativeUpdateState(if (cancelled) "cancelled" else "failed", state.downloadedBytes, release, if (cancelled) null else "download_failed"), true)
          storage().completedFile(release).delete()
          promise.resolve(state.toMap())
        }
      } finally { part?.delete() }
    }
  }

  private fun cancel(): Map<String, Any?> = synchronized(lock) {
    recover()
    active?.let { control ->
      control.cancel()
      emit(state.copy(phase = "cancelled", errorCode = null), true)
    }
    state.toMap()
  }

  private fun canInstall() = Build.VERSION.SDK_INT >= 26 && context().packageManager.canRequestPackageInstalls()

  private fun install(promise: Promise) {
    val release: AndroidRelease
    try {
      synchronized(lock) {
        recover()
        require(active == null && !installing && state.phase in setOf("ready", "install_pending")) { "not_ready" }
        require(canInstall()) { "install_permission_required" }
        release = state.release ?: throw IllegalStateException("not_ready")
        installing = true
      }
    } catch (_: Exception) { promise.reject("install_unavailable", "설치 권한과 다운로드 상태를 확인해 주세요", null); return }
    workers.execute {
      try {
        val file = storage().completedFile(release)
        verifyFile(file, release)
        main.post {
          try {
            synchronized(lock) {
              require(canInstall()) { "install_permission_required" }
              UpdatePolicy.requireNewer(release, code(installedInfo()))
              val uri = FileProvider.getUriForFile(context(), "${context().packageName}.study-app-update", file)
              val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
              intent.clipData = ClipData.newRawUri("Study app update", uri)
              context().startActivity(intent)
              emit(NativeUpdateState("install_pending", release.sizeBytes, release), true)
              installing = false
              promise.resolve(state.toMap())
            }
          } catch (_: Exception) {
            synchronized(lock) { installing = false }
            promise.reject("install_failed", "Android 설치 화면을 열 수 없습니다", null)
          }
        }
      } catch (_: Exception) {
        synchronized(lock) {
          installing = false
          storage().completedFile(release).delete()
          emit(NativeUpdateState("failed", release = release, errorCode = "verification_failed"), true)
          promise.resolve(state.toMap())
        }
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("StudyAppUpdate")
    Events("onUpdateState")
    Function("getInstalledVersion") { installedVersion() }
    Function("getState") { readState() }
    AsyncFunction("fetchLatestRelease") { promise: Promise ->
      workers.execute {
        try { promise.resolve(parseRelease(JSONObject(UpdateDownloader().fetchManifest().toString(Charsets.UTF_8))).toMap()) }
        catch (_: Exception) { promise.reject("release_unavailable", "최신 버전을 확인하지 못했습니다", null) }
      }
    }
    AsyncFunction("downloadRelease") { release: Map<String, Any?>, promise: Promise -> download(release, promise) }
    Function("cancelDownload") { cancel() }
    Function("canInstall") { canInstall() }
    Function("openInstallPermissionSettings") {
      require(Build.VERSION.SDK_INT >= 26)
      context().startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context().packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("installDownloaded") { promise: Promise -> install(promise) }
    OnDestroy { synchronized(lock) { active?.cancel() }; workers.shutdownNow() }
  }
}
