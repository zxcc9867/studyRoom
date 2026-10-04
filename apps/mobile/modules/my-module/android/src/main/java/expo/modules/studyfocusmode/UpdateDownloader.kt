package expo.modules.studyfocusmode

import java.io.File
import java.io.IOException
import java.net.URI
import java.util.concurrent.CancellationException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import javax.net.ssl.HttpsURLConnection

class DownloadControl {
  private val cancelled = AtomicBoolean(false)
  private val timedOut = AtomicBoolean(false)
  private val connection = AtomicReference<HttpsURLConnection?>(null)
  fun cancel() { cancelled.set(true); disconnectAsync() }
  fun timeout() { timedOut.set(true); disconnectAsync() }
  private fun disconnectAsync() { connection.get()?.let { current -> disconnectExecutor.execute { current.disconnect() } } }
  fun check() {
    if (cancelled.get()) throw CancellationException("cancelled")
    if (timedOut.get()) throw IOException("timeout")
  }
  fun attach(value: HttpsURLConnection) { connection.set(value); check() }
  fun detach(value: HttpsURLConnection) { connection.compareAndSet(value, null) }
  companion object {
    private val disconnectExecutor = Executors.newCachedThreadPool { job -> Thread(job, "study-update-disconnect").apply { isDaemon = true } }
  }
}

class UpdateDownloader(private val open: (URI) -> HttpsURLConnection = { it.toURL().openConnection() as HttpsURLConnection }) {
  private fun <T> withResponse(initial: URI, control: DownloadControl, timeoutMs: Long, manifest: Boolean, block: (HttpsURLConnection) -> T): T {
    val timer = Executors.newSingleThreadScheduledExecutor { job -> Thread(job, "study-update-timeout").apply { isDaemon = true } }
    val watchdog = timer.schedule({ control.timeout() }, timeoutMs, TimeUnit.MILLISECONDS)
    var uri = initial
    var redirects = 0
    try {
      while (true) {
        control.check()
        val connection = open(uri)
        try {
          control.attach(connection)
          connection.instanceFollowRedirects = false
          connection.useCaches = false
          connection.connectTimeout = if (manifest) 12000 else 15000
          connection.readTimeout = if (manifest) 12000 else 30000
          connection.setRequestProperty("Accept-Encoding", "identity")
          connection.setRequestProperty("Cookie", "")
          connection.setRequestProperty("Authorization", "")
          val code = connection.responseCode
          control.check()
          if (code in listOf(301, 302, 303, 307, 308)) {
            require(!manifest && redirects < 5) { "invalid_redirect" }
            val location = connection.getHeaderField("Location") ?: throw IllegalArgumentException("invalid_redirect")
            uri = UpdatePolicy.validateRedirectUrl(uri.resolve(location).toString())
            redirects++
            continue
          }
          require(code == 200) { "http_failure" }
          val result = block(connection)
          control.check()
          return result
        } finally {
          control.detach(connection)
          connection.disconnect()
        }
      }
    } finally { watchdog.cancel(false); timer.shutdownNow() }
  }

  fun fetchManifest(): ByteArray {
    val control = DownloadControl()
    return withResponse(URI(UpdatePolicy.RELEASE_URL), control, 12000, true) { connection ->
      require(connection.contentLengthLong <= 16384) { "response_too_large" }
      connection.inputStream.use { UpdatePolicy.readBounded(it, 16384) }
    }
  }

  fun download(release: AndroidRelease, part: File, control: DownloadControl, progress: (Long) -> Unit) {
    withResponse(UpdatePolicy.validateArtifactUrl(release.apkUrl), control, 10L * 60 * 1000, false) { connection ->
      require(connection.contentLengthLong < 0 || connection.contentLengthLong == release.sizeBytes) { "size_mismatch" }
      val hash = connection.inputStream.use { input ->
        part.outputStream().use { output ->
          UpdatePolicy.copyAndHash(input, output, release.sizeBytes, { control.check(); false }, progress)
        }
      }
      UpdatePolicy.requireHash(hash, release.sha256)
    }
  }
}
