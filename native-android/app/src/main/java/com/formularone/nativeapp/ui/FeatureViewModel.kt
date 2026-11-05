package com.formularone.nativeapp.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.formularone.nativeapp.data.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.io.IOException

class FeatureViewModel(val repository: FeatureRepository) : ViewModel() {
    val auth = repository.auth
    init { viewModelScope.launch { auth.restore() } }
    fun logout() { viewModelScope.launch { auth.logout() } }
}

fun featureError(error: Exception): String = when {
    error is MemberRequiredException -> "登录已失效，请重新登录。"
    error is NoPublishedDataException || error is HttpStatusException && error.status == 404 -> "该场次的数据尚未发布。"
    error is HttpStatusException && error.status in listOf(401, 403) -> "账号验证或权限检查未通过，请重新登录后重试。"
    error is HttpStatusException && error.status == 429 -> "访问较频繁，请稍后再试。"
    error is IOException -> "暂时无法连接数据服务，请检查网络后重试。"
    else -> "数据暂时无法读取，请稍后重试。"
}
