package com.formularone.nativeapp

import com.formularone.nativeapp.data.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test
import javax.crypto.KeyGenerator
import java.io.IOException

class NativeAuthTest {
    private class MemoryStore : SessionStore {
        var value: String? = null
        override fun read() = value
        override fun write(value: String?) { this.value = value }
    }
    private val login = """{"access_token":"secret-access","refresh_token":"secret-refresh","expires_in":3600,"user":{"id":"user-a","email":"a@example.com","is_anonymous":false}}"""
    private val user = """{"id":"user-a","email":"a@example.com","is_anonymous":false}"""
    @Test fun `logout invalidates an already running member request`() = runTest {
        val delayed = CompletableDeferred<String>()
        val started = CompletableDeferred<Unit>()
        val auth = NativeAuth(MemoryStore()) { path, _, _, _ -> if (path.contains("/token")) login else user }
        auth.submit(AuthMode.LOGIN, "a@example.com", "password1", "captcha")
        val task = async {
            runCatching { auth.member { started.complete(Unit); delayed.await() } }.exceptionOrNull()
        }
        started.await(); auth.logout(); delayed.complete("private body")
        assertTrue(task.await() is MemberRequiredException)
        assertNull(auth.state.value.user)
    }
    @Test fun `logout prevents pending login from restoring credentials`() = runTest {
        val delayed = CompletableDeferred<String>(); val started = CompletableDeferred<Unit>(); val store = MemoryStore()
        val auth = NativeAuth(store) { path, _, _, _ -> if (path.contains("/token")) { started.complete(Unit); delayed.await() } else user }
        val task = launch { runCatching { auth.submit(AuthMode.LOGIN, "a@example.com", "password1", "captcha") } }
        started.await(); auth.logout(); delayed.complete(login); task.join()
        assertNull(store.value); assertNull(auth.state.value.user)
    }
    @Test fun `session encryption detects tampering`() {
        val key = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
        val cipher = SessionCipher { key }
        val bytes = cipher.encrypt("refresh-token")
        assertEquals("refresh-token", cipher.decrypt(bytes))
        bytes[bytes.lastIndex] = (bytes.last().toInt() xor 1).toByte()
        assertThrows(Exception::class.java) { cipher.decrypt(bytes) }
    }
    @Test fun `auth request uses existing captcha contract and never exposes credentials`() = runTest {
        var body = ""
        val auth = NativeAuth(MemoryStore()) { path, _, json, _ -> if (path.contains("/token")) { body = json!!; login } else user }
        auth.submit(AuthMode.LOGIN, " a@example.com ", "password1", "human-token")
        assertEquals("human-token", org.json.JSONObject(body).getJSONObject("gotrue_meta_security").getString("captcha_token"))
        assertFalse(auth.state.value.toString().contains("secret-"))
    }
    @Test fun `offline restore never grants member access from an unverified saved session`() = runTest {
        val store = MemoryStore().apply { value = login }
        val auth = NativeAuth(store) { _, _, _, _ -> throw IOException("offline") }
        auth.restore()
        assertNull(auth.state.value.user)
        assertNotNull(store.value)
        var called = false
        val failure = runCatching { auth.member { called = true; "private" } }.exceptionOrNull()
        assertTrue(failure is MemberRequiredException)
        assertFalse(called)
    }
    @Test fun `remote logout failure still clears local credentials`() = runTest {
        val store = MemoryStore()
        val auth = NativeAuth(store) { path, _, _, _ -> when {
            path.contains("/token") -> login
            path.contains("/logout") -> throw IOException("offline")
            else -> user
        } }
        auth.submit(AuthMode.LOGIN, "a@example.com", "password1", "captcha")
        auth.logout()
        assertNull(store.value); assertNull(auth.state.value.user)
    }
    @Test fun `server user mismatch cannot create a member session`() = runTest {
        val store = MemoryStore()
        val auth = NativeAuth(store) { path, _, _, _ -> if (path.contains("/token")) login else user.replace("user-a", "user-b") }
        assertTrue(runCatching { auth.submit(AuthMode.LOGIN, "a@example.com", "password1", "captcha") }.isFailure)
        assertNull(auth.state.value.user); assertNull(store.value)
    }
    @Test fun `anonymous account cannot grant member access`() = runTest {
        val store = MemoryStore()
        val auth = NativeAuth(store) { _, _, _, _ -> login.replace("\"is_anonymous\":false", "\"is_anonymous\":true") }
        assertTrue(runCatching { auth.submit(AuthMode.LOGIN, "a@example.com", "password1", "captcha") }.isFailure)
        assertNull(auth.state.value.user)
    }
    @Test fun `account switch invalidates an old complete response`() = runTest {
        var identity = "user-a"
        val auth = NativeAuth(MemoryStore()) { path, _, _, _ -> (if (path.contains("/token")) login else user).replace("user-a", identity) }
        auth.submit(AuthMode.LOGIN, "a@example.com", "password1", "captcha")
        val waiting = CompletableDeferred<String>(); val started = CompletableDeferred<Unit>()
        val old = async { runCatching { auth.member { started.complete(Unit); waiting.await() } }.exceptionOrNull() }
        started.await(); identity = "user-b"
        auth.submit(AuthMode.LOGIN, "b@example.com", "password1", "captcha")
        waiting.complete("old user's analysis")
        assertTrue(old.await() is MemberRequiredException)
        assertEquals("user-b", auth.state.value.user?.id)
    }
}
