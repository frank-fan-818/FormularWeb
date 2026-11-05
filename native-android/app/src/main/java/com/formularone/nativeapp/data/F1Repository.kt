package com.formularone.nativeapp.data

import com.formularone.nativeapp.BuildConfig
import com.formularone.nativeapp.model.Classification
import com.formularone.nativeapp.model.Race
import com.formularone.nativeapp.model.Session
import com.formularone.nativeapp.model.Standing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

interface F1Repository {
    suspend fun clearCache() {}
    suspend fun races(year: Int, refresh: Boolean = false): Loaded<List<Race>>
    suspend fun results(race: Race, session: Session, refresh: Boolean = false): Loaded<List<Classification>>
    suspend fun standings(year: Int, constructors: Boolean, refresh: Boolean = false): Loaded<List<Standing>>
}

class HttpStatusException(val status: Int) : IOException("HTTP $status")

class PublicF1Repository(cacheDirectory: File, private val features: FeatureRepository? = null) : F1Repository {
    private val transport = F1Http()
    private val store = PublicEndpointStore(File(cacheDirectory, "f1-public-v1"), fetch = transport::get)
    override suspend fun clearCache() { store.clear(); features?.clearCache() }
    override suspend fun races(year: Int, refresh: Boolean): Loaded<List<Race>> =
        store.load("$year.json?limit=100", refresh, F1Mapper::races)
    override suspend fun results(race: Race, session: Session, refresh: Boolean): Loaded<List<Classification>> {
        if (session.endpoint.isBlank()) return requireNotNull(features) { "此构建未配置场次服务。" }.sessionResults(race, session, refresh)
        return store.load("${race.season}/${race.round}/${session.endpoint}.json?limit=100", refresh) { F1Mapper.classification(it, session) }
    }
    override suspend fun standings(year: Int, constructors: Boolean, refresh: Boolean): Loaded<List<Standing>> =
        store.load("$year/${if (constructors) "constructorStandings" else "driverStandings"}.json?limit=100", refresh) {
            F1Mapper.standings(it, constructors)
        }
}

private class F1Http {
    private val rateLock = Mutex()
    private var previousRequest = 0L
    suspend fun get(path: String): String {
        require(Regex("\\d{4}(?:/\\d+/(?:results|qualifying|sprint)|/(?:driverStandings|constructorStandings))?\\.json\\?limit=100").matches(path))
        rateLock.withLock {
            val remaining = 300L - (System.nanoTime() / 1_000_000 - previousRequest)
            if (remaining > 0) delay(remaining)
            previousRequest = System.nanoTime() / 1_000_000
        }
        return withContext(Dispatchers.IO) {
            val connection = URL("https://api.jolpi.ca/ergast/f1/$path").openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 8_000
                connection.readTimeout = 12_000
                connection.instanceFollowRedirects = false
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("User-Agent", "FrankPitwall-Android/${BuildConfig.VERSION_NAME}")
                if (connection.responseCode != 200) throw HttpStatusException(connection.responseCode)
                val bytes = connection.inputStream.use { input ->
                    val output = ByteArrayOutputStream()
                    val buffer = ByteArray(8192)
                    while (true) {
                        currentCoroutineContext().ensureActive()
                        val count = input.read(buffer)
                        if (count < 0) break
                        require(output.size() + count <= 2_000_000) { "响应超过允许的数据大小。" }
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                }
                currentCoroutineContext().ensureActive()
                bytes.toString(Charsets.UTF_8)
            } finally { connection.disconnect() }
        }
    }
}
