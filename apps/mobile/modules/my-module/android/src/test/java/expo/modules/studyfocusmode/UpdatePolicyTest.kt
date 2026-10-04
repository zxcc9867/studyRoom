package expo.modules.studyfocusmode

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.concurrent.CancellationException
import org.junit.Assert.*
import org.junit.Test

class UpdatePolicyTest {
  private val owned = "https://github.com/zxcc9867/studyRoom/releases/download/android-v0.2.0-build3/study-room.apk"
  private val abcHash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  private fun fixture() = mapOf<String, Any>(
    "schemaVersion" to 1, "packageName" to "com.jini9867.studyroomattendance",
    "versionName" to "0.2.0", "versionCode" to 3, "releasedAt" to "2026-10-04T12:00:00+09:00",
    "releaseNotes" to listOf("앱 업데이트"), "apkUrl" to owned, "sha256" to abcHash, "sizeBytes" to 3,
  )

  @Test fun acceptsOwnedRelease() { assertEquals("github.com", UpdatePolicy.validateArtifactUrl(owned).host) }

  @Test fun rejectsUnsafeArtifactUrls() {
    listOf(
      "https://github.com/attacker/repo/releases/download/v1/app.apk", owned.replace("https:", "http:"),
      owned.replace("github.com", "user@github.com"), "$owned?x=1", "$owned#fragment",
      owned.replace("android-v0.2.0-build3", "%2e%2e"), owned.replace("android-v0.2.0-build3", "../v3"),
      owned.replace("github.com", "github.com.evil.test"), owned.replace("github.com", "github.com:443"),
      owned.replace("study-room.apk", "other.zip"), owned.replace("studyRoom", "studyroom"),
    ).forEach { url -> assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.validateArtifactUrl(url) } }
  }

  @Test fun permitsOnlyExactHttpsRedirectHosts() {
    assertEquals("release-assets.githubusercontent.com", UpdatePolicy.validateRedirectUrl("https://release-assets.githubusercontent.com/assets/file?signature=abc").host)
    listOf("https://evil.test/a", "http://release-assets.githubusercontent.com/a", "https://release-assets.githubusercontent.com.evil.test/a", "https://user@github.com/a", "https://github.com:8443/a", "https://github.com/a#x", "https://github.com/attacker/repo/a").forEach {
      assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.validateRedirectUrl(it) }
    }
  }

  @Test fun validatesCompleteSchema() {
    assertEquals(3L, UpdatePolicy.validateRelease(fixture()).versionCode)
    val invalid = listOf(
      "schemaVersion" to 2, "packageName" to "other.app", "versionName" to "", "versionName" to "a".repeat(33),
      "versionCode" to 1.5, "versionCode" to 0, "versionCode" to 2147483648L,
      "releasedAt" to "2026-10-04T12:00:00", "releasedAt" to "2026-02-30T12:00:00Z",
      "releaseNotes" to List(9) { "note" }, "releaseNotes" to listOf("x".repeat(201)), "releaseNotes" to listOf(3),
      "sha256" to "bad", "sha256" to "g".repeat(64), "sizeBytes" to 0, "sizeBytes" to 157286401L,
      "sizeBytes" to 3.5, "apkUrl" to "https://evil.test/file.apk",
    )
    invalid.forEach { (key, value) -> assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.validateRelease(fixture() + (key to value)) } }
    fixture().keys.forEach { missing -> assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.validateRelease(fixture() - missing) } }
  }

  @Test fun rejectsSameAndLowerInstalledVersion() {
    val release = UpdatePolicy.validateRelease(fixture())
    assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.requireNewer(release, 3) }
    assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.requireNewer(release, 4) }
    UpdatePolicy.requireNewer(release, 2)
  }

  @Test fun rejectsBlankReleaseNotesButAllowsEmptyArray() {
    listOf("", "   ", "\t\r\n", "\u00a0\u2003").forEach { note ->
      assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.validateRelease(fixture() + ("releaseNotes" to listOf(note))) }
    }
    assertTrue(UpdatePolicy.validateRelease(fixture() + ("releaseNotes" to emptyList<String>())).releaseNotes.isEmpty())
    assertEquals(listOf("  업데이트 안내  "), UpdatePolicy.validateRelease(fixture() + ("releaseNotes" to listOf("  업데이트 안내  "))).releaseNotes)
  }

  @Test fun releaseDateFractionAndTimeBoundsMatchPublisherAndJsContract() {
    listOf("2026-10-04T12:00:00.1234567890Z", "2026-10-04T24:00:00Z", "2026-10-04T12:60:00Z", "2026-10-04T12:00:60Z", "2026-10-04T12:00:00+24:00", "2026-10-04T12:00:00+09:60").forEach { date ->
      assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.validateRelease(fixture() + ("releasedAt" to date)) }
    }
    listOf("2026-10-04T23:59:59.1Z", "2026-10-04T23:59:59.123456789+09:00").forEach { date ->
      assertEquals(date, UpdatePolicy.validateRelease(fixture() + ("releasedAt" to date)).releasedAt)
    }
  }

  @Test fun copiesExactBytesAndChecksIndependentHash() {
    val output = ByteArrayOutputStream()
    assertEquals(abcHash, UpdatePolicy.copyAndHash(ByteArrayInputStream("abc".toByteArray()), output, 3, { false }, {}))
    assertArrayEquals(byteArrayOf(97, 98, 99), output.toByteArray())
    UpdatePolicy.requireHash(abcHash, abcHash.uppercase())
    assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.requireHash(abcHash, "0".repeat(64)) }
  }

  @Test fun rejectsOverflowWithoutWritingExcessBytes() {
    val output = ByteArrayOutputStream()
    assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.copyAndHash(ByteArrayInputStream("abcd".toByteArray()), output, 3, { false }, {}) }
    assertTrue(output.size() <= 3)
  }

  @Test fun rejectsTruncatedAndEmptyFiles() {
    listOf("", "ab").forEach { assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.copyAndHash(ByteArrayInputStream(it.toByteArray()), ByteArrayOutputStream(), 3, { false }, {}) } }
  }

  @Test fun cancellationStopsBytesImmediately() {
    val output = ByteArrayOutputStream()
    assertThrows(CancellationException::class.java) { UpdatePolicy.copyAndHash(ByteArrayInputStream("abc".toByteArray()), output, 3, { true }, {}) }
    assertEquals(0, output.size())
  }

  @Test fun cancellationDuringReadDoesNotWriteReturnedBytes() {
    var cancelled = false
    val input = object : ByteArrayInputStream("abc".toByteArray()) {
      override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
        val count = super.read(bytes, offset, length)
        cancelled = true
        return count
      }
    }
    val output = ByteArrayOutputStream()
    assertThrows(CancellationException::class.java) { UpdatePolicy.copyAndHash(input, output, 3, { cancelled }, {}) }
    assertEquals(0, output.size())
  }

  @Test fun rejectsInvalidExpectedByteBoundsBeforeReading() {
    listOf(0L, -1L, 157286401L).forEach {
      assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.copyAndHash(ByteArrayInputStream(byteArrayOf(97)), ByteArrayOutputStream(), it, { false }, {}) }
    }
  }

  @Test fun manifestReadIsBoundedAndNotTruncated() {
    assertArrayEquals(byteArrayOf(97, 98, 99), UpdatePolicy.readBounded(ByteArrayInputStream("abc".toByteArray()), 3))
    assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.readBounded(ByteArrayInputStream("abcd".toByteArray()), 3) }
  }

  @Test fun validatesPackageVersionAndEntireSignerSet() {
    val release = UpdatePolicy.validateRelease(fixture())
    UpdatePolicy.validateArchive(release, "com.jini9867.studyroomattendance", 3, setOf("a", "b"), setOf("b", "a"), 2)
    listOf(setOf("a"), setOf("a", "b", "c"), emptySet()).forEach {
      assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.validateArchive(release, "com.jini9867.studyroomattendance", 3, it, setOf("a", "b"), 2) }
    }
    assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.validateArchive(release, "other", 3, setOf("a"), setOf("a"), 2) }
    assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.validateArchive(release, "com.jini9867.studyroomattendance", 4, setOf("a"), setOf("a"), 2) }
    assertThrows(IllegalArgumentException::class.java) { UpdatePolicy.validateArchive(release, "com.jini9867.studyroomattendance", 3, setOf("a"), setOf("a"), 3) }
  }
}
