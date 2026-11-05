package com.formularone.nativeapp.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.formularone.nativeapp.R
import com.formularone.nativeapp.model.Driver
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun SectionHeading(title: String, action: String? = null, onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(3.dp).height(14.dp).background(BrandRed))
        Spacer(Modifier.width(7.dp))
        Text(title, Modifier.weight(1f), fontSize = 16.sp, fontWeight = FontWeight.Bold)
        if (action != null) TextButton(onClick = onAction) { Text(action, fontSize = 12.sp) }
    }
}

@Composable
fun ChoiceTabs(labels: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    Column {
        Row(Modifier.fillMaxWidth()) {
            labels.forEachIndexed { index, label ->
                Column(Modifier.selectable(selected = index == selected, role = androidx.compose.ui.semantics.Role.Tab, onClick = { onSelect(index) })
                    .heightIn(min = 49.dp).padding(end = 28.dp), horizontalAlignment = Alignment.Start) {
                    Box(Modifier.heightIn(min = 46.dp), contentAlignment = Alignment.CenterStart) {
                        Text(label, fontSize = 14.sp, fontWeight = FontWeight.Bold,
                            color = if (index == selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Box(Modifier.height(3.dp).width(28.dp).background(if (index == selected) BrandRed else Color.Transparent))
                }
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

@Composable
fun DataNotice(resource: Resource<*>, zone: ZoneId, onRetry: () -> Unit) {
    if (resource.loading) {
        if (resource.data == null) LoadingRows()
        else LinearProgressIndicator(Modifier.fillMaxWidth().padding(vertical = 8.dp), color = BrandRed)
    }
    if (resource.error != null) {
        Column(Modifier.fillMaxWidth().padding(vertical = 18.dp)) {
            Text(resource.error, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            TextButton(onClick = onRetry) { Text("重新加载") }
        }
    } else if (resource.stale) {
        Text("更新暂不可用，正在显示缓存 · ${resource.updatedAt?.let { formatInstant(it, zone, "MM-dd HH:mm") } ?: "时间未知"}",
            Modifier.padding(vertical = 12.dp), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun LoadingRows() {
    val transition = rememberInfiniteTransition(label = "content loading")
    val opacity = transition.animateFloat(
        initialValue = 0.55f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(850, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "placeholder opacity",
    )
    val tint = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = opacity.value)
    Column(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("正在读取数据", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        repeat(3) { index ->
            Row(Modifier.fillMaxWidth().height(42.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(32.dp).background(tint, androidx.compose.foundation.shape.CircleShape))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.fillMaxWidth(if (index == 1) 0.48f else 0.63f).height(11.dp).background(tint))
                    Box(Modifier.fillMaxWidth(0.31f).height(8.dp).background(tint))
                }
                Box(Modifier.width(45.dp).height(12.dp).background(tint))
            }
        }
    }
}

@Composable
fun EmptyMessage(title: String, description: String) {
    Column(Modifier.padding(vertical = 26.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(description, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun Fact(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier.padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 23.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
    }
}

fun teamColor(id: String): Color = when (id) {
    "ferrari" -> BrandRed
    "mclaren" -> Color(0xFFF97316)
    "red_bull", "rb", "alphatauri", "toro_rosso" -> Color(0xFF2563EB)
    "mercedes", "aston_martin" -> Color(0xFF00A3A3)
    "alpine", "renault" -> Color(0xFF7C3AED)
    else -> Color(0xFF6B7A90)
}

fun driverName(driver: Driver): String = when (driver.id) {
    "leclerc" -> "勒克莱尔"; "norris" -> "诺里斯"; "max_verstappen" -> "维斯塔潘"
    "piastri" -> "皮亚斯特里"; "hamilton" -> "汉密尔顿"; "russell" -> "拉塞尔"
    "alonso" -> "阿隆索"; "sainz" -> "塞恩斯"; "albon" -> "阿尔本"; "gasly" -> "加斯利"
    "ocon" -> "奥康"; "stroll" -> "斯托尔"; else -> driver.familyName
}

@Composable
fun DriverPortrait(driver: Driver, modifier: Modifier = Modifier) {
    val portraitModifier = modifier.size(34.dp, 40.dp)
    val resource = driverPortraitResource(driver.id) ?: driverPortraitResource(driver.name)
    if (resource != null) Image(painterResource(resource), contentDescription = null, modifier = portraitModifier)
    else Box(portraitModifier.background(MaterialTheme.colorScheme.surfaceVariant, androidx.compose.foundation.shape.CircleShape), contentAlignment = Alignment.Center) {
        Text(driver.code.ifBlank { driver.familyName.take(2).uppercase() }, fontSize = 11.sp,
            fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun driverPortraitResource(identity: String): Int? {
    val normalized = java.text.Normalizer.normalize(identity.lowercase(), java.text.Normalizer.Form.NFKD)
        .replace(Regex("\\p{M}+"), "").replace(Regex("[^a-z0-9]+"), "_").trim('_')
    return when (normalized) {
        "albon", "alexander_albon" -> R.drawable.driver_albon
        "alonso", "fernando_alonso" -> R.drawable.driver_alonso
        "antonelli", "kimi_antonelli", "andrea_kimi_antonelli" -> R.drawable.driver_kimi_antonelli
        "bearman", "oliver_bearman" -> R.drawable.driver_bearman
        "bortoleto", "gabriel_bortoleto" -> R.drawable.driver_bortoleto
        "bottas", "valtteri_bottas" -> R.drawable.driver_bottas
        "colapinto", "franco_colapinto" -> R.drawable.driver_colapinto
        "doohan", "jack_doohan" -> R.drawable.driver_doohan
        "gasly", "pierre_gasly" -> R.drawable.driver_gasly
        "hadjar", "isack_hadjar" -> R.drawable.driver_hadjar
        "hamilton", "lewis_hamilton" -> R.drawable.driver_hamilton
        "hulkenberg", "nico_hulkenberg" -> R.drawable.driver_hulkenberg
        "lawson", "liam_lawson" -> R.drawable.driver_lawson
        "leclerc", "charles_leclerc" -> R.drawable.driver_leclerc
        "lindblad", "arvid_lindblad" -> R.drawable.driver_lindblad
        "magnussen", "kevin_magnussen" -> R.drawable.driver_magnussen
        "max_verstappen", "verstappen" -> R.drawable.driver_max_verstappen
        "norris", "lando_norris" -> R.drawable.driver_norris
        "ocon", "esteban_ocon" -> R.drawable.driver_ocon
        "perez", "sergio_perez" -> R.drawable.driver_perez
        "piastri", "oscar_piastri" -> R.drawable.driver_piastri
        "ricciardo", "daniel_ricciardo" -> R.drawable.driver_ricciardo
        "russell", "george_russell" -> R.drawable.driver_russell
        "sainz", "carlos_sainz", "carlos_sainz_jr" -> R.drawable.driver_sainz
        "stroll", "lance_stroll" -> R.drawable.driver_stroll
        "tsunoda", "yuki_tsunoda" -> R.drawable.driver_tsunoda
        "zhou", "guanyu_zhou", "zhou_guanyu" -> R.drawable.driver_zhou
        else -> null
    }

}

@Composable
fun NavGlyph(tab: RootTab) {
    val color = LocalContentColor.current
    Canvas(Modifier.size(22.dp)) {
        val step = size.width / 24f
        fun line(x: Float, y: Float, x2: Float, y2: Float) = drawLine(color, Offset(x * step, y * step), Offset(x2 * step, y2 * step), 1.6f * step)
        when (tab) {
            RootTab.RACES -> { line(5f, 3f, 5f, 21f); drawRect(color, Offset(5f * step, 4f * step), Size(14f * step, 9f * step), style = Stroke(1.6f * step)) }
            RootTab.STANDINGS -> { line(3f, 21f, 21f, 21f); listOf(5f to 10f, 11f to 4f, 17f to 13f).forEach { (x, y) -> drawRect(color, Offset(x * step, y * step), Size(3f * step, (21f - y) * step), style = Stroke(1.5f * step)) } }
            RootTab.LIBRARY -> { drawRect(color, Offset(4f * step, 4f * step), Size(6f * step, 16f * step), style = Stroke(1.5f * step)); drawRect(color, Offset(14f * step, 4f * step), Size(6f * step, 16f * step), style = Stroke(1.5f * step)) }
            RootTab.ME -> { drawCircle(color, 3.5f * step, Offset(12f * step, 7f * step), style = Stroke(1.5f * step)); drawArc(color, 180f, 180f, false, Offset(5f * step, 14f * step), Size(14f * step, 12f * step), style = Stroke(1.5f * step)) }
        }
    }
}

fun formatInstant(instant: Instant, zone: ZoneId, pattern: String): String = DateTimeFormatter.ofPattern(pattern, Locale.CHINA).withZone(zone).format(instant)
