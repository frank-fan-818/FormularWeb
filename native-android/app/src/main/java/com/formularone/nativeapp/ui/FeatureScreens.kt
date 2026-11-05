package com.formularone.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.formularone.nativeapp.data.*
import com.formularone.nativeapp.model.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.time.Instant
import java.time.ZoneId

@Composable
private fun <T> FeatureLoad(identity: String, zone: ZoneId, request: suspend (Boolean) -> Loaded<T>, content: @Composable (T) -> Unit) {
    var resource by remember(identity) { mutableStateOf(Resource<Loaded<T>>(loading = true)) }
    var refresh by remember(identity) { mutableIntStateOf(0) }
    val loader by rememberUpdatedState(request)
    LaunchedEffect(identity, refresh) {
        resource = resource.copy(loading = true, error = null)
        try {
            val loaded = loader(refresh > 0); currentCoroutineContext().ensureActive()
            resource = Resource(loaded, updatedAt = loaded.updatedAt, stale = loaded.stale)
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (error: Exception) { currentCoroutineContext().ensureActive(); resource = resource.copy(loading = false, error = featureError(error)) }
    }
    Column(Modifier.fillMaxSize()) {
        Inset {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { TextButton(onClick = { refresh++ }, enabled = !resource.loading) { Text("刷新") } }
            DataNotice(resource, zone) { refresh++ }
        }
        Box(Modifier.fillMaxWidth().weight(1f)) { resource.data?.let { content(it.data) } }
    }
}

@Composable
fun FeatureScreen(page: Page.Feature, year: Int, zone: ZoneId, currentSession: Session, drivers: List<Standing>, teams: List<Standing>, model: PitwallViewModel, features: FeatureViewModel) {
    val auth by features.auth.state.collectAsStateWithLifecycle()
    val repository = features.repository
    var pickedSession by rememberSaveable(page) { mutableStateOf(currentSession.name) }
    var sessionPicker by remember { mutableStateOf(false) }
    val session = Session.valueOf(pickedSession)
    val privatePage = page.kind in listOf(FeatureKind.ANALYSIS, FeatureKind.TELEMETRY, FeatureKind.PREDICTION, FeatureKind.WEATHER)
    if (privatePage && auth.user == null) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            EmptyMessage("登录后查看${page.kind.label}", "使用网站已有账号，保留相同的数据权限。")
            Button(onClick = { model.openFeature(FeatureKind.AUTH) }) { Text("登录 / 注册") }
        }
        return
    }
    Column(Modifier.fillMaxSize()) {
        if (privatePage) Inset { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { TextButton(onClick = { model.openFeature(FeatureKind.AUTH) }) { Text("账号") } } }
        if (page.race != null && page.kind in listOf(FeatureKind.ANALYSIS, FeatureKind.TELEMETRY)) {
            Inset {
                Text(page.race.name, style = MaterialTheme.typography.titleSmall)
                TextButton(onClick = { sessionPicker = true }) { Text("${session.label} ⌄") }
            }
        }
        val key = "$page-$pickedSession-${if (privatePage) auth.epoch else 0}"
        Box(Modifier.fillMaxSize()) {
            when (page.kind) {
                FeatureKind.AUTH -> AuthScreen(features)
                FeatureKind.NEWS -> NewsScreen(repository, zone)
                FeatureKind.PITS -> PitsScreen(repository, page.race, year, zone)
                FeatureKind.HISTORY -> FeatureLoad(key, zone, { repository.history(page.identity, page.constructor, it) }) { profile -> HistoryScreen(profile, page, model) }
                FeatureKind.HISTORY_RACES, FeatureKind.CIRCUIT_HISTORY -> FeatureLoad(key, zone, { repository.historyRaces(page.identity, if (page.kind == FeatureKind.CIRCUIT_HISTORY) "circuits" else if (page.constructor) "constructors" else "drivers", page.season, it) }) { rows ->
                    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                        if (rows.isEmpty()) item { Inset { EmptyMessage("暂无历史赛事", "当前数据源没有提供记录。") } }
                        items(rows, key = { "${it.race.season}-${it.race.round}" }) { entry ->
                            InfoRow("${entry.race.season} · R${entry.race.round} · ${entry.race.name}", entry.results.joinToString("\n") { "${it.driver.name} · P${it.position} · ${it.points} 积分 · ${it.timing}" }.ifBlank { entry.race.date.toString() }) { model.openRace(entry.race, showResults = true) }
                        }
                    }
                }
                FeatureKind.UPGRADES -> FeatureLoad(key, zone, { repository.upgrades(requireNotNull(page.race), it) }) { records -> UpgradeScreen(records) }
                FeatureKind.ANALYSIS -> FeatureLoad(key, zone, { Loaded(repository.analysis(requireNotNull(page.race), session), Instant.now()) }) { AnalysisScreen(it) }
                FeatureKind.TELEMETRY -> FeatureLoad(key, zone, { Loaded(repository.telemetry(requireNotNull(page.race), session), Instant.now()) }) { raw -> TelemetryScreen(raw, requireNotNull(page.race), session) }
                FeatureKind.PREDICTION -> FeatureLoad(key, zone, { Loaded(repository.prediction(requireNotNull(page.race)), Instant.now()) }) { PredictionScreen(it) }
                FeatureKind.COMPARE -> ComparisonScreen(drivers, teams)
                FeatureKind.ARCHIVE -> ArchiveScreen(repository, zone, model)
                FeatureKind.WEATHER -> FeatureLoad(key, zone, { Loaded(repository.weather(requireNotNull(page.race)), Instant.now()) }) { RecordsScreen(it, "暂无天气记录", "OpenF1 尚未提供该场天气汇总。") }
            }
        }
    }
    if (sessionPicker) {
        val available = (page.race?.sessions.orEmpty().mapNotNull { it.classification } + Session.RACE + Session.QUALIFYING).distinct()
        SelectionSheet("选择分析场次", available.map { it.name to it.label }, pickedSession, { pickedSession = it; sessionPicker = false }, { sessionPicker = false })
    }
}

