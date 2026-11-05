package com.formularone.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.CancellationException
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.formularone.nativeapp.model.*
import java.time.Instant
import java.time.ZoneId

@Composable
fun Inset(content: @Composable ColumnScope.() -> Unit) { Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp), content = content) }

@Composable
fun HomeScreen(resource: Resource<List<Race>>, year: Int, zone: ZoneId, model: PitwallViewModel) {
    val races = resource.data.orEmpty()
    val featured = chooseFeaturedRace(races, Instant.now())
    LazyColumn(state = rememberLazyListState(), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { Inset { DataNotice(resource, zone, model::refresh) } }
        item { InfoRow("围场新闻", "Motorsport · FIA · Reddit") { model.openFeature(FeatureKind.NEWS) } }
        if (featured != null) {
            item { RaceMasthead(featured, zone, actions = {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(onClick = { model.openRace(featured) }, Modifier.weight(1f).heightIn(min = 48.dp), shape = RoundedCornerShape(6.dp), colors = ButtonDefaults.buttonColors(containerColor = ActionRed, contentColor = Color.White)) { Text("查看周末") }
                    TextButton(onClick = { model.openRace(featured, showResults = true) }) { Text("查看成绩 ›", fontSize = 13.sp) }
                }
            }) }
            item { Inset { Spacer(Modifier.height(20.dp)); SectionHeading("赛周日程", "完整赛历", model::openCalendar) } }
            items(featured.sessions, key = { it.label }) { session ->
                WeekendRow(session, zone) { session.classification?.let { model.openRace(featured, it, true) } }
            }
        } else if (!resource.loading && resource.error == null) item { Inset { EmptyMessage("暂无赛程", "$year 赛季暂时没有可查询的赛事。") } }
        item { InfoRow("DHL 进站榜", "$year 赛季换胎表现与最快记录") { model.openFeature(FeatureKind.PITS) } }
        if (races.isNotEmpty()) {
            item { Inset { Spacer(Modifier.height(20.dp)); SectionHeading("赛季赛历", "查看全部", model::openCalendar) } }
            items(races.takeLast(3), key = { it.round }) { race -> RaceRow(race, zone) { model.openRace(race) } }
            item { Inset { Text("公开赛事数据 · Jolpica F1", Modifier.padding(top = 18.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp) } }
        }
    }
}

