package com.formularone.nativeapp.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.formularone.nativeapp.model.*
import kotlin.math.abs
import java.util.Locale

fun numeric(value: Double): String = if (value % 1.0 == 0.0) value.toLong().toString() else String.format(Locale.ROOT, "%.3f", value).trimEnd('0').trimEnd('.')
private fun seriesColor(name: String): Color {
    val palette = listOf(Color(0xFFEA4C3A), Color(0xFF1784D5), Color(0xFF12A391), Color(0xFFBB78D1), Color(0xFFD79B24), Color(0xFF7C9D3A))
    return palette[(name.hashCode() and Int.MAX_VALUE) % palette.size]
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NativeLineChart(title: String, series: List<ChartSeries>, xUnit: String, yUnit: String, positions: Boolean = false, single: Boolean = false) {
    var selected by rememberSaveable(title, series.map { it.name }) { mutableStateOf(series.take(if (single) 1 else 2).map { it.name }) }
    var chosenX by remember(title) { mutableStateOf<Double?>(null) }
    var table by rememberSaveable(title) { mutableStateOf(false) }
    val visible = series.filter { it.name in selected }
    val points = visible.flatMap { it.points }.filter { it.y != null }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionHeading(title)
        if (series.isEmpty() || series.none { s -> s.points.any { it.y != null } }) {
            EmptyMessage("暂无图表数据", "数据源尚未提供此项目。"); return@Column
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            series.forEach { s -> FilterChip(selected = s.name in selected, onClick = {
                selected = if (single) listOf(s.name) else if (s.name in selected) selected - s.name else (selected + s.name).takeLast(6)
                chosenX = null
            }, label = { Text(s.name, color = seriesColor(s.name)) }) }
        }
        if (points.isNotEmpty()) {
            val minX = points.minOf { it.x }; val maxX = points.maxOf { it.x }.coerceAtLeast(minX + 1)
            val minY = points.minOf { it.y!! }; val maxY = points.maxOf { it.y!! }.coerceAtLeast(minY + 1)
            val grid = MaterialTheme.colorScheme.outlineVariant
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${numeric(if (positions) minY else maxY)} $yUnit", style = MaterialTheme.typography.labelSmall)
                Text("点击曲线查看数值", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Canvas(Modifier.fillMaxWidth().height(190.dp).semantics { contentDescription = "$title，横轴$xUnit，纵轴$yUnit，亦可查看数据表" }
                .pointerInput(minX, maxX) { detectTapGestures { chosenX = minX + (it.x / size.width).coerceIn(0f, 1f) * (maxX - minX) } }) {
                fun position(p: ChartPoint): Offset {
                    val fraction = ((p.y!! - minY) / (maxY - minY)).toFloat()
                    return Offset(((p.x - minX) / (maxX - minX)).toFloat() * size.width, (if (positions) fraction else 1 - fraction) * size.height)
                }
                repeat(5) { line -> val y = size.height * line / 4; drawLine(grid, Offset(0f, y), Offset(size.width, y), 1f) }
                visible.forEachIndexed { index, series ->
                    val color = seriesColor(series.name)
                    val linePath = Path()
                    val fillPath = Path()
                    var previous: ChartPoint? = null
                    var startX = 0f
                    var endX = 0f
                    var hasSegment = false

                    fun closeFill() {
                        if (!hasSegment) return
                        if (index == 0) {
                            fillPath.lineTo(endX, size.height)
                            fillPath.lineTo(startX, size.height)
                            fillPath.close()
                        }
                        hasSegment = false
                    }

                    series.points.forEach { point ->
                        val before = previous
                        if (point.y == null || before?.y == null || (xUnit == "圈" && point.x - before.x > 1.0)) {
                            closeFill()
                        } else {
                            val start = position(before)
                            val end = position(point)
                            if (!hasSegment) {
                                startX = start.x
                                linePath.moveTo(start.x, start.y)
                                if (index == 0) fillPath.moveTo(start.x, start.y)
                                hasSegment = true
                            }
                            // Horizontal handles keep the curve inside the two sampled values.
                            val reach = (end.x - start.x) * 0.28f
                            linePath.cubicTo(start.x + reach, start.y, end.x - reach, end.y, end.x, end.y)
                            if (index == 0) fillPath.cubicTo(start.x + reach, start.y, end.x - reach, end.y, end.x, end.y)
                            endX = end.x
                        }
                        previous = point
                    }
                    closeFill()
                    if (index == 0) {
                        drawPath(fillPath, Brush.verticalGradient(listOf(color.copy(alpha = 0.17f), color.copy(alpha = 0f)), endY = size.height))
                    }
                    drawPath(linePath, color, style = Stroke(width = 1.5.dp.toPx(), cap = StrokeCap.Round))
                }
                chosenX?.let { x -> val px = ((x - minX) / (maxX - minX)).toFloat() * size.width; drawLine(grid, Offset(px, 0f), Offset(px, size.height), 2f) }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${numeric(minX)} $xUnit · ${numeric(if (positions) maxY else minY)} $yUnit", style = MaterialTheme.typography.labelSmall)
                Text("${numeric(maxX)} $xUnit", style = MaterialTheme.typography.labelSmall)
            }
            chosenX?.let { x -> visible.forEach { s ->
                s.points.minByOrNull { abs(it.x - x) }?.let { p -> Text("${s.name} · ${numeric(p.x)} $xUnit · ${p.y?.let(::numeric) ?: "—"} $yUnit", style = MaterialTheme.typography.bodySmall) }
            } }
            TextButton(onClick = { table = !table }) { Text(if (table) "收起数据表" else "查看数据表") }
            if (table) {
                LazyColumn(Modifier.height(300.dp)) {
                    visible.forEach { s ->
                        item { Text(s.name, color = seriesColor(s.name)) }
                        items(s.points) { p -> Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${numeric(p.x)} $xUnit", style = MaterialTheme.typography.bodySmall)
                            Text("${p.y?.let(::numeric) ?: "—"} $yUnit", style = MaterialTheme.typography.bodySmall)
                        } }
                    }
                }
            }
        } else Text("请选择至少一组数据。", style = MaterialTheme.typography.bodySmall)
    }
}
