package com.formularone.nativeapp.ui

import android.annotation.SuppressLint
import androidx.core.net.toUri
import android.webkit.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.formularone.nativeapp.BuildConfig
import com.formularone.nativeapp.data.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.ByteArrayInputStream

@Composable
fun AuthScreen(features: FeatureViewModel) {
    val state by features.auth.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf(AuthMode.LOGIN) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var captcha by remember { mutableStateOf("") }
    var challenge by remember { mutableIntStateOf(0) }
    var validation by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(state.user?.email ?: "欢迎来到 FrankPitwall", style = MaterialTheme.typography.headlineSmall)
        if (state.user != null) {
            Text("已登录，可使用比赛分析、遥测和预测。", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = features::logout) { Text("退出当前设备") }
        } else {
            ChoiceTabs(AuthMode.entries.map { it.label }, mode.ordinal) { if (!state.busy) { mode = AuthMode.entries[it]; password = ""; captcha = ""; validation = null; challenge++ } }
            OutlinedTextField(email, { email = it }, label = { Text("邮箱") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), singleLine = true, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
            if (mode != AuthMode.RESET) OutlinedTextField(password, { password = it }, label = { Text("密码") }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), singleLine = true, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
            if (mode == AuthMode.REGISTER) Text("密码至少 8 位，包含字母与数字。注册后请到邮箱确认。", style = MaterialTheme.typography.bodySmall)
            if (BuildConfig.TURNSTILE_SITE_KEY.isNotBlank()) {
                Text("安全验证", style = MaterialTheme.typography.labelLarge)
                key(challenge) {
                    var errorCode by remember { mutableStateOf<String?>(null) }
                    CaptchaWidget(onToken = { captcha = it; if (it.isNotBlank()) errorCode = null },
                        onFailure = { captcha = ""; errorCode = it })
                    errorCode?.let { code ->
                        val message = if (code == "110200") "验证域名未获授权，请联系站点维护者。"
                            else "安全验证连接失败或已超时，可重试或切换网络。"
                        Text("$message ($code)", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                }
                Text(if (captcha.isBlank()) "请完成上方验证后继续。" else "验证已完成", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = { captcha = ""; challenge++ }, enabled = !state.busy) { Text("重新加载验证") }
            }
            validation?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            state.message?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Button(onClick = {
                if (BuildConfig.TURNSTILE_SITE_KEY.isNotBlank() && captcha.isBlank()) { validation = "请先完成安全验证。"; return@Button }
                validation = null
                scope.launch {
                    try { features.auth.submit(mode, email, password, captcha); password = "" }
                    catch (cancelled: CancellationException) { throw cancelled }
                    catch (error: Exception) { if (error is IllegalArgumentException) validation = error.message ?: "请检查输入。" }
                    finally { captcha = ""; challenge++ }
                }
            }, enabled = !state.busy && BuildConfig.SUPABASE_URL.isNotBlank() && (BuildConfig.TURNSTILE_SITE_KEY.isBlank() || captcha.isNotBlank()), modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Text(if (state.busy) "正在验证…" else mode.label)
            }
            Text("沿用网站账号。验证邮件和密码重置页面由系统浏览器打开，完成后返回应用登录。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        val uri = androidx.compose.ui.platform.LocalUriHandler.current
        TextButton(onClick = { runCatching { uri.openUri("$SITE_ORIGIN/privacy") } }) { Text("隐私政策") }
    }
}

private class CaptchaBridge(val callback: (String) -> Unit, val onFailure: (String) -> Unit) {
    @JavascriptInterface fun failure(code: String) { if (code.matches(Regex("[0-9]{6}|network|expired"))) onFailure(code) }
    @JavascriptInterface fun complete(token: String) { if (token.length <= 8192) callback(token) }
}

/** Only the existing anti-bot widget uses a browser; no credentials enter this WebView. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun CaptchaWidget(onToken: (String) -> Unit, onFailure: (String) -> Unit) {
    val callback by rememberUpdatedState(onToken)
    val failure by rememberUpdatedState(onFailure)
    AndroidView(modifier = Modifier.fillMaxWidth().height(90.dp), factory = { context ->
        WebView(context).apply {
            setBackgroundColor(android.graphics.Color.TRANSPARENT)
            settings.javaScriptEnabled = true; settings.domStorageEnabled = true
            settings.allowFileAccess = false; settings.allowContentAccess = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.setSupportMultipleWindows(false)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            addJavascriptInterface(CaptchaBridge({ token -> post { callback(token) } }, { code -> post { failure(code) } }), "PitwallCaptcha")
            webViewClient = object : WebViewClient() {
                fun allowed(url: String): Boolean {
                    if (url in listOf("about:blank", "about:srcdoc")) return true
                    val uri = url.toUri()
                    return uri.scheme == "https" && uri.userInfo == null && uri.port in listOf(-1, 443) && uri.host in listOf("formular-web.vercel.app", "challenges.cloudflare.com")
                }
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = request.isForMainFrame || !allowed(request.url.toString())
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    if (allowed(request.url.toString())) null else WebResourceResponse("text/plain", "UTF-8", ByteArrayInputStream(ByteArray(0)))
            }
            val siteKey = JSONObject.quote(BuildConfig.TURNSTILE_SITE_KEY)
            loadDataWithBaseURL("$SITE_ORIGIN/native-captcha/", """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; style-src 'unsafe-inline'"><style>body{margin:0;background:transparent}</style></head><body><div id="captcha"></div><script>function ready(){turnstile.render('#captcha',{sitekey:$siteKey,callback:function(t){PitwallCaptcha.complete(t)},size:'flexible','expired-callback':function(){PitwallCaptcha.failure('expired')},'error-callback':function(code){PitwallCaptcha.failure(String(code))}})}</script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=ready" onerror="PitwallCaptcha.failure('network')" async defer></script></body></html>""", "text/html", "UTF-8", null)
        }
    }, onRelease = { view -> view.removeJavascriptInterface("PitwallCaptcha"); view.stopLoading(); view.destroy() })
}
