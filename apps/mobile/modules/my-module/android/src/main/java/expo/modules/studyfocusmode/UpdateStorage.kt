package expo.modules.studyfocusmode

import java.io.File
import java.util.UUID

class UpdateStorage(cacheDir: File) {
  val directory = File(cacheDir, "study-updates").apply {
    check(isDirectory || mkdirs()) { "storage_unavailable" }
  }
  fun newPart() = File(directory, "download-${UUID.randomUUID()}.part")
  fun completedFile(release: AndroidRelease) = File(directory, "${release.versionCode}-${release.sha256}.apk")
  fun commit(part: File, release: AndroidRelease): File {
    require(part.canonicalFile.parentFile == directory.canonicalFile && part.name.endsWith(".part")) { "invalid_storage_path" }
    require(part.length() == release.sizeBytes) { "size_mismatch" }
    val result = completedFile(release)
    check(part.renameTo(result)) { "storage_commit_failed" }
    return result
  }
  fun cleanup(now: Long = System.currentTimeMillis(), installedCode: Long? = null) {
    directory.listFiles()?.filter { file ->
      val candidateCode = Regex("(\\d+)-[a-f0-9]{64}\\.apk").matchEntire(file.name)?.groupValues?.get(1)?.toLongOrNull()
      file.isFile && (file.name.endsWith(".part") || now - file.lastModified() >= 24L * 60 * 60 * 1000 || (installedCode != null && candidateCode != null && candidateCode <= installedCode))
    }?.forEach { it.delete() }
  }
}
