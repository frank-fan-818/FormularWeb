package com.formularone.nativeapp.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val BrandRed = Color(0xFFFF1801)
val ActionRed = Color(0xFFCC1300)

@Composable
fun PitwallTheme(dark: Boolean, content: @Composable () -> Unit) {
    val colors = if (dark) darkColorScheme(
        primary = Color(0xFFFF8A80), onPrimary = Color(0xFF111827),
        background = Color(0xFF0F172A), surface = Color(0xFF141E30),
        surfaceVariant = Color(0xFF1E293B), onSurface = Color(0xFFE2E8F0),
        onSurfaceVariant = Color(0xFF94A3B8), outlineVariant = Color(0xFF334155),
    ) else lightColorScheme(
        primary = ActionRed, onPrimary = Color.White,
        background = Color(0xFFF7F7F5), surface = Color.White,
        surfaceVariant = Color(0xFFF1F3F5), onSurface = Color(0xFF222222),
        onSurfaceVariant = Color(0xFF717171), outlineVariant = Color(0xFFEBEBEB),
    )
    MaterialTheme(colorScheme = colors, content = content)
}