@Composable
fun RaceMasthead(race: Race, zone: ZoneId, actions: @Composable (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.background)) {
        Box(Modifier.fillMaxWidth().height(3.dp).background(BrandRed))
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text("${race.season} SEASON / ROUND ${race.round.toString().padStart(2, '0')}", color = MaterialTheme.colorScheme.primary, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            Text(race.name, fontSize = 30.sp, fontWeight = FontWeight.Bold, lineHeight = 36.sp)
            Text(race.circuit, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(listOf(race.locality, race.country).filter { it.isNotBlank() }.joinToString(" · "), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(race.start?.let { formatInstant(it, zone, "yyyy.MM.dd") } ?: race.date.toString(), Modifier.weight(1f), fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(race.start?.let { formatInstant(it, zone, "HH:mm") } ?: "时间待定", fontSize = 22.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            }
            Text(if (zone.id == "UTC") "显示时间 UTC" else "显示时间 UTC+8", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            actions?.invoke()
        }
    }
}

@Composable
fun RaceRow(race: Race, zone: ZoneId, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 76.dp).padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(race.round.toString().padStart(2, '0'), color = MaterialTheme.colorScheme.primary, fontFamily = FontFamily.Monospace, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(race.name, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text(race.circuit, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(race.start?.let { formatInstant(it, zone, "MM.dd") } ?: race.date.toString().takeLast(5), fontSize = 12.sp, fontFamily = FontFamily.Monospace)
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

@Composable
fun WeekendRow(session: WeekendSession, zone: ZoneId, onClick: () -> Unit) {
    val clickable = if (session.classification != null) Modifier.clickable(onClick = onClick) else Modifier
    Column(Modifier.fillMaxWidth().then(clickable).padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(session.start?.let { formatInstant(it, zone, "MM.dd") } ?: session.date.toString().takeLast(5), fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(session.label, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text(if (session.classification != null) "查看场次" else "赛程时间", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(session.start?.let { formatInstant(it, zone, "HH:mm") } ?: "待定", fontSize = 14.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

@Composable
fun CalendarScreen(resource: Resource<List<Race>>, zone: ZoneId, model: PitwallViewModel) {
    LazyColumn(state = rememberLazyListState(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { Inset { DataNotice(resource, zone, model::refresh) } }
        items(resource.data.orEmpty(), key = { it.round }) { race -> RaceRow(race, zone) { model.openRace(race) } }
        if (!resource.loading && resource.error == null && resource.data.orEmpty().isEmpty()) item { Inset { EmptyMessage("暂无赛程", "该赛季暂时没有赛事数据。") } }
    }
}

@Composable
fun WeekendScreen(page: Page.Weekend, resource: Resource<List<Classification>>, session: Session, zone: ZoneId, model: PitwallViewModel, features: FeatureViewModel) {
    var section by rememberSaveable { mutableIntStateOf(if (page.showResults) 1 else 0) }
    var sessionPicker by remember { mutableStateOf(false) }
    val race = page.race
    val account by features.auth.state.collectAsStateWithLifecycle()
    val published by produceState(emptySet<Session>(), race) {
        value = emptySet()
        try { value = features.repository.availableSessions(race) }
        catch (error: CancellationException) { throw error }
        catch (_: Exception) { }
    }
    val practice = session in listOf(Session.PRACTICE1, Session.PRACTICE2, Session.PRACTICE3)
    val useMember = section == 1 && practice && !resource.loading && resource.data?.isEmpty() == true && account.user != null
    var member by remember(race, session, account.epoch, useMember) { mutableStateOf(Resource<List<Classification>>(loading = useMember)) }
    LaunchedEffect(race, session, account.epoch, useMember) {
        if (useMember) {
            try { member = Resource(data = features.repository.memberPractice(race, session)) }
            catch (error: CancellationException) { throw error }
            catch (_: Exception) { member = Resource(error = "暂未读到会员练习赛记录，可刷新重试。") }
        }
    }
    val scheduled = race.sessions.mapNotNull { it.classification }
    val practiceOptions = listOf(Session.PRACTICE1, Session.PRACTICE2, Session.PRACTICE3)
    val archivedPractice = if (race.season >= 2018 && race.date.isBefore(java.time.LocalDate.now()) &&
        scheduled.none { it in practiceOptions }) practiceOptions else emptyList()
    val available = (scheduled + published + archivedPractice + session).distinct().sortedBy { it.ordinal }
    val displayed = if (useMember) member else resource
    LazyColumn(state = rememberLazyListState(), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { RaceMasthead(race, zone) }
        item { Inset { ChoiceTabs(listOf("概览", "成绩", "分析"), section) { section = it } } }
        if (section == 0) {
            item { Inset { Spacer(Modifier.height(14.dp)); SectionHeading("周末日程") } }
            items(race.sessions, key = { it.label }) { event -> WeekendRow(event, zone) { event.classification?.let { model.selectSession(it); section = 1 } } }
            item { Inset { Spacer(Modifier.height(16.dp)); SectionHeading("赛道资料"); TextButton(onClick = { model.openCircuit(race) }) { Text("${race.circuit} ›") } } }
        } else if (section == 1) {
            item { Inset {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { sessionPicker = true }) { Text("${session.label} ⌄", color = MaterialTheme.colorScheme.onSurface) }
                    Spacer(Modifier.weight(1f))
                    Text(if (useMember) "FastF1 圈速" else "官方成绩", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                HorizontalChoices(available.map { it.label }, available.indexOf(session)) { model.selectSession(available[it]) }
                DataNotice(displayed, zone, model::refresh)
            } }
            val rows = displayed.data.orEmpty()
            if (rows.isNotEmpty()) item { Inset {
                Row(Modifier.padding(vertical = 9.dp)) {
                    Text("名次 / 车手", Modifier.weight(1f), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(if (session.qualifying || session.endpoint.isBlank()) "圈速" else "时间 / 积分", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.onSurface)
            } }
            items(rows, key = { it.driver.id }) { result -> ClassificationRow(result, session) { model.openDriver(result.driver, result = if (useMember) null else result) } }
            if (!displayed.loading && displayed.error == null && rows.isEmpty()) item { Inset {
                EmptyMessage("暂无场次成绩", if (practice && account.user == null) "公开成绩尚未发布，可登录查询会员练习赛记录。" else "数据源尚未提供本场记录。")
                if (practice && account.user == null) TextButton(onClick = { model.openFeature(FeatureKind.AUTH) }) { Text("登录查询") }
            } }
        } else {
            item { InfoRow("圈速、位置与轮胎", "选择车手对比 · 天气 · 赛控 · 策略") { model.openFeature(FeatureKind.ANALYSIS, race) } }
            item { InfoRow("遥测对比", "速度 · 油门 · 刹车 · 挡位 · 转速") { model.openFeature(FeatureKind.TELEMETRY, race) } }
            item { InfoRow("比赛预测", "模型概率与影响因素") { model.openFeature(FeatureKind.PREDICTION, race) } }
            item { InfoRow("比赛天气", "OpenF1 温度、风速与降雨汇总") { model.openFeature(FeatureKind.WEATHER, race) } }
            item { InfoRow("本场进站", "维修区通过时间与停车换胎时间") { model.openFeature(FeatureKind.PITS, race) } }
            item { InfoRow("FIA 赛车升级", "车队申报部件与原始资料") { model.openFeature(FeatureKind.UPGRADES, race) } }
        }
    }
    if (sessionPicker) {
        SelectionSheet("选择场次", available.map { it.name to it.label }, session.name,
            { model.selectSession(Session.valueOf(it)); sessionPicker = false }, { sessionPicker = false })
    }
}

@Composable
fun ClassificationRow(result: Classification, session: Session, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 68.dp).padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(result.position, Modifier.widthIn(min = 20.dp), fontSize = 18.sp, fontWeight = FontWeight.Bold,
                color = if (result.position == "1") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)
            Box(Modifier.width(3.dp).height(26.dp).background(teamColor(result.constructorId)))
            DriverPortrait(result.driver)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(driverName(result.driver), fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text(result.constructor, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(Modifier.widthIn(max = 116.dp), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(result.timing, fontSize = 12.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                Text(if (session.qualifying) result.qualifyingTimes.lastOrNull()?.first.orEmpty() else if (session.endpoint.isBlank()) "${result.laps} 圈" else "${result.points} 积分", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}
