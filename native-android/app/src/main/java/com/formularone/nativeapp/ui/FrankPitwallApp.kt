package com.formularone.nativeapp.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.formularone.nativeapp.R
import java.time.LocalDate
import java.time.ZoneId

@Composable
fun FrankPitwallApp(model: PitwallViewModel, features: FeatureViewModel, dark: Boolean) {
    val pages by model.pages.collectAsStateWithLifecycle()
    val year by model.year.collectAsStateWithLifecycle()
    val races by model.races.collectAsStateWithLifecycle()
    val drivers by model.drivers.collectAsStateWithLifecycle()
    val teams by model.teams.collectAsStateWithLifecycle()
    val results by model.results.collectAsStateWithLifecycle()
    val session by model.session.collectAsStateWithLifecycle()
    val settings by model.settings.collectAsStateWithLifecycle()
    val notice by model.notice.collectAsStateWithLifecycle()
    val zone = remember(settings.timeZone) { ZoneId.of(settings.timeZone) }
    val page = pages.last()
    var yearPicker by remember { mutableStateOf(false) }
    val savedScreens = rememberSaveableStateHolder()
    val snackbar = remember { SnackbarHostState() }
    BackHandler(enabled = pages.size > 1) { model.back() }
    LaunchedEffect(notice) { notice?.let { snackbar.showSnackbar(it); model.dismissNotice() } }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.surface,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            Column(Modifier.background(MaterialTheme.colorScheme.surface).statusBarsPadding()) {
                Row(Modifier.fillMaxWidth().heightIn(min = 76.dp).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (page is Page.Root) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Image(painterResource(if (dark) R.drawable.brand_logo_dark else R.drawable.brand_logo_light), "FrankPitwall", Modifier.size(145.dp, 25.dp))
                            Text(page.tab.label, style = MaterialTheme.typography.titleLarge)
                        }
                    } else {
                        TextButton(onClick = model::back, contentPadding = PaddingValues(0.dp), modifier = Modifier.widthIn(min = 48.dp)) { Text("返回", fontSize = 13.sp) }
                        Text(when (page) { Page.Calendar -> "完整赛历"; is Page.Weekend -> "比赛周末"; is Page.DriverInfo -> "车手档案"; is Page.TeamInfo -> "车队档案"; is Page.Feature -> page.kind.label; else -> "赛道资料" }, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                    }
                    if (page == Page.Calendar || (page is Page.Root && page.tab != RootTab.ME)) {
                        TextButton(onClick = { yearPicker = true }) { Text("$year ⌄", fontSize = 14.sp) }
                    }
                    if (page is Page.Weekend || page == Page.Calendar || (page is Page.Root && page.tab != RootTab.ME)) {
                        TextButton(onClick = model::refresh, contentPadding = PaddingValues(4.dp)) { Text("刷新", fontSize = 12.sp) }
                    }
                }
            }
        },
        bottomBar = {
            if (page is Page.Root) NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 0.dp) {
                RootTab.entries.forEach { tab ->
                    NavigationBarItem(selected = page.tab == tab, onClick = { model.switchRoot(tab) },
                        icon = { NavGlyph(tab) }, label = { Text(tab.label, fontSize = 11.sp) },
                        colors = NavigationBarItemDefaults.colors(indicatorColor = Color.Transparent,
                            selectedIconColor = MaterialTheme.colorScheme.primary, selectedTextColor = MaterialTheme.colorScheme.primary))
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).imePadding()) {
            val key = when (page) {
                is Page.Root -> "${page.tab}-$year"
                Page.Calendar -> "calendar-$year"
                is Page.Weekend -> "race-${page.race.season}-${page.race.round}"
                is Page.DriverInfo -> "driver-${page.driver.id}-$year"
                is Page.TeamInfo -> "team-${page.standing.id}-$year"
                is Page.CircuitInfo -> "circuit-${page.race.circuitId}-$year"
                is Page.Feature -> "feature-${page.kind}-${page.identity}-${page.season}-${page.race?.season}-${page.race?.round}"
            }
            savedScreens.SaveableStateProvider(key) {
                when (page) {
                    is Page.Root -> when (page.tab) {
                        RootTab.RACES -> HomeScreen(races, year, zone, model)
                        RootTab.STANDINGS -> StandingsScreen(drivers, teams, year, zone, model)
                        RootTab.LIBRARY -> LibraryScreen(drivers, teams, races, year, zone, model)
                        RootTab.ME -> SettingsScreen(settings, model, features)
                    }
                    Page.Calendar -> CalendarScreen(races, zone, model)
                    is Page.Weekend -> WeekendScreen(page, results, session, zone, model, features)
                    is Page.DriverInfo -> DriverScreen(page, page.season ?: year, model)
                    is Page.TeamInfo -> TeamScreen(page, drivers.data.orEmpty(), year, model)
                    is Page.CircuitInfo -> CircuitScreen(page, zone, model)
                    is Page.Feature -> FeatureScreen(page, year, zone, session, drivers.data.orEmpty(), teams.data.orEmpty(), model, features)
                }
            }
        }
    }
    if (yearPicker) SelectionSheet("选择赛季", (LocalDate.now().year downTo 1950).map { it.toString() to "$it 赛季" }, year.toString(),
        onSelect = { model.selectYear(it.toInt()); yearPicker = false }, onDismiss = { yearPicker = false })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SelectionSheet(title: String, options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = MaterialTheme.colorScheme.surface,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Text(title, Modifier.padding(horizontal = 20.dp, vertical = 12.dp), style = MaterialTheme.typography.titleLarge)
        LazyColumn(Modifier.heightIn(max = 440.dp).navigationBarsPadding(), contentPadding = PaddingValues(bottom = 20.dp)) {
            items(options, key = { it.first }) { (value, label) ->
                TextButton(onClick = { onSelect(value) }, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp), contentPadding = PaddingValues(horizontal = 20.dp)) {
                    Text(label, Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurface)
                    if (value == selected) Text("✓", color = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}