@Composable
private fun NewsScreen(repository: FeatureRepository, zone: ZoneId) {
    var sourceIndex by rememberSaveable { mutableIntStateOf(0) }
    val source = NewsSource.entries[sourceIndex]
    Column {
        Inset { ChoiceTabs(NewsSource.entries.map { it.label }, sourceIndex) { sourceIndex = it } }
        FeatureLoad("news-$source", zone, { repository.news(source, it) }) { news ->
            LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                if (news.isEmpty()) item { Inset { EmptyMessage("暂无新闻", "该来源暂时没有提供新闻条目。") } }
                items(news, key = { it.id }) { article ->
                    val uri = LocalUriHandler.current
                    InfoRow(article.title, listOf(article.published, article.summary).filter { it.isNotBlank() }.joinToString("\n")) { runCatching { uri.openUri(article.url) } }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun HistoryScreen(profile: CareerProfile?, page: Page.Feature, model: PitwallViewModel) {
    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        if (profile == null) item { Inset { EmptyMessage("暂无生涯汇总", "仍可从档案页查询当前赛季分站成绩。") } }
        else {
            item { Inset {
                Text(profile.name, style = MaterialTheme.typography.headlineSmall)
                Text(listOf(profile.nationality, profile.birth).filter { it.isNotBlank() }.joinToString(" · "), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(16.dp))
                FlowRow(maxItemsInEachRow = 3, horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    profile.facts.forEach { (name, value) -> Fact(name, numeric(value), Modifier.widthIn(min = 80.dp)) }
                }
                if (profile.note.isNotBlank()) Text(profile.note, Modifier.padding(vertical = 12.dp))
                Spacer(Modifier.height(20.dp)); SectionHeading("逐年战绩")
            } }
            items(profile.seasons, key = { it.year }) { s ->
                InfoRow("${s.year} · 第 ${s.position} 名", "${s.points} 积分 · ${s.wins} 冠军${s.team.takeIf { it.isNotBlank() }?.let { " · $it" }.orEmpty()}") {
                    model.openFeature(FeatureKind.HISTORY_RACES, identity = page.identity, constructor = page.constructor, season = s.year)
                }
            }
        }
    }
}

@Composable
private fun PitsScreen(repository: FeatureRepository, race: Race?, year: Int, zone: ZoneId) {
    var selected by rememberSaveable { mutableIntStateOf(0) }
    val options = if (race == null) listOf("车队榜", "赛季最快") else listOf("本场进站", "DHL 榜", "赛季最快")
    val award = race == null || selected > 0
    Column {
        Inset { ChoiceTabs(options, selected) { selected = it } }
        FeatureLoad("pits-${race?.season ?: year}-${race?.round}-$award", zone, { repository.pits(race?.season ?: year, race?.round, award, it) }) { data ->
            LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                item { Inset {
                    if (data.stale) Text("来源当前返回缓存记录 · ${data.updatedAt}", color = MaterialTheme.colorScheme.error)
                    if (data.partial) Text("部分停车换胎时间尚未匹配，维修区通过时间仍可查看。", style = MaterialTheme.typography.bodySmall)
                    if (data.event.isNotBlank()) Text(data.event, style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(12.dp))
                } }
                val fastest = selected == options.lastIndex && options.last() == "赛季最快"
                if (fastest) {
                    items(data.fastest) { pit -> InfoRow("${pit.driver} · ${pit.stationary} s", "${pit.team} · ${pit.note}") }
                    if (data.fastest.isEmpty()) item { Inset { EmptyMessage("暂无最快换胎记录", "DHL 尚未提供此赛季记录。") } }
                } else if (award) {
                    items(data.standings) { s -> InfoRow("${s.rank} · ${s.team}", "${s.points} 积分") }
                    if (data.standings.isEmpty()) item { Inset { EmptyMessage("暂无 DHL 积分榜", "该赛季的榜单尚未发布。") } }
                } else {
                    items(data.stops) { pit -> InfoRow("${pit.driver} · L${pit.lap} · ${pit.team}", "维修区通过 ${pit.lane.ifBlank { "—" }} s\n停车换胎 ${pit.stationary.ifBlank { "—" }} s${pit.note.takeIf { it.isNotBlank() }?.let { "\n$it" }.orEmpty()}") }
                    if (data.stops.isEmpty()) item { Inset { EmptyMessage("暂无本场进站", "比赛尚未进行或数据尚未发布。") } }
                }
            }
        }
    }
}

@Composable
private fun UpgradeScreen(records: List<TextRecord>) {
    val browser = LocalUriHandler.current
    val groups = remember(records) { records.groupBy { it.title.substringBefore(" · ") } }
    var selectedTeam by rememberSaveable { mutableStateOf("") }
    val shown = if (selectedTeam.isEmpty()) groups else groups.filterKeys { it == selectedTeam }
    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        if (records.isEmpty()) item { Inset { EmptyMessage("暂无升级申报", "FIA 尚未提供该场升级记录。") } }
        else item { Inset {
            Text("FIA 技术申报", style = MaterialTheme.typography.titleLarge)
            Text("${groups.size} 支车队 · ${records.count { " · " in it.title }} 条部件记录",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            val teams = listOf("") + groups.keys
            HorizontalChoices(teams.map { it.ifEmpty { "全部" } }, teams.indexOf(selectedTeam)) { selectedTeam = teams[it] }
        } }
        shown.forEach { (team, entries) ->
            item(key = "team-$team") { Inset { SectionHeading(team) } }
            items(entries.size, key = { "$team-$it" }) { index ->
                val entry = entries[index]
                val detail = entry.detail.replace(Regex("\\s+"), " ").trim()
                var expanded by rememberSaveable(entry.title, entry.detail) { mutableStateOf(false) }
                Inset {
                    Column(Modifier.fillMaxWidth().clickable { expanded = !expanded }.padding(vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(entry.title.substringAfter(" · ", "升级汇总"), Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
                            Text(if (expanded) "收起" else "展开", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium)
                        }
                        Text(detail, maxLines = if (expanded) Int.MAX_VALUE else 2, overflow = TextOverflow.Ellipsis,
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (expanded && entry.url.isNotBlank()) TextButton(onClick = { runCatching { browser.openUri(entry.url) } }) { Text("打开 FIA 原件") }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                }
            }
        }
    }
}

@Composable
private fun RecordsScreen(records: List<TextRecord>, title: String = "暂无记录", detail: String = "该场次未发布此类数据。") {
    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        if (records.isEmpty()) item { Inset { EmptyMessage(title, detail) } }
        items(records) { record ->
            val uri = LocalUriHandler.current
            InfoRow(record.title, record.detail, if (record.url.isNotBlank()) ({ runCatching { uri.openUri(record.url) }; Unit }) else null)
        }
    }
}

@Composable
private fun AnalysisScreen(data: AnalysisData) {
    var section by rememberSaveable { mutableIntStateOf(0) }
    Column {
        Inset { HorizontalChoices(listOf("圈速", "位置", "轮胎", "天气", "策略", "赛控", "排位"), section) { section = it } }
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item { Inset {
                if (data.generatedAt.isNotBlank()) Text("数据生成 ${data.generatedAt}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (data.fastest.isNotBlank()) Text("最快圈 ${data.fastest}", style = MaterialTheme.typography.bodySmall)
                when (section) {
                    0 -> NativeLineChart("圈速对比", data.laps, "圈", "s")
                    1 -> NativeLineChart("比赛位置", data.positions, "圈", "名", positions = true)
                    3 -> NativeLineChart("天气变化", data.weather, "分钟", "", single = true)
                }
            } }
            when (section) {
                3 -> items(data.weatherSummary) { InfoRow(it.title, it.detail) }
                2 -> {
                    if (data.stints.isEmpty()) item { Inset { EmptyMessage("暂无轮胎记录", "该场次没有提供轮胎分段数据。") } }
                    items(data.stints.groupBy { it.driver }.toList()) { (driver, stints) ->
                        Inset {
                            Text(driver, style = MaterialTheme.typography.titleSmall)
                            val maxLap = data.stints.maxOfOrNull { it.end }?.toFloat()?.coerceAtLeast(1f) ?: 1f
                            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp).height(20.dp)) {
                                var previous = 0
                                stints.sortedBy { it.start }.forEach { stint ->
                                    val gap = (stint.start - previous - 1).coerceAtLeast(0)
                                    if (gap > 0) Spacer(Modifier.weight(gap.toFloat()))
                                    Box(Modifier.weight((stint.end - stint.start + 1).toFloat()).fillMaxHeight().background(tyreColor(stint.compound)))
                                    previous = stint.end
                                }
                                if (previous < maxLap) Spacer(Modifier.weight(maxLap - previous))
                            }
                            Text(stints.joinToString(" · ") { "${it.compound} L${it.start}–${it.end}${when (it.fresh) { true -> " 新胎"; false -> " 旧胎"; null -> "" }}" }, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                4, 5, 6 -> {
                    val records = when (section) { 4 -> data.strategy; 5 -> data.messages; else -> data.qualifying }
                    if (records.isEmpty()) item { Inset { EmptyMessage("暂无相关记录", "该场次没有发布此项目。") } }
                    items(records) { InfoRow(it.title, it.detail) }
                }
            }
        }
    }
}

private fun tyreColor(compound: String): Color = when (compound.uppercase()) {
    "SOFT" -> Color(0xFFEB3447); "MEDIUM" -> Color(0xFFE6BA35); "HARD" -> Color(0xFFB6BAC1)
    "INTERMEDIATE" -> Color(0xFF41A75A); "WET" -> Color(0xFF328BD0); else -> Color(0xFF777777)
}

@Composable
private fun TelemetryScreen(raw: String, race: Race, session: Session) {
    var metric by rememberSaveable { mutableIntStateOf(0) }
    val fields = listOf("speedKph", "throttlePct", "brake", "gear", "rpm", "drs")
    val labels = listOf("速度", "油门", "刹车开关", "挡位", "转速", "DRS")
    val units = listOf("km/h", "%", "状态", "挡", "rpm", "状态码")
    val code = if (session == Session.SPRINT_QUALIFYING && race.season == 2023) "SS" else session.code
    val series = remember(raw, metric) { runCatching { FeatureMapper.telemetry(raw, race.season, race.round, code, fields[metric]) }.getOrDefault(emptyList()) }
    LazyColumn(contentPadding = PaddingValues(16.dp)) {
        item { HorizontalChoices(labels, metric) { metric = it }; Spacer(Modifier.height(16.dp)) }
        item { Text("各车手选取圈的遥测，横轴按行驶距离对齐。刹车显示开关（1/0），不代表压力；DRS 显示原始状态码。", style = MaterialTheme.typography.bodySmall); Spacer(Modifier.height(16.dp)) }
        item { NativeLineChart("${labels[metric]}对比", series, "m", units[metric]) }
    }
}

@Composable
private fun PredictionScreen(data: PredictionData?) {
    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        if (data == null || data.candidates.isEmpty()) item { Inset { EmptyMessage("暂无比赛预测", "此分站的预测尚未生成。") } }
        else {
            item { Inset {
                Text("模型 ${data.version} · ${if (data.phase == "post_quali") "排位后" else "赛前"}", style = MaterialTheme.typography.titleSmall)
                Text("生成 ${data.generatedAt}\n模型估计存在不确定性，概率不代表最终结果。", style = MaterialTheme.typography.bodySmall)
            } }
            items(data.candidates, key = { it.driver }) { p ->
                var expanded by remember { mutableStateOf(false) }
                InfoRow("${p.rank} · ${p.driver} · ${numeric(p.probability * 100)}%", p.team) { expanded = !expanded }
                if (expanded) p.factors.forEach { f -> Inset { Text("${f.title} · ${f.detail}", Modifier.padding(vertical = 6.dp), style = MaterialTheme.typography.bodySmall) } }
            }
        }
    }
}

@Composable
private fun ComparisonScreen(drivers: List<Standing>, teams: List<Standing>) {
    var kind by rememberSaveable { mutableIntStateOf(0) }
    val entries = if (kind == 0) drivers else teams
    var first by rememberSaveable(kind) { mutableStateOf(entries.firstOrNull()?.id.orEmpty()) }
    var second by rememberSaveable(kind) { mutableStateOf(entries.getOrNull(1)?.id.orEmpty()) }
    var picker by remember { mutableIntStateOf(-1) }
    val a = entries.find { it.id == first }; val b = entries.find { it.id == second }
    LaunchedEffect(entries.map { it.id }) {
        if (entries.none { it.id == first }) first = entries.firstOrNull()?.id.orEmpty()
        if (entries.none { it.id == second }) second = entries.getOrNull(1)?.id.orEmpty()
    }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { ChoiceTabs(listOf("车手", "车队"), kind) { kind = it } }
        if (entries.size < 2) item { EmptyMessage("暂无可对比记录", "当前赛季至少需要两条积分榜记录。") }
        else {
            item { TextButton(onClick = { picker = 0 }) { Text("${a?.name ?: "选择第一位"} ⌄") }; TextButton(onClick = { picker = 1 }) { Text("${b?.name ?: "选择第二位"} ⌄") } }
            if (a != null && b != null) {
                listOf("积分" to (a.points to b.points), "排名" to (a.position to b.position), "分站冠军" to (a.wins to b.wins)).forEach { (label, values) ->
                    item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(values.first); Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant); Text(values.second) }; HorizontalDivider(Modifier.padding(top = 12.dp)) }
                }
            }
        }
    }
    if (picker >= 0) SelectionSheet("选择${if (kind == 0) "车手" else "车队"}", entries.map { it.id to it.name }, if (picker == 0) first else second, { if (picker == 0) first = it else second = it; picker = -1 }, { picker = -1 })
}

@Composable
fun HorizontalChoices(labels: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        items(labels.size) { index -> FilterChip(selected == index, { onSelect(index) }, label = { Text(labels[index]) }) }
    }
}

