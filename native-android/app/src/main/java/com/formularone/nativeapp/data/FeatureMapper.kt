package com.formularone.nativeapp.data

import com.formularone.nativeapp.model.*
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI

internal fun JSONObject.text(key: String): String = optString(key, "").takeUnless { it == "null" }.orEmpty()
internal fun JSONObject.rows(key: String): List<JSONObject> = optJSONArray(key)?.objects().orEmpty()
internal fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
internal fun JSONObject.number(key: String): Double? = if (isNull(key)) null else optDouble(key, Double.NaN).takeIf { it.isFinite() }

object FeatureMapper {
    fun historyRaces(raw: String, identity: String, kind: String, season: Int?): List<HistoryRace> {
        val root = JSONObject(raw).getJSONObject("MRData"); val races = root.getJSONObject("RaceTable").getJSONArray("Races")
        val resultCount = races.objects().sumOf { it.optJSONArray("Results")?.length() ?: 1 }
        require(root.text("total").toInt() == resultCount) { "历史记录超过单次查询范围，请按赛季查询。" }
        return races.objects().map { row ->
            fun envelope(count: Int) = JSONObject().put("MRData", JSONObject().put("total", count).put("RaceTable", JSONObject().put("Races", JSONArray().put(row)))).toString()
            val race = F1Mapper.races(envelope(1)).single()
            require(season == null || race.season == season)
            if (kind == "circuits") require(race.circuitId == identity)
            val rows = row.optJSONArray("Results") ?: JSONArray()
            val results = if (rows.length() == 0) emptyList() else F1Mapper.classification(envelope(rows.length()), Session.RACE)
            if (kind == "drivers") require(results.all { it.driver.id == identity })
            if (kind == "constructors") require(results.all { it.constructorId == identity })
            HistoryRace(race, results)
        }.sortedWith(compareByDescending<HistoryRace> { it.race.season }.thenByDescending { it.race.round })
    }
    fun upgrades(json: String, year: Int, round: Int, published: Boolean): List<TextRecord> {
        val rows = JSONArray(json).objects()
        val artifact = if (published) rows.singleOrNull()?.getJSONObject("artifact") ?: return emptyList() else null
        if (artifact != null) require(artifact.getInt("season") == year && artifact.getInt("round") == round)
        val sourceRows = artifact?.rows("records") ?: rows
        val summaries = artifact?.rows("summaries").orEmpty().map { s ->
            TextRecord(s.text("team"), "申报升级 ${s.text("declaredUpgradeCount")} 项 · 强度指数 ${s.text("declaredUpgradeIntensity")}")
        }
        return summaries + sourceRows.map { row ->
            require(row.getInt("season") == year && row.getInt("round") == round)
            fun value(legacy: String, current: String) = row.text(if (published) current else legacy)
            TextRecord("${row.text("team")} · ${row.text("component").ifBlank { row.text("area") }}",
                listOf(value("primary_reason", "primaryReason"), row.text("description"), value("geometric_differences", "geometricDifferences")).filter { it.isNotBlank() }.joinToString("\n"),
                FeatureMapper.safeUrl(value("document_url", "documentUrl").ifBlank { artifact?.text("documentUrl").orEmpty() }, setOf("www.fia.com", "fia.com")) ?: "")
        }
    }

