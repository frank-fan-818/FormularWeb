package com.formularone.nativeapp.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import com.formularone.nativeapp.BuildConfig
import java.time.Instant

enum class AuthMode(val label: String) { LOGIN("登录"), REGISTER("注册"), RESET("找回密码") }
data class MemberUser(val id: String, val email: String)
data class AuthState(val user: MemberUser? = null, val busy: Boolean = false, val message: String? = null, val epoch: Long = 0)
class MemberRequiredException : Exception("请登录后查看会员数据。")
interface SessionStore { fun read(): String?; fun write(value: String?) }
private class AuthSession(val access: String, val refresh: String, val expiry: Long, val user: MemberUser) {
    override fun toString() = "AuthSession(redacted)"
    fun encode(): String = JSONObject().put("access_token", access).put("refresh_token", refresh).put("expires_at", expiry)
        .put("user", JSONObject().put("id", user.id).put("email", user.email).put("is_anonymous", false)).toString()
}

/** No tokens in UI state. Generation guards apply after the complete response body. */
class NativeAuth(private val store: SessionStore, private val request: BackendRequest) {
    private val lock = Any()
    private val refreshMutex = Mutex()
    private var epoch = 0L
    private var session: AuthSession? = null
    private val _state = MutableStateFlow(AuthState())
    val state = _state.asStateFlow()
    private fun user(raw: JSONObject): MemberUser {
        require(!raw.optBoolean("is_anonymous") && raw.text("id").isNotBlank())
        return MemberUser(raw.getString("id"), raw.text("email"))
    }
    private fun parse(body: String): AuthSession {
        val row = JSONObject(body)
        val access = row.getString("access_token"); val refresh = row.getString("refresh_token")
        require(access.isNotBlank() && refresh.isNotBlank())
        val expiry = row.number("expires_at")?.toLong() ?: (Instant.now().epochSecond + row.getLong("expires_in"))
        return AuthSession(access, refresh, expiry, user(row.getJSONObject("user")))
    }
    private suspend fun verified(value: AuthSession): AuthSession {
        val verified = user(JSONObject(request("/auth/v1/user", "GET", null, value.access)))
        require(verified.id == value.user.id)
        return AuthSession(value.access, value.refresh, value.expiry, verified)
    }
    private fun commit(value: AuthSession, generation: Long) = synchronized(lock) {
        if (epoch != generation) throw MemberRequiredException()
        store.write(value.encode())
        session = value
        _state.value = AuthState(value.user, epoch = epoch)
    }
    suspend fun restore() {
        val generation = synchronized(lock) { epoch }
        try {
            val stored = store.read() ?: return
            var value = parse(stored)
            if (value.expiry < Instant.now().epochSecond + 60) value = refresh(value)
            value = verified(value)
            currentCoroutineContext().ensureActive()
            commit(value, generation)
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (error: Exception) {
            synchronized(lock) {
                if (epoch == generation) {
                    if (error is HttpStatusException && error.status in listOf(400, 401, 403)) store.write(null)
                    _state.value = AuthState(message = "尚未恢复账号，请联网后重新登录。", epoch = epoch)
                }
            }
        }
    }
    private suspend fun refresh(value: AuthSession): AuthSession = parse(request("/auth/v1/token?grant_type=refresh_token", "POST", JSONObject().put("refresh_token", value.refresh).toString(), null)).also { require(it.user.id == value.user.id) }

    suspend fun submit(mode: AuthMode, emailInput: String, password: String, captcha: String): Boolean {
        val email = emailInput.trim()
        require(BuildConfig.TURNSTILE_SITE_KEY.isBlank() || captcha.isNotBlank()) { "请先完成安全验证。" }
        require(email.length <= 254 && Regex("[^\\s@]+@[^\\s@]+\\.[^\\s@]+").matches(email)) { "请输入有效邮箱。" }
        if (mode != AuthMode.RESET) {
            require(password.length in 1..128) { "请输入密码（最多 128 字符）。" }
            if (mode == AuthMode.REGISTER) require(password.length >= 8 && password.any { it.isLetter() } && password.any { it.isDigit() }) { "密码至少 8 位，包含字母和数字。" }
        }
        val generation = synchronized(lock) {
            epoch++; session = null; store.write(null)
            _state.value = AuthState(busy = true, epoch = epoch); epoch
        }
        try {
            val body = JSONObject().put("email", email).put("gotrue_meta_security", JSONObject().put("captcha_token", captcha))
            if (mode != AuthMode.RESET) body.put("password", password)
            val path = when (mode) {
                AuthMode.LOGIN -> "/auth/v1/token?grant_type=password"
                AuthMode.REGISTER -> "/auth/v1/signup?redirect_to=https%3A%2F%2Fformular-web.vercel.app%2Flogin%3Fverified%3D1"
                AuthMode.RESET -> "/auth/v1/recover?redirect_to=https%3A%2F%2Fformular-web.vercel.app%2Freset-password"
            }
            val raw = request(path, "POST", body.toString(), null)
            currentCoroutineContext().ensureActive()
            val result = if (mode != AuthMode.RESET && JSONObject(raw.ifBlank { "{}" }).has("access_token")) verified(parse(raw)) else null
            currentCoroutineContext().ensureActive()
            if (result != null) { commit(result, generation); return true }
            synchronized(lock) { if (epoch == generation) _state.value = AuthState(message = "请查看邮箱完成验证，然后返回应用登录。", epoch = epoch) }
            return false
        } catch (cancelled: CancellationException) {
            synchronized(lock) { if (epoch == generation) _state.value = AuthState(epoch = epoch) }
            throw cancelled
        } catch (error: Exception) {
            synchronized(lock) { if (epoch == generation) _state.value = AuthState(message = when {
                error is HttpStatusException && error.status == 429 -> "操作较频繁，请稍后再试。"
                error is HttpStatusException && error.status in listOf(400, 401, 422) -> "未能完成验证，请检查邮箱、密码和验证码后重试。"
                else -> "账号服务暂时无法连接，请稍后重试。"
            }, epoch = epoch) }
            throw error
        }
    }
    /** Clears local credentials and UI immediately, even if remote logout fails. */
    suspend fun logout() {
        val previous = synchronized(lock) {
            val old = session; epoch++; session = null; store.write(null)
            _state.value = AuthState(epoch = epoch); old
        }
        if (previous != null) try { request("/auth/v1/logout?scope=local", "POST", "{}", previous.access) }
        catch (cancelled: CancellationException) { throw cancelled } catch (_: Exception) { /* Local logout already completed. */ }
    }
    suspend fun <T> member(block: suspend (String) -> T): T {
        val (generation, initial) = synchronized(lock) { epoch to (session ?: throw MemberRequiredException()) }
        val current = refreshMutex.withLock {
            var value = synchronized(lock) { if (epoch != generation) throw MemberRequiredException(); session ?: throw MemberRequiredException() }
            if (value.expiry < Instant.now().epochSecond + 60) {
                value = verified(refresh(value)); currentCoroutineContext().ensureActive(); commit(value, generation)
            }
            value
        }
        val result = block(current.access)
        currentCoroutineContext().ensureActive()
        synchronized(lock) { if (epoch != generation || session?.user?.id != initial.user.id) throw MemberRequiredException() }
        return result
    }
}
