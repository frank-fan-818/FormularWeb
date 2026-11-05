package com.formularone.nativeapp.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.time.Clock
import java.time.Duration
import java.time.Instant

data class Loaded<T>(val data: T, val updatedAt: Instant, val stale: Boolean = false)

/** Public data only. JSON is decoded before persistence and before fallback. */
class PublicEndpointStore(
    private val directory: File,
    private val clock: Clock = Clock.systemUTC(),
    private val fetch: suspend (String) -> String,
) {
    private val mutex = Mutex()
    private var generation = 0L
    private val ttl = Duration.ofMinutes(10)
    suspend fun clear() = mutex.withLock {
        generation++
        withContext(Dispatchers.IO) { directory.listFiles { file -> file.isFile && file.extension in listOf("json", "tmp") }?.forEach { it.delete() }; Unit }
    }

    suspend fun <T> load(path: String, refresh: Boolean = false, decode: (String) -> T): Loaded<T> {
        val requestGeneration = mutex.withLock { generation }
        val digest = MessageDigest.getInstance("SHA-256").digest(path.toByteArray()).joinToString("") { "%02x".format(it) }
        val file = File(directory, "$digest.json")
        val cached = withContext(Dispatchers.IO) {
            runCatching {
                val saved = JSONObject(file.readText())
                Loaded(decode(saved.getString("body")), Instant.parse(saved.getString("updatedAt")))
            }.getOrNull()
        }
        val age = cached?.let { Duration.between(it.updatedAt, clock.instant()) }
        if (!refresh && cached != null && age != null && !age.isNegative && age < ttl) return cached
        return try {
            val body = fetch(path)
            currentCoroutineContext().ensureActive()
            val value = withContext(Dispatchers.IO) { Loaded(decode(body), clock.instant()) }
            mutex.withLock {
                if (generation != requestGeneration) return@withLock
                withContext(Dispatchers.IO) {
                // A cache write failure cannot hide a valid network response.
                runCatching {
                    directory.mkdirs()
                    val temp = File(directory, "$digest.tmp")
                    temp.writeText(JSONObject().put("body", body).put("updatedAt", value.updatedAt.toString()).toString())
                    java.nio.file.Files.move(temp.toPath(), file.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING)
                    directory.listFiles { entry -> entry.extension == "json" }?.sortedByDescending { it.lastModified() }
                        ?.drop(128)?.forEach { it.delete() }
                }
            }
            }
            value
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            cached?.copy(stale = true) ?: throw error
        }
    }
}