    fun weatherSummary(summary: JSONObject?): List<TextRecord> {
        if (summary == null) return emptyList()
        return listOf("气温 °C" to "airTempC", "赛道温度 °C" to "trackTempC", "湿度 %" to "humidityPct").map { (label, field) ->
            val stat = summary.optJSONObject(field)
            TextRecord(label, "平均 ${stat?.number("average") ?: "—"} · 最低 ${stat?.number("min") ?: "—"} · 最高 ${stat?.number("max") ?: "—"}")
        } + TextRecord("降雨与风", "降雨采样点 ${summary.text("rainPointCount").ifBlank { "—" }} · 最大风速 ${summary.number("maxWindSpeedMps") ?: "—"} m/s\n" + summary.rows("rainLapRanges").joinToString(" · ") { "L${it.text("startLap")}–${it.text("endLap")}" })
    }
    fun archive(json: String, kind: String, offset: Int): ArchivePage {
        val root = JSONObject(json).getJSONObject("MRData")
        val table = when (kind) { "drivers" -> "Driver"; "constructors" -> "Constructor"; "circuits" -> "Circuit"; else -> error("未知档案类别") }
        require(root.text("offset").toInt() == offset)
        val total = root.text("total").toInt(); require(total >= 0)
        val entries = root.getJSONObject("${table}Table").rows("${table}s").map { row ->
            val id = row.getString("${kind.removeSuffix("s")}Id")
            require(id.isNotBlank())
            ArchiveEntry(id, if (kind == "drivers") "${row.text("givenName")} ${row.text("familyName")}".trim() else row.text(if (kind == "circuits") "circuitName" else "name"),
                if (kind == "circuits") row.optJSONObject("Location")?.let { "${it.text("locality")} · ${it.text("country")}" }.orEmpty() else row.text("nationality"))
        }
        require(entries.map { it.id }.distinct().size == entries.size && offset + entries.size <= total && (entries.isNotEmpty() || offset >= total))
        return ArchivePage(entries, total, offset)
    }
    fun history(json: String, id: String, constructor: Boolean): CareerProfile? {
        val row = JSONArray(json).objects().singleOrNull() ?: return null
        require(row.text(if (constructor) "constructor_id" else "driver_id") == id)
        val career = row.optJSONObject("career_summary") ?: JSONObject()
        val facts = linkedMapOf("参赛" to "raceCount", "冠军" to "winCount", "领奖台" to "podiumCount", "杆位" to "poleCount", "世界冠军" to "championshipCount", "生涯积分" to "totalPoints")
            .mapNotNull { (label, key) -> career.number(key)?.takeIf { it >= 0 }?.let { label to it } }.toMap()
        val seasons = row.rows("seasons").map { s ->
            val year = s.text("season").toInt(); require(year >= 1950)
            HistorySeason(year, s.text("position").ifBlank { "—" }, s.text("points"), s.text("wins"), s.text("constructorName"))
        }.sortedByDescending { it.year }
        require(seasons.map { it.year }.distinct().size == seasons.size)
        return CareerProfile(if (constructor) row.text("name") else "${row.text("given_name")} ${row.text("family_name")}".trim(),
            row.text("nationality"), row.text("date_of_birth"), facts, seasons, career.text("participationNote"))
    }

    private fun checkContext(root: JSONObject, year: Int, round: Int, session: String) {
        require(root.text("season") == year.toString() && root.text("round") == round.toString() && root.text("session") == session) { "数据与当前场次不一致。" }
    }
    fun practice(json: String, year: Int, round: Int, session: String): List<Classification> {
        val root = JSONObject(json)
        checkContext(root, year, round, session)
        val classifications = root.rows("sessionResults").associateBy { it.text("driver") }
        val timed = classifications.values.filter { (it.number("position") ?: 0.0) > 0 && it.text("time").isNotBlank() }
        fun row(code: String, source: JSONObject?, team: String, position: String, time: String): Classification {
            val name = source?.text("fullName").orEmpty().ifBlank { code }
            val family = source?.text("lastName").orEmpty().ifBlank { name.substringAfterLast(' ') }
            val driver = Driver(source?.text("driverId").orEmpty().ifBlank { code }, name, family,
                code, source?.text("driverNumber").orEmpty(), "")
            return Classification(driver, "", team, position, time, "", "",
                source?.text("laps").orEmpty().ifBlank { "—" }, emptyList())
        }
        if (timed.isNotEmpty()) return timed.sortedBy { it.number("position") }.map {
            row(it.text("driver"), it, it.text("team"), it.text("position"), it.text("time"))
        }
        return root.rows("lapTimeSeries").mapNotNull { series ->
            val best = series.rows("laps").mapNotNull { it.number("lapTimeSeconds")?.takeIf { value -> value > 0 } }.minOrNull()
            val code = series.text("driver")
            if (best == null || code.isBlank()) null else Triple(code, series.text("team"), best)
        }.distinctBy { it.first }.sortedBy { it.third }.mapIndexed { index, (code, team, best) ->
            row(code, classifications[code], team, (index + 1).toString(),
                String.format(java.util.Locale.ROOT, "%.3f s", best))
        }
    }

