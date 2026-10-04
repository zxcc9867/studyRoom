package expo.modules.studyfocusmode

import java.io.ByteArrayInputStream
import java.io.File
import java.net.URI
import java.nio.file.Files
import java.security.cert.Certificate
import java.util.concurrent.CancellationException
import javax.net.ssl.HttpsURLConnection
import org.junit.Assert.*
import org.junit.Test

class UpdateDownloaderTest {
  private val owned = "https://github.com/zxcc9867/studyRoom/releases/download/v3/app.apk"
  private val release = AndroidRelease(UpdatePolicy.PACKAGE_NAME, "0.2.0", 3, "2026-10-04T12:00:00Z", emptyList(), owned, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", 3)
  private class Response(uri: URI, val code: Int, val bytes: ByteArray, val redirect: String? = null) : HttpsURLConnection(uri.toURL()) {
    var disconnected = false
    override fun connect() = Unit
    override fun disconnect() { disconnected = true }
    override fun usingProxy() = false
    override fun getCipherSuite() = "fixture"
    override fun getLocalCertificates(): Array<Certificate>? = null
    override fun getServerCertificates(): Array<Certificate> = emptyArray()
    override fun getResponseCode() = code
    override fun getInputStream() = ByteArrayInputStream(bytes)
    override fun getHeaderField(name: String?): String? = if (name == "Location") redirect else null
    override fun getContentLengthLong() = bytes.size.toLong()
  }

  @Test fun downloadsViaPermittedRedirectAndHashesRealBytes() {
    val root = Files.createTempDirectory("download-test").toFile()
    val responses = mutableListOf<Response>()
    try {
      val downloader = UpdateDownloader { uri ->
        Response(uri, if (uri.host == "github.com") 302 else 200, if (uri.host == "github.com") byteArrayOf() else "abc".toByteArray(), if (uri.host == "github.com") "https://release-assets.githubusercontent.com/a?signature=fixture" else null).also { responses.add(it) }
      }
      val file = File(root, "download.part")
      downloader.download(release, file, DownloadControl(), {})
      assertEquals("abc", file.readText())
      assertTrue(responses.all { it.disconnected })
    } finally { root.deleteRecursively() }
  }

  @Test fun rejectsForeignRedirectBeforeTransportOpensIt() {
    val root = Files.createTempDirectory("redirect-test").toFile()
    val opened = mutableListOf<String>()
    try {
      val downloader = UpdateDownloader { uri -> opened.add(uri.host); Response(uri, 302, byteArrayOf(), "https://evil.test/app.apk") }
      assertThrows(IllegalArgumentException::class.java) { downloader.download(release, File(root, "x.part"), DownloadControl(), {}) }
      assertEquals(listOf("github.com"), opened)
    } finally { root.deleteRecursively() }
  }

  @Test fun rejectsSixthRedirect() {
    val root = Files.createTempDirectory("redirect-count-test").toFile()
    var opened = 0
    try {
      val downloader = UpdateDownloader { uri -> opened++; Response(uri, 302, byteArrayOf(), "https://release-assets.githubusercontent.com/a?signature=fixture") }
      assertThrows(IllegalArgumentException::class.java) { downloader.download(release, File(root, "x.part"), DownloadControl(), {}) }
      assertEquals(6, opened)
    } finally { root.deleteRecursively() }
  }

  @Test fun preCancelledDownloadDoesNotOpenTransport() {
    val root = Files.createTempDirectory("cancel-test").toFile()
    var opened = false
    try {
      val downloader = UpdateDownloader { uri -> opened = true; Response(uri, 200, "abc".toByteArray()) }
      val control = DownloadControl().apply { cancel() }
      assertThrows(CancellationException::class.java) { downloader.download(release, File(root, "x.part"), control, {}) }
      assertFalse(opened)
    } finally { root.deleteRecursively() }
  }

  @Test fun manifestIsFixedBoundedAndNeverRedirects() {
    var opened: String? = null
    val downloader = UpdateDownloader { uri -> opened = uri.toString(); Response(uri, 200, "{}".toByteArray()) }
    assertEquals("{}", downloader.fetchManifest().toString(Charsets.UTF_8))
    assertEquals("https://study-room-attendance.vercel.app/download/android-release.json", opened)
    assertThrows(IllegalArgumentException::class.java) { UpdateDownloader { uri -> Response(uri, 200, ByteArray(16385)) }.fetchManifest() }
    assertThrows(IllegalArgumentException::class.java) { UpdateDownloader { uri -> Response(uri, 302, byteArrayOf(), owned) }.fetchManifest() }
  }
}