@Composable
private fun ArchiveScreen(repository: FeatureRepository, zone: ZoneId, model: PitwallViewModel) {
    var category by rememberSaveable { mutableIntStateOf(0) }
    var query by rememberSaveable { mutableStateOf("") }
    val kind = listOf("drivers", "constructors", "circuits")[category]
    var loaded by remember(kind) { mutableStateOf(Resource<List<ArchiveEntry>>(loading = true)) }
    var total by remember(kind) { mutableIntStateOf(0) }
    var action by remember(kind) { mutableIntStateOf(0) }
    var all by remember(kind) { mutableStateOf(false) }
    LaunchedEffect(kind, action) {
        loaded = loaded.copy(loading = true, error = null)
        try {
            do {
                val offset = loaded.data.orEmpty().size
                val next = repository.archive(kind, offset)
                currentCoroutineContext().ensureActive()
                total = next.data.total
                val combined = loaded.data.orEmpty() + next.data.entries
                require(combined.map { it.id }.distinct().size == combined.size)
                loaded = Resource(combined, loading = all && offset + next.data.entries.size < total, stale = loaded.stale || next.stale, updatedAt = next.updatedAt)
            } while (all && loaded.data.orEmpty().size < total)
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (error: Exception) { currentCoroutineContext().ensureActive(); loaded = loaded.copy(loading = false, error = featureError(error)) }
    }
    val filtered = loaded.data.orEmpty().filter { "${it.name} ${it.id} ${it.detail}".contains(query, true) }
    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        item { Inset {
            ChoiceTabs(listOf("车手", "车队", "赛道"), category) { category = it }
            TextField(query, { query = it }, singleLine = true, placeholder = { Text("搜索已加载的历史资料") }, modifier = Modifier.fillMaxWidth())
            Text("已加载 ${loaded.data.orEmpty().size} / $total 条", style = MaterialTheme.typography.bodySmall)
            DataNotice(loaded, zone) { action++ }
            if (!loaded.loading && loaded.data.orEmpty().size < total) TextButton(onClick = { all = true; action++ }) { Text("加载全部历史资料后搜索") }
        } }
        items(filtered, key = { it.id }) { entry ->
            InfoRow(entry.name, entry.detail) {
                model.openFeature(if (category == 2) FeatureKind.CIRCUIT_HISTORY else FeatureKind.HISTORY, identity = entry.id, constructor = category == 1)
            }
        }
        if (!loaded.loading && loaded.error == null && filtered.isEmpty()) item { Inset { EmptyMessage("没有匹配记录", if (loaded.data.orEmpty().size < total) "可加载全部历史资料后再搜索。" else "试试其他姓名、国籍或名称。") } }
    }
}