    fun analysis(json: String, year: Int, round: Int, session: String): AnalysisData {
        val root = JSONObject(json); checkContext(root, year, round, session)
        val rows = root.rows("lapTimeSeries")
        fun series(field: String) = rows.map { driver ->
            ChartSeries(driver.text("driver"), driver.text("team"), driver.rows("laps").map { lap ->
                val x = lap.number("lapNumber") ?: error("无效圈数")
                require(x > 0)
                ChartPoint(x, lap.number(field)?.takeIf { it > 0 })
            }.sortedBy { it.x })
        }
        val stints = root.rows("tyreStrategies").flatMap { d -> d.rows("stints").map { s ->
            val start = s.getInt("startLap"); val end = s.getInt("endLap"); require(start > 0 && end >= start)
            TyreStint(d.text("driver"), s.text("compound"), start, end, if (s.isNull("freshTyre")) null else s.getBoolean("freshTyre"))
        } }
        val weatherRows = root.optJSONObject("weather")?.rows("points").orEmpty()
        val weather = listOf("气温 °C" to "airTempC", "赛道温度 °C" to "trackTempC", "湿度 %" to "humidityPct", "风速 m/s" to "windSpeedMps").map { (label, key) ->
            ChartSeries(label, "", weatherRows.mapNotNull { w -> w.number("timeSeconds")?.let { ChartPoint(it / 60.0, w.number(key)) } })
        }
        val messages = root.rows("trackStatusPeriods").map { t -> TextRecord("${t.text("label").ifBlank { t.text("type") }} · L${t.text("startLap")}–${t.text("endLap")}", t.text("message")) } + root.rows("raceControlMessages").map { m -> TextRecord("${m.text("time")} · ${m.text("flag").ifBlank { m.text("category") }}", "${m.text("lap").takeIf { it.isNotBlank() }?.let { "L$it · " }.orEmpty()}${m.text("message")}") }
        val strategy = root.optJSONObject("strategyAnalysis")?.let { s ->
            s.rows("pitStops").map { p -> TextRecord("${p.text("driver")} · L${p.text("pitLap")}", "${p.text("oldCompound")} → ${p.text("newCompound")}\n进站损失 ${p.text("pitDurationSeconds").ifBlank { "—" }} s · 前后节奏变化 ${p.text("paceDeltaSeconds").ifBlank { "—" }} s\n位置 ${p.text("positionBefore").ifBlank { "—" }} → ${p.text("positionAfter").ifBlank { "—" }}") } +
                s.rows("strategyBattles").map { b -> TextRecord("${b.text("driver")} / ${b.text("rival")} · ${b.text("type")}", b.text("summary")) }
        }.orEmpty()
        val qualifying = root.optJSONObject("qualifyingAnalysis")?.let { q ->
            q.rows("phaseResults").map { p ->
                val phases = p.optJSONObject("phases") ?: JSONObject()
                TextRecord("${p.text("position")} · ${p.text("driver")} · ${p.text("team")}", phases.keys().asSequence().sorted().joinToString("\n") { phase -> "$phase  ${phases.getJSONObject(phase).text("time").ifBlank { "—" }}" })
            } + q.rows("deletedLaps").map { p -> TextRecord("删除圈 · ${p.text("driver")} · L${p.text("lapNumber")}", p.text("reason")) } +
                q.rows("teamMateComparisons").map { p -> TextRecord("${p.text("team")} · ${p.text("driverA")} / ${p.text("driverB")}", "最快圈差 ${p.text("fastestLapDeltaSeconds").ifBlank { "—" }} s") }
        }.orEmpty()
        val fastest = root.optJSONObject("fastestLap")?.let { "${it.text("driver")} · ${it.text("lapTimeSeconds")} s · L${it.text("lapNumber")}" }.orEmpty()
        return AnalysisData(series("lapTimeSeconds"), series("position"), stints, weather, messages, strategy, qualifying, fastest, root.text("generatedAt"), weatherSummary(root.optJSONObject("weather")?.optJSONObject("summary")))
    }

