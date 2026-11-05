package com.formularone.nativeapp.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.formularone.nativeapp.data.AppSettings
import com.formularone.nativeapp.data.F1Repository
import com.formularone.nativeapp.data.HttpStatusException
import com.formularone.nativeapp.data.Loaded
import com.formularone.nativeapp.model.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.supervisorScope
import java.io.IOException
import java.time.Instant
import java.time.LocalDate

enum class RootTab(val label: String) { RACES("赛事"), STANDINGS("榜单"), LIBRARY("资料"), ME("我的") }
enum class FeatureKind(val label: String) {
    NEWS("围场新闻"), PITS("进站数据"), UPGRADES("FIA 赛车升级"), ANALYSIS("比赛分析"), TELEMETRY("遥测对比"), WEATHER("比赛天气"),
    PREDICTION("比赛预测"), HISTORY("生涯档案"), HISTORY_RACES("赛季战绩"), CIRCUIT_HISTORY("赛道历届赛事"), AUTH("账号"), COMPARE("积分对比"), ARCHIVE("历史资料库")
}
sealed interface Page {
    data class Root(val tab: RootTab) : Page
    data object Calendar : Page
    data class Weekend(val race: Race, val showResults: Boolean = false) : Page
    data class DriverInfo(val driver: Driver, val standing: Standing? = null, val result: Classification? = null, val season: Int? = null) : Page
    data class TeamInfo(val standing: Standing) : Page
    data class CircuitInfo(val race: Race) : Page
    data class Feature(val kind: FeatureKind, val race: Race? = null, val identity: String = "", val constructor: Boolean = false, val season: Int? = null) : Page
}
data class Resource<T>(val data: T? = null, val loading: Boolean = false, val error: String? = null, val stale: Boolean = false, val updatedAt: Instant? = null)

