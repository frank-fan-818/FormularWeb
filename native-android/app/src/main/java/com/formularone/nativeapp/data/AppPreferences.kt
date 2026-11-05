package com.formularone.nativeapp.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.preferences by preferencesDataStore(name = "frankpitwall")
data class AppSettings(val theme: String = "system", val timeZone: String = "Asia/Shanghai", val season: Int? = null)

class AppPreferences(context: Context) {
    private val store = context.applicationContext.preferences
    private val theme = stringPreferencesKey("theme")
    private val zone = stringPreferencesKey("time_zone")
    private val season = intPreferencesKey("season")
    val settings: Flow<AppSettings> = store.data.catch { error ->
        if (error is IOException) emit(androidx.datastore.preferences.core.emptyPreferences()) else throw error
    }.map { values ->
        AppSettings(values[theme]?.takeIf { it in setOf("system", "light", "dark") } ?: "system",
            values[zone]?.takeIf { it in setOf("Asia/Shanghai", "UTC") } ?: "Asia/Shanghai",
            values[season]?.takeIf { it in 1950..java.time.LocalDate.now().year + 1 })
    }
    suspend fun setTheme(value: String) { require(value in setOf("system", "light", "dark")); store.edit { it[theme] = value } }
    suspend fun setZone(value: String) { require(value in setOf("Asia/Shanghai", "UTC")); store.edit { it[zone] = value } }
    suspend fun setSeason(value: Int) { require(value in 1950..java.time.LocalDate.now().year + 1); store.edit { it[season] = value } }
}
