package expo.modules.studyfocusmode

import java.io.File
import java.nio.file.Files
import org.junit.Assert.*
import org.junit.Test

class UpdateStorageTest {
  @Test fun commitsOnlyUpdaterPartFilesAndKeepsOtherCachePrivate() {
    val root = Files.createTempDirectory("update-storage-test").toFile()
    try {
      val other = File(root, "login-cache").apply { writeText("keep") }
      val storage = UpdateStorage(root)
      val part = storage.newPart().apply { writeText("abc") }
      val release = AndroidRelease(UpdatePolicy.PACKAGE_NAME, "0.2.0", 3, "2026-10-04T12:00:00Z", emptyList(), "https://github.com/zxcc9867/studyRoom/releases/download/v3/app.apk", "a".repeat(64), 3)
      val final = storage.commit(part, release)
      assertEquals(File(root, "study-updates").canonicalPath, final.parentFile!!.canonicalPath)
      assertEquals("abc", final.readText())
      assertFalse(part.exists())
      assertEquals("keep", other.readText())
      assertThrows(IllegalArgumentException::class.java) { storage.commit(other, release) }
      assertTrue(other.exists())
    } finally { root.deleteRecursively() }
  }

  @Test fun startupCleanupRemovesPartialAndExpiredFilesOnly() {
    val root = Files.createTempDirectory("update-cleanup-test").toFile()
    try {
      val storage = UpdateStorage(root)
      val partial = storage.newPart().apply { writeText("partial") }
      val expired = File(root, "study-updates/expired.apk").apply { writeText("old"); setLastModified(1000) }
      val recent = File(root, "study-updates/recent.apk").apply { writeText("recent"); setLastModified(90000000) }
      val unrelated = File(root, "auth").apply { writeText("keep"); setLastModified(1000) }
      storage.cleanup(90000001)
      assertFalse(partial.exists())
      assertFalse(expired.exists())
      assertTrue(recent.exists())
      assertEquals("keep", unrelated.readText())
    } finally { root.deleteRecursively() }
  }

  @Test fun installedVersionCleanupRemovesOnlyOlderUpdaterArtifacts() {
    val root = Files.createTempDirectory("installed-cleanup-test").toFile()
    try {
      val storage = UpdateStorage(root)
      val older = File(storage.directory, "2-${"a".repeat(64)}.apk").apply { writeText("old") }
      val installed = File(storage.directory, "3-${"b".repeat(64)}.apk").apply { writeText("installed") }
      val newer = File(storage.directory, "4-${"c".repeat(64)}.apk").apply { writeText("new") }
      val other = File(root, "auth-cache").apply { writeText("keep") }
      storage.cleanup(System.currentTimeMillis(), 3)
      assertFalse(older.exists())
      assertFalse(installed.exists())
      assertTrue(newer.exists())
      assertEquals("keep", other.readText())
    } finally { root.deleteRecursively() }
  }
}