class PitwallViewModel(
    private val repository: F1Repository,
    settingsFlow: Flow<AppSettings>,
    private val saveTheme: suspend (String) -> Unit,
    private val saveZone: suspend (String) -> Unit,
    private val saveSeason: suspend (Int) -> Unit = {},
) : ViewModel() {
    private val _year = MutableStateFlow(LocalDate.now().year)
    val year = _year.asStateFlow()
    private val _pages = MutableStateFlow<List<Page>>(listOf(Page.Root(RootTab.RACES)))
    val pages = _pages.asStateFlow()
    private val _races = MutableStateFlow(Resource<List<Race>>())
    val races = _races.asStateFlow()
    private val _drivers = MutableStateFlow(Resource<List<Standing>>())
    val drivers = _drivers.asStateFlow()
    private val _teams = MutableStateFlow(Resource<List<Standing>>())
    val teams = _teams.asStateFlow()
    private val _results = MutableStateFlow(Resource<List<Classification>>())
    val results = _results.asStateFlow()
    private val _session = MutableStateFlow(Session.RACE)
    val session = _session.asStateFlow()
    private val _notice = MutableStateFlow<String?>(null)
    val notice = _notice.asStateFlow()
    val settings = settingsFlow.stateIn(viewModelScope, SharingStarted.Eagerly, AppSettings())
    private var seasonJob: Job? = null
    private var resultsJob: Job? = null
    private var selectedRace: Race? = null
    private val sessionSelections = mutableMapOf<Pair<Int, Int>, Session>()

    init {
        viewModelScope.launch {
            settingsFlow.first().season?.takeIf { it in 1950..LocalDate.now().year + 1 }?.let { _year.value = it }
            loadSeason(false)
        }
    }

    fun selectYear(value: Int) {
        require(value in 1950..LocalDate.now().year + 1)
        if (value == _year.value) return
        _year.value = value
        viewModelScope.launch { runCatching { saveSeason(value) }.onFailure { if (it is CancellationException) throw it; _notice.value = "赛季偏好暂时无法保存。" } }
        selectedRace = null
        sessionSelections.clear()
        resultsJob?.cancel()
        _pages.value = listOf(_pages.value.first())
        _races.value = Resource()
        _drivers.value = Resource()
        _teams.value = Resource()
        loadSeason(false)
    }

    private fun loadSeason(refresh: Boolean) {
        seasonJob?.cancel()
        val year = _year.value
        seasonJob = viewModelScope.launch {
            supervisorScope {
                launch { load(_races) { repository.races(year, refresh) } }
                launch { load(_drivers) { repository.standings(year, false, refresh) } }
                launch { load(_teams) { repository.standings(year, true, refresh) } }
            }
        }
    }

    private suspend fun <T> load(target: MutableStateFlow<Resource<T>>, request: suspend () -> Loaded<T>) {
        target.update { it.copy(loading = true, error = null) }
        try {
            val loaded = request()
            currentCoroutineContext().ensureActive()
            target.value = Resource(loaded.data, updatedAt = loaded.updatedAt, stale = loaded.stale)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            currentCoroutineContext().ensureActive()
            val message = when {
                error is HttpStatusException && error.status == 429 -> "访问较频繁，请稍后再试。"
                error is IOException -> "暂时无法连接数据服务，请检查网络后重试。"
                else -> "数据暂时无法读取，请稍后重试。"
            }
            target.update { it.copy(loading = false, error = message) }
        }
    }

    fun switchRoot(tab: RootTab) {
        resultsJob?.cancel()
        selectedRace = null
        _pages.value = listOf(Page.Root(tab))
    }
    private fun push(page: Page) { _pages.value += page }
    fun back() {
        if (_pages.value.size <= 1) return
        val previous = _pages.value.dropLast(1)
        val destination = previous.last()
        if (destination is Page.Weekend) {
            val remembered = sessionSelections[destination.race.season to destination.race.round] ?: Session.RACE
            if (selectedRace != destination.race || _session.value != remembered || (resultsJob?.isCancelled == true && _results.value.loading)) {
                selectedRace = destination.race
                _session.value = remembered
                requestResults(false, reset = true)
            }
        } else if (destination !is Page.DriverInfo) resultsJob?.cancel()
        _pages.value = previous
    }
    fun openCalendar() { push(Page.Calendar) }
    fun openRace(race: Race, initialSession: Session? = null, showResults: Boolean = false) {
        selectedRace = race
        _session.value = initialSession ?: sessionSelections[race.season to race.round] ?: Session.RACE
        sessionSelections[race.season to race.round] = _session.value
        push(Page.Weekend(race, showResults))
        requestResults(false, reset = true)
    }
    fun openDriver(driver: Driver, standing: Standing? = null, result: Classification? = null) { push(Page.DriverInfo(driver, standing, result, if (result != null) selectedRace?.season else _year.value)) }
    fun openTeam(standing: Standing) { push(Page.TeamInfo(standing)) }
    fun openCircuit(race: Race) { push(Page.CircuitInfo(race)) }
    fun openFeature(kind: FeatureKind, race: Race? = null, identity: String = "", constructor: Boolean = false, season: Int? = null) {
        push(Page.Feature(kind, race, identity, constructor, season))
    }
    fun selectSession(value: Session) {
        _session.value = value
        selectedRace?.let { sessionSelections[it.season to it.round] = value }
        requestResults(false, reset = true)
    }
    private fun requestResults(refresh: Boolean, reset: Boolean = false) {
        resultsJob?.cancel()
        val race = selectedRace ?: return
        val session = _session.value
        if (reset) _results.value = Resource()
        resultsJob = viewModelScope.launch { load(_results) { repository.results(race, session, refresh) } }
    }
    fun refresh() {
        if (_pages.value.last() is Page.Weekend) requestResults(true) else loadSeason(true)
    }
    fun setTheme(value: String) { viewModelScope.launch { runCatching { saveTheme(value) }.onFailure { if (it is CancellationException) throw it; _notice.value = "界面设置暂时无法保存。" } } }
    fun setZone(value: String) { viewModelScope.launch { runCatching { saveZone(value) }.onFailure { if (it is CancellationException) throw it; _notice.value = "时间设置暂时无法保存。" } } }
    fun dismissNotice() { _notice.value = null }
    fun clearCache() { viewModelScope.launch {
        try { repository.clearCache(); _notice.value = "公开数据缓存已清除。" }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { _notice.value = "缓存暂时无法清除。" }
    } }
}
