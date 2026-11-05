package com.formularone.nativeapp

import com.formularone.nativeapp.data.PublicEndpointStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.IOException
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

class PublicEndpointStoreTest {
    @get:Rule val folder = TemporaryFolder()
    private val clock = Clock.fixed(Instant.parse("2026-10-27T00:00:00Z"), ZoneOffset.UTC)

    @Test fun `slow endpoint does not block another cache key`() = runBlocking {
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val store = PublicEndpointStore(folder.root, clock) { path ->
            if (path == "slow") {
                started.complete(Unit)
                release.await()
            }
            path
        }
        val slow = async { store.load("slow") { it } }
        started.await()
        try {
            assertEquals("fast", withTimeout(5_000) { store.load("fast") { it }.data })
        } finally {
            release.complete(Unit)
        }
        assertEquals("slow", slow.await().data)
    }

    @Test fun `fresh public cache prevents duplicate network requests`() = runTest {
        var calls = 0
        val store = PublicEndpointStore(folder.root, clock) { calls++; "valid" }
        val first = store.load("2025.json?limit=100", false) { it }
        val next = store.load("2025.json?limit=100", false) { it }
        assertEquals(1, calls)
        assertEquals(first.data, next.data)
        assertFalse(next.stale)
    }

    @Test fun `forced refresh failure returns old data explicitly marked stale`() = runTest {
        var fail = false
        val store = PublicEndpointStore(folder.root, clock) { if (fail) throw IOException("offline") else "valid" }
        store.load("2025.json?limit=100", false) { it }
        fail = true
        val result = store.load("2025.json?limit=100", true) { it }
        assertEquals("valid", result.data)
        assertTrue(result.stale)
        assertEquals(clock.instant(), result.updatedAt)
    }

    @Test fun `season keys never share cached responses`() = runTest {
        val store = PublicEndpointStore(folder.root, clock) { path -> path }
        assertNotEquals(store.load("2025.json?limit=100", false) { it }.data,
            store.load("2026.json?limit=100", false) { it }.data)
    }

    @Test fun `cancellation is not converted into stale success`() = runTest {
        var cancel = false
        val store = PublicEndpointStore(folder.root, clock) { if (cancel) throw CancellationException() else "valid" }
        store.load("2025.json?limit=100", false) { it }
        cancel = true
        try {
            store.load("2025.json?limit=100", true) { it }
            fail("Cancellation must propagate")
        } catch (_: CancellationException) { /* Expected: caller navigation owns cancellation. */ }
    }

    @Test fun `invalid fresh response does not replace known good cache`() = runTest {
        var response = "valid"
        val store = PublicEndpointStore(folder.root, clock) { response }
        val parse: (String) -> String = { require(it == "valid"); it }
        store.load("2025.json?limit=100", false, parse)
        response = "broken"
        assertTrue(store.load("2025.json?limit=100", true, parse).stale)
        assertEquals("valid", store.load("2025.json?limit=100", false, parse).data)
    }
}
