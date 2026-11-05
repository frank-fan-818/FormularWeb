package com.formularone.nativeapp.data

import com.formularone.nativeapp.model.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant

class FeatureRepository(directory: File, val auth: NativeAuth, private val http: NativeHttp = NativeHttp()) {
    private val public = PublicEndpointStore(File(directory, "features-public-v1"), fetch = { path ->
        when {
            path.startsWith("/rest/v1/") -> http.backend(path)
            path.startsWith("/ergast/f1/") -> {
                jolpicaLock.withLock { delay(350) }
                http.request("https://api.jolpi.ca", path, maxBytes = 4_000_000, readTimeoutMs = 10_000, connectTimeoutMs = 5_000)
            }
            path.startsWith("/api/pit-stops") -> http.request(SITE_ORIGIN, path, maxBytes = 4_000_000, readTimeoutMs = 10_000, connectTimeoutMs = 5_000)
            else -> http.request(SITE_ORIGIN, path, maxBytes = 4_000_000)
        }
    })
    private val jolpicaLock = Mutex()
    suspend fun clearCache() { public.clear() }
    private fun id(value: String) = value.also { require(Regex("[a-zA-Z0-9_-]{1,80}").matches(it)) }
    private fun year(value: Int) = value.also { require(it in 1950..2100) }
    suspend fun archive(kind: String, offset: Int, refresh: Boolean = false): Loaded<ArchivePage> {
        require(kind in listOf("drivers", "constructors", "circuits") && offset >= 0)
        return public.load("/ergast/f1/$kind.json?limit=100&offset=$offset", refresh) { FeatureMapper.archive(it, kind, offset) }
    }
    suspend fun history(identity: String, constructor: Boolean, refresh: Boolean = false): Loaded<CareerProfile?> {
        val key = if (constructor) "constructor" else "driver"
        val summary = try { public.load("/rest/v1/${key}_history_summary?select=*&${key}_id=eq.${id(identity)}&limit=1", refresh) { FeatureMapper.history(it, identity, constructor) } }
        catch (error: CancellationException) { throw error }
        catch (_: Exception) { null }
        if (summary?.data?.let { it.facts.isNotEmpty() || it.seasons.isNotEmpty() || it.note.isNotBlank() } == true) return summary

        val kind = if (constructor) "constructors" else "drivers"
        val rows = mutableListOf<Pair<Int, JSONObject>>()
        var offset = 0
        var stale = false
        do {
            val page = public.load("/ergast/f1/$kind/${id(identity)}/results.json?limit=100&offset=$offset", refresh) {
                val root = JSONObject(it).getJSONObject("MRData")
                require(root.getInt("offset") == offset)
                root.getInt("total") to root.getJSONObject("RaceTable").rows("Races").flatMap { race ->
                    race.rows("Results").map { row -> race.getInt("season") to row }
                }
            }
            stale = stale || page.stale
            val (total, entries) = page.data
            require(total in 0..10000 && offset + entries.size <= total)
            require(entries.isNotEmpty() || offset == total)
            rows.addAll(entries)
            offset += entries.size
        } while (offset < total)
        val first = rows.firstOrNull()?.second ?: return Loaded(summary?.data, Instant.now(), stale)
        val person = first.getJSONObject(if (constructor) "Constructor" else "Driver")
        require(rows.all { (_, row) ->
            row.getJSONObject(if (constructor) "Constructor" else "Driver").text(if (constructor) "constructorId" else "driverId") == identity
        })
        val seasons = rows.groupBy { it.first }.toSortedMap(reverseOrder()).map { (season, entries) ->
            HistorySeason(season, "—", "—", entries.count { it.second.text("position") == "1" }.toString(), "")
        }
        val facts = linkedMapOf(
            "正赛成绩条目" to rows.size.toDouble(),
            "正赛胜场" to rows.count { it.second.text("position") == "1" }.toDouble(),
            "正赛领奖台" to rows.count { (it.second.text("position").toIntOrNull() ?: 0) in 1..3 }.toDouble(),
        )
        return Loaded(CareerProfile(
            if (constructor) person.text("name") else "${person.text("givenName")} ${person.text("familyName")}".trim(),
            person.text("nationality"), person.text("dateOfBirth"), facts, seasons,
            "根据 Jolpica 正赛成绩汇总。赛季排名、积分及冲刺成绩以官方积分榜为准。"
        ), Instant.now(), stale)
    }
    suspend fun historyRaces(identity: String, kind: String, season: Int?, refresh: Boolean = false): Loaded<List<HistoryRace>> {
        return public.load(historyResultsPath(identity, kind, season), refresh) { FeatureMapper.historyRaces(it, identity, kind, season) }
    }
    suspend fun news(source: NewsSource, refresh: Boolean = false) = public.load("/news-feed/${source.slug}", refresh) { NewsMapper.parse(it, source) }
    suspend fun pits(season: Int, round: Int?, award: Boolean, refresh: Boolean = false): Loaded<PitData> {
        val path = "/api/pit-stops?kind=${if (award) "award" else "race"}&season=${year(season)}" +
            round?.also { require(it > 0) }?.let { "&round=$it" }.orEmpty()
        try {
            return public.load(path, refresh) { FeatureMapper.pits(it, season) }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: java.io.IOException) {
            if (award || round == null) throw error
        }

        val stops = mutableListOf<PitRecord>()
        val identities = mutableSetOf<Pair<String, Int>>()
        var stale = false
        var total: Int
        do {
            val offset = stops.size
            val page = public.load("/ergast/f1/$season/$round/pitstops.json?limit=100&offset=$offset", refresh) { raw ->
                val root = JSONObject(raw).getJSONObject("MRData")
                require(root.getInt("offset") == offset)
                val race = root.getJSONObject("RaceTable").rows("Races").singleOrNull()
                if (race != null) require(race.getInt("season") == season && race.getInt("round") == round)
                root.getInt("total") to race?.rows("PitStops").orEmpty()
            }
            total = page.data.first
            stale = stale || page.stale
            val entries = page.data.second
            require(total in 0..2000 && offset + entries.size <= total && (entries.isNotEmpty() || offset == total))
            entries.forEach { row ->
                val driver = row.text("driverId")
                val lap = row.getInt("lap")
                val stop = row.getInt("stop")
                val duration = row.text("duration")
                require(driver.isNotBlank() && lap > 0 && stop > 0 && duration.toDoubleOrNull()?.let { it.isFinite() && it > 0 } == true)
                require(identities.add(driver to stop))
                stops += PitRecord(driver.replace('_', ' '), "", lap.toString(), duration, "", "Jolpica")
            }
        } while (stops.size < total)
        return Loaded(PitData(emptyList(), stops, emptyList(), stale, true, "", ""), Instant.now(), stale)
    }