    fun telemetry(json: String, year: Int, round: Int, session: String, field: String): List<ChartSeries> {
        require(field in setOf("speedKph", "throttlePct", "brake", "gear", "rpm", "drs", "timeSeconds"))
        val root = JSONObject(json); checkContext(root, year, round, session)
        return root.optJSONObject("telemetry")?.rows("drivers").orEmpty().map { driver ->
            val samples = driver.getJSONObject("samples")
            val x = samples.getJSONArray("distanceM"); val y = samples.optJSONArray(field) ?: JSONArray()
            require(x.length() == y.length())
            ChartSeries(driver.text("driver"), driver.text("team"), (0 until x.length()).map { i ->
                val distance = x.getDouble(i); require(distance.isFinite() && distance >= 0)
                val value = if (y.isNull(i)) null else if (field == "brake") { if (y.getBoolean(i)) 1.0 else 0.0 } else y.optDouble(i, Double.NaN).takeIf { it.isFinite() }
                ChartPoint(distance, value)
            })
        }
    }

    fun pits(json: String, year: Int): PitData {
        val root = JSONObject(json); require(root.text("season") == year.toString())
        fun duration(row: JSONObject, field: String) = row.text(field).takeIf { it.toDoubleOrNull()?.let { n -> n.isFinite() && n > 0 } == true }.orEmpty()
        val stops = if (root.has("records")) root.rows("records").map { p ->
            PitRecord(p.text("driver"), p.text("team"), p.text("lap"), duration(p, "laneDuration"), duration(p, "stopDuration"), p.text("laneSource"))
        } else root.rows("stops").map { p -> PitRecord(p.text("driver"), p.text("team"), p.text("lap"), "", duration(p, "duration"), p.text("notes")) }
        return PitData(root.rows("standings").map { PitStanding(it.text("rank"), it.text("team"), it.text("points")) }, stops,
            root.rows("seasonFastest").map { PitRecord(it.text("driver"), it.text("team"), "", "", duration(it, "duration"), it.text("event")) },
            root.optBoolean("stale"), root.optBoolean("partial"), root.text("updatedAt"), root.text("event"))
    }

    fun prediction(json: String, year: Int, round: Int): PredictionData? {
        val row = JSONArray(json).objects().singleOrNull() ?: return null
        require(row.getInt("season") == year && row.getInt("round") == round)
        val candidates = row.rows("candidates").map { p ->
            val probability = p.getDouble("probability"); require(probability.isFinite() && probability in 0.0..1.0)
            val rank = p.getInt("rank"); require(rank > 0)
            Prediction(p.text("driver_id"), p.text("constructor_id"), rank, probability,
                p.rows("factors").map { TextRecord(it.text("feature"), it.number("contribution")?.toString() ?: "—") })
        }.sortedBy { it.rank }
        return PredictionData(candidates, row.text("generated_at"), row.text("phase"), row.text("model_version"))
    }

    fun safeUrl(value: String, hosts: Set<String>? = null): String? = runCatching {
        val uri = URI(value)
        require(uri.scheme == "https" && uri.userInfo == null && uri.port in listOf(-1, 443) && !uri.host.isNullOrBlank())
        require(hosts == null || uri.host.lowercase() in hosts)
        value
    }.getOrNull()
}
