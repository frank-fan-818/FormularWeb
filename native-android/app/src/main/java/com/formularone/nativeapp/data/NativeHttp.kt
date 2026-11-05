package com.formularone.nativeapp.data

import com.formularone.nativeapp.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI

const val SITE_ORIGIN = "https://formular-web.vercel.app"
typealias BackendRequest = suspend (path: String, method: String, body: String?, token: String?) -> String
fun privateSnapshotPath(season: Int, round: Int, session: String, telemetry: Boolean = false): String {
    require(season in 1950..2100 && round > 0 && session in listOf("R", "Q", "S", "SQ", "SS", "FP1", "FP2", "FP3"))
    return "/storage/v1/object/authenticated/fastf1-private/$season/$round/$session${if (telemetry) "-telemetry" else ""}.json"
}
fun historyResultsPath(identity: String, kind: String, season: Int?): String {
    require(kind in listOf("drivers", "constructors", "circuits") && Regex("[a-zA-Z0-9_-]{1,80}").matches(identity))
    require(season == null || season in 1950..2100)
    return "/ergast/f1/${season?.let { "$it/" }.orEmpty()}$kind/$identity/${if (kind == "circuits") "races" else "results"}.json?limit=100"
}

class NativeHttp {
    suspend fun request(origin: String, path: String, method: String = "GET", body: String? = null, headers: Map<String, String> = emptyMap(), maxBytes: Int = 16_000_000, readTimeoutMs: Int = 35_000, connectTimeoutMs: Int = 10_000): String {
        val base = URI(origin)
        require(base.scheme == "https" && base.userInfo == null && base.rawPath.orEmpty().isEmpty())
        require(origin == SITE_ORIGIN || origin == BuildConfig.SUPABASE_URL || origin == "https://api.jolpi.ca")
        require(path.startsWith("/") && !path.startsWith("//") && !path.contains('#') && !path.contains('\\'))
        val url = URI(origin + path); require(url.host == base.host && url.scheme == "https" && url.userInfo == null)
        return withContext(Dispatchers.IO) {
            val connection = url.toURL().openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = connectTimeoutMs; connection.readTimeout = readTimeoutMs
                connection.instanceFollowRedirects = false; connection.useCaches = false
                connection.requestMethod = method
                connection.setRequestProperty("Accept", "application/json, application/xml, text/xml")
                connection.setRequestProperty("User-Agent", "FrankPitwall-Android/${BuildConfig.VERSION_NAME}")
                headers.forEach { (key, value) -> connection.setRequestProperty(key, value) }
                if (body != null) {
                    connection.doOutput = true; connection.setRequestProperty("Content-Type", "application/json")
                    connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                }
                val status = connection.responseCode
                if (status !in 200..299) throw HttpStatusException(status)
                val bytes = connection.inputStream.use { input ->
                    val output = ByteArrayOutputStream(); val buffer = ByteArray(8192)
                    while (true) {
                        currentCoroutineContext().ensureActive()
                        val size = input.read(buffer); if (size < 0) break
                        require(output.size() + size <= maxBytes) { "数据超过允许大小。" }
                        output.write(buffer, 0, size)
                    }
                    output.toByteArray()
                }
                currentCoroutineContext().ensureActive()
                bytes.toString(Charsets.UTF_8)
            } finally { connection.disconnect() }
        }
    }
    suspend fun backend(path: String, method: String = "GET", body: String? = null, token: String? = null): String {
        check(BuildConfig.SUPABASE_URL.isNotBlank() && BuildConfig.SUPABASE_ANON_KEY.isNotBlank()) { "此构建尚未配置账号服务。" }
        require(path.startsWith("/auth/v1/") || path.startsWith("/rest/v1/") || path.startsWith("/storage/v1/object/authenticated/fastf1-private/"))
        return request(BuildConfig.SUPABASE_URL, path, method, body, mapOf("apikey" to BuildConfig.SUPABASE_ANON_KEY, "Authorization" to "Bearer ${token ?: BuildConfig.SUPABASE_ANON_KEY}"))
    }
}
