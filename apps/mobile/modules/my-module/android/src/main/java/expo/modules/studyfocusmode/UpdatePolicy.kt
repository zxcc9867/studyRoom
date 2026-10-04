package expo.modules.studyfocusmode

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.URI
import java.security.MessageDigest
import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.concurrent.CancellationException

data class AndroidRelease(
  val packageName: String, val versionName: String, val versionCode: Long,
  val releasedAt: String, val releaseNotes: List<String>, val apkUrl: String,
  val sha256: String, val sizeBytes: Long,
) {
  fun toMap(): Map<String, Any> = mapOf(
    "schemaVersion" to 1, "packageName" to packageName, "versionName" to versionName,
    "versionCode" to versionCode, "releasedAt" to releasedAt, "releaseNotes" to releaseNotes,
    "apkUrl" to apkUrl, "sha256" to sha256, "sizeBytes" to sizeBytes,
  )
}

object UpdatePolicy {
  const val PACKAGE_NAME = "com.jini9867.studyroomattendance"
  const val MAX_APK_BYTES = 150L * 1024 * 1024
  const val RELEASE_URL = "https://study-room-attendance.vercel.app/download/android-release.json"
  private val artifactPath = Regex("/zxcc9867/studyRoom/releases/download/[A-Za-z0-9_-][A-Za-z0-9._-]*/[A-Za-z0-9_-][A-Za-z0-9._-]*\\.apk")

  private fun secureUri(url: String): URI {
    val uri = try { URI(url) } catch (_: Exception) { throw IllegalArgumentException("invalid_url") }
    require(uri.scheme == "https" && uri.host != null && uri.rawUserInfo == null && uri.rawFragment == null && (uri.port == -1 || uri.port == 443)) { "invalid_url" }
    require(!uri.rawPath.contains('%') && !uri.rawPath.split('/').any { it == "." || it == ".." }) { "invalid_url" }
    return uri
  }

  fun validateArtifactUrl(url: String): URI {
    val uri = secureUri(url)
    require(uri.host == "github.com" && uri.port == -1 && uri.rawQuery == null && artifactPath.matches(uri.rawPath)) { "invalid_artifact_url" }
    return uri
  }

  fun validateRedirectUrl(url: String): URI {
    val uri = secureUri(url)
    require(uri.host == "release-assets.githubusercontent.com" || uri.host == "github.com") { "invalid_redirect" }
    if (uri.host == "github.com") require(uri.rawQuery == null && artifactPath.matches(uri.rawPath)) { "invalid_redirect" }
    return uri
  }

  private fun integer(value: Any?, minimum: Long, maximum: Long): Long {
    require(value is Number) { "invalid_number" }
    val number = value.toDouble()
    require(number.isFinite() && number % 1.0 == 0.0 && number >= minimum.toDouble() && number <= maximum.toDouble()) { "invalid_number" }
    return number.toLong()
  }

  fun validateRelease(value: Map<String, Any?>): AndroidRelease {
    require(integer(value["schemaVersion"], 1, 1) == 1L) { "unsupported_schema" }
    require(value["packageName"] == PACKAGE_NAME) { "invalid_package" }
    val name = value["versionName"] as? String ?: throw IllegalArgumentException("invalid_version_name")
    require(name.isNotBlank() && name.length <= 32) { "invalid_version_name" }
    val code = integer(value["versionCode"], 1, 2100000000)
    val date = value["releasedAt"] as? String ?: throw IllegalArgumentException("invalid_release_date")
    require(Regex("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,9})?(Z|[+-]\\d{2}:\\d{2})").matches(date)) { "invalid_release_date" }
    val seconds = date.replace(Regex("\\.\\d+(?=Z|[+-])"), "")
    val position = ParsePosition(0)
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).apply { isLenient = false }
    require(formatter.parse(seconds, position) != null && position.index == seconds.length) { "invalid_release_date" }
    val notes = value["releaseNotes"] as? List<*> ?: throw IllegalArgumentException("invalid_release_notes")
    require(notes.size <= 8 && notes.all { it is String && it.isNotBlank() && it.length <= 200 }) { "invalid_release_notes" }
    val url = value["apkUrl"] as? String ?: throw IllegalArgumentException("invalid_artifact_url")
    validateArtifactUrl(url)
    val hash = value["sha256"] as? String ?: throw IllegalArgumentException("invalid_hash")
    require(Regex("[a-fA-F0-9]{64}").matches(hash)) { "invalid_hash" }
    val size = integer(value["sizeBytes"], 1, MAX_APK_BYTES)
    return AndroidRelease(PACKAGE_NAME, name, code, date, notes.map { it as String }, url, hash.lowercase(Locale.US), size)
  }

  fun requireNewer(release: AndroidRelease, installedCode: Long) {
    require(release.versionCode > installedCode) { "not_newer" }
  }

  fun requireHash(actual: String, expected: String) {
    require(actual.equals(expected, ignoreCase = true)) { "hash_mismatch" }
  }

  fun validateArchive(release: AndroidRelease, packageName: String, versionCode: Long, archiveSigners: Set<String>, installedSigners: Set<String>, installedCode: Long) {
    requireNewer(release, installedCode)
    require(packageName == PACKAGE_NAME && packageName == release.packageName) { "package_mismatch" }
    require(versionCode == release.versionCode) { "version_mismatch" }
    require(archiveSigners.isNotEmpty() && installedSigners.isNotEmpty() && archiveSigners == installedSigners) { "signer_mismatch" }
  }

  fun copyAndHash(input: InputStream, output: OutputStream, expectedBytes: Long, cancelled: () -> Boolean, progress: (Long) -> Unit): String {
    require(expectedBytes in 1..MAX_APK_BYTES) { "invalid_size" }
    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(32 * 1024)
    var count = 0L
    while (true) {
      if (cancelled()) throw CancellationException("cancelled")
      val read = input.read(buffer)
      if (cancelled()) throw CancellationException("cancelled")
      if (read == -1) break
      if (read == 0) continue
      require(count + read <= expectedBytes && count + read <= MAX_APK_BYTES) { "size_overflow" }
      output.write(buffer, 0, read)
      digest.update(buffer, 0, read)
      count += read
      progress(count)
    }
    require(count == expectedBytes) { "size_mismatch" }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  fun readBounded(input: InputStream, maximum: Int): ByteArray {
    require(maximum > 0)
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(1024)
    while (true) {
      val count = input.read(buffer)
      if (count == -1) return output.toByteArray()
      require(output.size().toLong() + count <= maximum) { "response_too_large" }
      output.write(buffer, 0, count)
    }
  }
}
