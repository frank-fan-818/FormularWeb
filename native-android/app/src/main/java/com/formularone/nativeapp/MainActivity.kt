package com.formularone.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.formularone.nativeapp.data.AppPreferences
import com.formularone.nativeapp.data.PublicF1Repository
import com.formularone.nativeapp.data.NativeHttp
import com.formularone.nativeapp.data.NativeAuth
import com.formularone.nativeapp.data.EncryptedSessionStore
import com.formularone.nativeapp.data.FeatureRepository
import com.formularone.nativeapp.ui.FeatureViewModel
import com.formularone.nativeapp.ui.FrankPitwallApp
import com.formularone.nativeapp.ui.PitwallTheme
import com.formularone.nativeapp.ui.PitwallViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val preferences = remember { AppPreferences(applicationContext) }
            val features: FeatureViewModel = viewModel(factory = viewModelFactory {
                initializer {
                    val http = NativeHttp()
                    FeatureViewModel(FeatureRepository(cacheDir, NativeAuth(EncryptedSessionStore(noBackupFilesDir), http::backend), http))
                }
            })
            val model: PitwallViewModel = viewModel(factory = viewModelFactory {
                initializer {
                    PitwallViewModel(PublicF1Repository(cacheDir, features.repository), preferences.settings, preferences::setTheme, preferences::setZone, preferences::setSeason)
                }
            })
            val settings by model.settings.collectAsStateWithLifecycle()
            val dark = when (settings.theme) { "dark" -> true; "light" -> false; else -> isSystemInDarkTheme() }
            SideEffect {
                WindowCompat.getInsetsController(window, window.decorView).apply {
                    isAppearanceLightStatusBars = !dark
                    isAppearanceLightNavigationBars = !dark
                }
            }
            PitwallTheme(dark) { FrankPitwallApp(model, features, dark) }
        }
    }
}
