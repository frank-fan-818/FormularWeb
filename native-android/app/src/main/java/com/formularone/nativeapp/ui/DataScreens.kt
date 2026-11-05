package com.formularone.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.formularone.nativeapp.BuildConfig
import com.formularone.nativeapp.data.AppSettings
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.formularone.nativeapp.model.*
import java.time.ZoneId

@Composable
fun StandingRow(standing: Standing, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 72.dp).padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(standing.position, Modifier.widthIn(min = 22.dp), fontSize = 19.sp, fontWeight = FontWeight.Bold,
                color = if (standing.position == "1") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)
            Box(Modifier.width(3.dp).height(26.dp).background(teamColor(standing.constructorId)))
            standing.driver?.let { DriverPortrait(it) }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(standing.driver?.let(::driverName) ?: standing.name, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text(standing.secondary, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(standing.points, fontSize = 19.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                Text("积分", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

@Composable
fun StandingsScreen(drivers: Resource<List<Standing>>, teams: Resource<List<Standing>>, year: Int, zone: ZoneId, model: PitwallViewModel) {
    var selected by rememberSaveable { mutableIntStateOf(0) }
    val resource = if (selected == 0) drivers else teams
    LazyColumn(state = rememberLazyListState(), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { InfoRow("积分对比", "选择两位车手或两支车队") { model.openFeature(FeatureKind.COMPARE) } }
        item { Inset { ChoiceTabs(listOf("车手", "车队"), selected) { selected = it }; Spacer(Modifier.height(15.dp)); Text("$year 赛季累计积分", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant); DataNotice(resource, zone, model::refresh) } }
        items(resource.data.orEmpty(), key = { it.id }) { entry -> StandingRow(entry) {
            entry.driver?.let { model.openDriver(it, standing = entry) } ?: model.openTeam(entry)
        } }
        if (!resource.loading && resource.error == null && resource.data.orEmpty().isEmpty()) item { Inset { EmptyMessage("暂无积分榜", "该赛季的积分榜尚未发布或没有记录。") } }
    }
}

@Composable
fun LibraryScreen(drivers: Resource<List<Standing>>, teams: Resource<List<Standing>>, races: Resource<List<Race>>, year: Int, zone: ZoneId, model: PitwallViewModel) {
    var category by rememberSaveable { mutableIntStateOf(0) }
    var query by rememberSaveable { mutableStateOf("") }
    val driverItems = drivers.data.orEmpty().filter { "${it.name} ${it.driver?.let(::driverName).orEmpty()} ${it.secondary}".contains(query, ignoreCase = true) }
    val teamItems = teams.data.orEmpty().filter { "${it.name} ${it.secondary}".contains(query, ignoreCase = true) }
    val circuits = races.data.orEmpty().distinctBy { it.circuitId }.filter { "${it.circuit} ${it.locality} ${it.country}".contains(query, ignoreCase = true) }
    val resource = when (category) { 0 -> drivers; 1 -> teams; else -> races }
    LazyColumn(state = rememberLazyListState(), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { InfoRow("历史资料库", "所有年代的车手、车队和赛道") { model.openFeature(FeatureKind.ARCHIVE) } }
        item { Inset {
            TextField(value = query, onValueChange = { query = it }, placeholder = { Text("搜索车手、车队或赛道", fontSize = 14.sp) },
                singleLine = true, modifier = Modifier.fillMaxWidth(), colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent),
                trailingIcon = if (query.isNotEmpty()) ({ TextButton(onClick = { query = "" }) { Text("清除", fontSize = 12.sp) } }) else null)
            ChoiceTabs(listOf("车手", "车队", "赛道"), category) { category = it }
            Spacer(Modifier.height(12.dp))
            Text("$year 赛季资料", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            DataNotice(resource, zone, model::refresh)
        } }
        when (category) {
            0 -> items(driverItems, key = { it.id }) { entry -> StandingRow(entry) { entry.driver?.let { model.openDriver(it, standing = entry) } } }
            1 -> items(teamItems, key = { it.id }) { entry -> StandingRow(entry) { model.openTeam(entry) } }
            else -> items(circuits, key = { it.circuitId }) { race ->
                InfoRow(race.circuit, "${race.locality} · ${race.country}") { model.openCircuit(race) }
            }
        }
        val count = when (category) { 0 -> driverItems.size; 1 -> teamItems.size; else -> circuits.size }
        if (!resource.loading && resource.error == null && count == 0) item { Inset { EmptyMessage(if (query.isBlank()) "暂无资料" else "没有找到相关资料", "试试其他关键词，或选择另一个赛季。") } }
    }
}

@Composable
fun InfoRow(title: String, subtitle: String, onClick: (() -> Unit)? = null) {
    val action = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier
    Column(Modifier.fillMaxWidth().then(action).padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 70.dp).padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (onClick != null) Text("›", fontSize = 22.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

@Composable
fun DriverScreen(page: Page.DriverInfo, year: Int, model: PitwallViewModel) {
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp)) {
        item { Inset {
            Row(Modifier.fillMaxWidth().padding(vertical = 18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                DriverPortrait(page.driver, Modifier.size(90.dp, 104.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (page.driver.number.isNotBlank()) Text(page.driver.number, fontSize = 32.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    Text(driverName(page.driver), fontSize = 26.sp, fontWeight = FontWeight.Bold)
                    Text(page.driver.name, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            page.result?.let { result ->
                SectionHeading("本场表现")
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Fact("官方名次", result.position, Modifier.weight(1f)); Fact("积分", result.points, Modifier.weight(1f)); Fact("完成圈数", result.laps, Modifier.weight(1f))
                }
                Text(result.timing, Modifier.padding(vertical = 8.dp), fontFamily = FontFamily.Monospace, fontSize = 16.sp)
                if (result.qualifyingTimes.isNotEmpty()) result.qualifyingTimes.forEach { (stage, time) ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp)) { Text(stage, Modifier.weight(1f)); Text(time, fontFamily = FontFamily.Monospace) }
                }
            }
            page.standing?.let { standing ->
                SectionHeading("$year 赛季表现")
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Fact("积分", standing.points, Modifier.weight(1f)); Fact("排名", standing.position, Modifier.weight(1f)); Fact("分站冠军", standing.wins, Modifier.weight(1f))
                }
            }
        } }
        item { InfoRow("国籍", page.driver.nationality.ifBlank { "暂无资料" }) }
        page.standing?.let { standing -> item { InfoRow("车队", standing.secondary) } }
        page.result?.let { result -> item { InfoRow("本场车队", result.constructor) } }
        item { InfoRow("完整生涯档案", "生涯统计与逐年战绩") { model.openFeature(FeatureKind.HISTORY, identity = page.driver.id) } }
        item { InfoRow("$year 分站战绩", "各站官方成绩与积分") { model.openFeature(FeatureKind.HISTORY_RACES, identity = page.driver.id, season = year) } }
        item { Inset { Spacer(Modifier.height(18.dp)); TextButton(onClick = model::openCalendar) { Text("查看赛季赛历 ›") } } }
    }
}

@Composable
fun TeamScreen(page: Page.TeamInfo, drivers: List<Standing>, year: Int, model: PitwallViewModel) {
    val team = page.standing
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp)) {
        item { Inset {
            Spacer(Modifier.height(18.dp))
            Text("CONSTRUCTOR PROFILE", color = teamColor(team.constructorId), fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            Text(team.name, Modifier.padding(vertical = 12.dp), fontSize = 28.sp, fontWeight = FontWeight.Bold)
            SectionHeading("$year 赛季表现")
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Fact("积分", team.points, Modifier.weight(1f)); Fact("排名", team.position, Modifier.weight(1f)); Fact("分站冠军", team.wins, Modifier.weight(1f))
            }
            Spacer(Modifier.height(18.dp)); SectionHeading("赛季车手 · 车手总积分")
        } }
        items(drivers.filter { team.constructorId in it.constructorIds }, key = { it.id }) { driver ->
            StandingRow(driver) { driver.driver?.let { model.openDriver(it, standing = driver) } }
        }
        item { InfoRow("完整车队历史", "生涯统计与逐年战绩") { model.openFeature(FeatureKind.HISTORY, identity = team.constructorId, constructor = true) } }
        item { InfoRow("$year 分站战绩", "各站车手成绩与积分") { model.openFeature(FeatureKind.HISTORY_RACES, identity = team.constructorId, constructor = true, season = year) } }
    }
}

@Composable
fun CircuitScreen(page: Page.CircuitInfo, zone: ZoneId, model: PitwallViewModel) {
    val race = page.race
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp)) {
        item { Inset {
            Spacer(Modifier.height(18.dp))
            Text("CIRCUIT PROFILE", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.primary)
            Text(race.circuit, Modifier.padding(vertical = 12.dp), fontSize = 27.sp, fontWeight = FontWeight.Bold)
            Text("${race.locality} · ${race.country}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
            Spacer(Modifier.height(24.dp)); SectionHeading("${race.season} 赛季赛事")
            Text(race.name, Modifier.padding(vertical = 8.dp), fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text(race.start?.let { formatInstant(it, zone, "MM 月 dd 日 HH:mm") } ?: "${race.date} · 时间待定", fontSize = 14.sp, fontFamily = FontFamily.Monospace)
            Spacer(Modifier.height(20.dp)); SectionHeading("比赛周末")
        } }
        items(race.sessions, key = { it.label }) { session ->
            InfoRow(session.label, session.start?.let { formatInstant(it, zone, "MM.dd HH:mm") } ?: "${session.date} · 时间待定")
        }
        item { InfoRow("历届赛事", "按年份查看该赛道的 F1 赛事") { model.openFeature(FeatureKind.CIRCUIT_HISTORY, race, race.circuitId) } }
        item { InfoRow("查看本场比赛", race.name) { model.openRace(race) } }
    }
}

@Composable
fun SettingsScreen(settings: AppSettings, model: PitwallViewModel, features: FeatureViewModel) {
    val auth by features.auth.state.collectAsStateWithLifecycle()
    var picker by remember { mutableStateOf<String?>(null) }
    val themeName = when (settings.theme) { "dark" -> "深色"; "light" -> "浅色"; else -> "跟随系统" }
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp)) {
        item { Inset {
            Spacer(Modifier.height(18.dp)); Text("我的账户", fontSize = 23.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp)); Text(auth.user?.email ?: "公开赛事资料可直接浏览，登录后查看比赛分析。", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
            TextButton(onClick = { model.openFeature(FeatureKind.AUTH) }) { Text(if (auth.user == null) "登录 / 注册 ›" else "管理账号 ›") }
            Spacer(Modifier.height(24.dp)); SectionHeading("显示与偏好")
        } }
        item { InfoRow("界面主题", themeName) { picker = "theme" } }
        item { InfoRow("时间显示", if (settings.timeZone == "UTC") "协调世界时 UTC" else "北京时间 UTC+8") { picker = "zone" } }
        item { InfoRow("清除公开数据缓存", "仅清除设备上的公开缓存，之后重新联网读取。", model::clearCache) }
        item { Inset {
            Spacer(Modifier.height(24.dp)); SectionHeading("关于 FrankPitwall")
            Text("${BuildConfig.VERSION_NAME} · Android 原生试用版", Modifier.padding(vertical = 8.dp), fontSize = 14.sp)
            Text("赛事数据来自 Jolpica F1 / FastF1；进站榜来自 DHL。会员分析沿用网站账号。", fontSize = 12.sp, lineHeight = 20.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } }
    }
    when (picker) {
        "theme" -> SelectionSheet("界面主题", listOf("system" to "跟随系统", "light" to "浅色", "dark" to "深色"), settings.theme,
            { model.setTheme(it); picker = null }, { picker = null })
        "zone" -> SelectionSheet("时间显示", listOf("Asia/Shanghai" to "北京时间 UTC+8", "UTC" to "协调世界时 UTC"), settings.timeZone,
            { model.setZone(it); picker = null }, { picker = null })
    }
}