    suspend fun availableSessions(race: Race): Set<Session> =
        public.load("/rest/v1/race_session_results?select=session&season=eq.${race.season}&round=eq.${race.round}") { raw ->
            JSONArray(raw).objects().mapNotNull { row ->
                val code = row.text("session")
                Session.entries.firstOrNull { it.code == if (code == "SS") "SQ" else code }
            }.toSet()
        }.data

    suspend fun memberPractice(race: Race, session: Session): List<Classification> = auth.member { token ->
        require(session in listOf(Session.PRACTICE1, Session.PRACTICE2, Session.PRACTICE3))
        val raw = memberSnapshot(race, session.code, token)
        FeatureMapper.practice(raw, race.season, race.round, session.code)
    }

    suspend fun sessionResults(race: Race, session: Session, refresh: Boolean = false): Loaded<List<Classification>> {
        val code = if (session == Session.SPRINT_QUALIFYING && race.season == 2023) "SS" else session.code
        suspend fun request(code: String): Loaded<List<Classification>> = public.load("/rest/v1/race_session_results?select=season,round,session,source,payload&season=eq.${race.season}&round=eq.${race.round}&session=eq.$code", refresh) { raw ->
            val candidates = JSONArray(raw).objects().mapNotNull { row ->
                require(row.getInt("season") == race.season && row.getInt("round") == race.round && row.text("session") == code)
                val payload = row.getJSONObject("payload")
                require(payload.text("season") == race.season.toString() && payload.text("round") == race.round.toString())
                val rows = payload.optJSONArray(session.listKey) ?: if (session == Session.SPRINT) payload.optJSONArray("Results") else null
                if (rows == null || rows.length() == 0) return@mapNotNull null
                payload.put(session.listKey, rows)
                val wrapped = JSONObject().put("MRData", JSONObject().put("total", rows.length()).put("RaceTable", JSONObject().put("Races", JSONArray().put(payload)))).toString()
                F1Mapper.classification(wrapped, session) to (if (row.text("source") == "jolpica") 1 else 0)
            }.sortedWith(compareByDescending<Pair<List<Classification>, Int>> { it.first.size }.thenByDescending { it.second })
            candidates.firstOrNull()?.first.orEmpty()
        }
        val result = request(code)
        return if (session == Session.SPRINT_QUALIFYING && result.data.isEmpty()) request(if (code == "SQ") "SS" else "SQ") else result
    }
    suspend fun upgrades(race: Race, refresh: Boolean = false): Loaded<List<TextRecord>> {
        val snapshot = try {
            public.load("/rest/v1/fia_race_upgrade_snapshots?select=artifact&season=eq.${race.season}&round=eq.${race.round}&limit=1", refresh) { FeatureMapper.upgrades(it, race.season, race.round, true) }
        } catch (cancelled: CancellationException) { throw cancelled } catch (_: Exception) { null }
        if (snapshot?.data?.isNotEmpty() == true) return snapshot
        return public.load("/rest/v1/fia_car_upgrades?select=season,round,team,area,component,primary_reason,description,geometric_differences,document_url&season=eq.${race.season}&round=eq.${race.round}&order=team&limit=1000", refresh) { FeatureMapper.upgrades(it, race.season, race.round, false) }
    }
    suspend fun weather(race: Race): List<TextRecord> = auth.member { token ->
        val root = JSONObject(http.request(SITE_ORIGIN, "/api/race-weather?season=${race.season}&round=${race.round}", headers = mapOf("Authorization" to "Bearer $token")))
        require(root.text("season") == race.season.toString() && root.text("round") == race.round.toString())
        FeatureMapper.weatherSummary(root.optJSONObject("summary"))
    }
    private suspend fun memberSnapshot(race: Race, code: String, token: String): String {
        return try { http.backend(privateSnapshotPath(race.season, race.round, code), token = token) }
            catch (error: HttpStatusException) {
                if (error.status !in listOf(400, 404)) throw error
                val rows = JSONArray(http.backend("/rest/v1/fastf1_session_analytics?select=payload&season=eq.${race.season}&round=eq.${race.round}&session=eq.$code&limit=1", token = token))
                if (rows.length() == 0) throw NoPublishedDataException()
                rows.getJSONObject(0).getJSONObject("payload").toString()
            }
    }

    suspend fun analysis(race: Race, session: Session): AnalysisData {
        val code = if (session == Session.SPRINT_QUALIFYING && race.season == 2023) "SS" else session.code
        return auth.member { token ->
            val raw = memberSnapshot(race, code, token)
            FeatureMapper.analysis(raw, race.season, race.round, code)
        }
    }
    suspend fun telemetry(race: Race, session: Session): String {
        val code = if (session == Session.SPRINT_QUALIFYING && race.season == 2023) "SS" else session.code
        return auth.member { token -> http.backend(privateSnapshotPath(race.season, race.round, code, true), token = token).also { FeatureMapper.telemetry(it, race.season, race.round, code, "speedKph") } }
    }
    suspend fun prediction(race: Race): PredictionData? = auth.member { token ->
        FeatureMapper.prediction(http.backend("/rest/v1/race_prediction_current?select=*&season=eq.${race.season}&round=eq.${race.round}&limit=1", token = token), race.season, race.round)
    }
}
class NoPublishedDataException : Exception()
