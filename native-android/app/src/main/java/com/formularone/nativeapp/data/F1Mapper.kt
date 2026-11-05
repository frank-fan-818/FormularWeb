package com.formularone.nativeapp.data

import com.formularone.nativeapp.model.Classification
import com.formularone.nativeapp.model.Driver
import com.formularone.nativeapp.model.Race
import com.formularone.nativeapp.model.Session
import com.formularone.nativeapp.model.Standing
import com.formularone.nativeapp.model.WeekendSession
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate

object F1Mapper {
    private fun JSONObject.text(key: String) = optString(key, "").takeUnless { it == "null" }.orEmpty()
    private fun JSONArray.rows() = (0 until length()).map { getJSONObject(it) }
    private fun root(json: String) = JSONObject(json).getJSONObject("MRData")
    private fun complete(root: JSONObject, count: Int) {
        require(root.text("total").toIntOrNull() == count) { "赛事列表不完整，请稍后重试。" }
    }
    private fun start(row: JSONObject): Instant? = row.text("time").takeIf { it.isNotBlank() }
        ?.let { Instant.parse("${row.getString("date")}T$it") }

    fun races(json: String): List<Race> {
        val root = root(json)
        val rows = root.getJSONObject("RaceTable").getJSONArray("Races").rows()
        complete(root, rows.size)
        val races = rows.map { row ->
            val circuit = row.getJSONObject("Circuit")
            val location = circuit.getJSONObject("Location")
            val season = row.getString("season").toInt()
            val round = row.getString("round").toInt()
            require(season >= 1950 && round > 0)
            val date = LocalDate.parse(row.getString("date"))
            val sessions = buildList {
                listOf("FirstPractice" to "一练", "SecondPractice" to "二练", "ThirdPractice" to "三练",
                    "SprintQualifying" to "冲刺排位", "SprintShootout" to "冲刺排位",
                    "Sprint" to "冲刺赛", "Qualifying" to "排位赛").forEach { (key, label) ->
                    row.optJSONObject(key)?.let { session ->
                        val type = when (key) {
                            "Sprint" -> Session.SPRINT; "Qualifying" -> Session.QUALIFYING
                            "FirstPractice" -> Session.PRACTICE1; "SecondPractice" -> Session.PRACTICE2
                            "ThirdPractice" -> Session.PRACTICE3; else -> Session.SPRINT_QUALIFYING
                        }
                        add(WeekendSession(label, LocalDate.parse(session.getString("date")), start(session), type))
                    }
                }
                add(WeekendSession("正赛", date, start(row), Session.RACE))
            }.distinctBy { it.label }.sortedWith(compareBy({ it.date }, { it.start }))
            Race(season, round, row.getString("raceName"), circuit.getString("circuitId"), circuit.getString("circuitName"),
                location.text("locality"), location.text("country"), date, start(row), sessions)
        }
        require(races.map { it.season to it.round }.distinct().size == races.size) { "赛事标识重复。" }
        return races.sortedBy { it.round }
    }

    private fun driver(row: JSONObject): Driver {
        val id = row.getString("driverId")
        require(id.isNotBlank())
        val family = row.getString("familyName")
        return Driver(id, "${row.text("givenName")} $family".trim(), family, row.text("code"), row.text("permanentNumber"), row.text("nationality"))
    }

    fun classification(json: String, session: Session): List<Classification> {
        val root = root(json)
        val races = root.getJSONObject("RaceTable").getJSONArray("Races")
        require(races.length() <= 1)
        val rows = if (races.length() == 0) emptyList() else races.getJSONObject(0).getJSONArray(session.listKey).rows()
        complete(root, rows.size)
        val mapped = rows.map { row ->
            val constructor = row.getJSONObject("Constructor")
            val status = row.text("status")
            val qualifying = listOf("Q1", "Q2", "Q3").mapNotNull { key -> row.text(key).takeIf { it.isNotBlank() }?.let { key to it } }
            val timing = if (session.qualifying) qualifying.lastOrNull()?.second ?: "—"
                else row.optJSONObject("Time")?.text("time")?.takeIf { it.isNotBlank() } ?: status.ifBlank { "—" }
            Classification(driver(row.getJSONObject("Driver")), constructor.getString("constructorId"), constructor.getString("name"),
                row.text("position").ifBlank { row.text("positionText").ifBlank { "—" } }, timing,
                row.text("points").ifBlank { "—" }, status, row.text("laps").ifBlank { "—" }, qualifying)
        }
        require(mapped.map { it.driver.id }.distinct().size == mapped.size) { "成绩存在重复车手。" }
        return mapped
    }

    fun standings(json: String, constructors: Boolean): List<Standing> {
        val root = root(json)
        val lists = root.getJSONObject("StandingsTable").getJSONArray("StandingsLists")
        if (lists.length() == 0) { complete(root, 0); return emptyList() }
        require(lists.length() == 1)
        val key = if (constructors) "ConstructorStandings" else "DriverStandings"
        val mapped = lists.getJSONObject(0).getJSONArray(key).rows().map { row ->
            val driver = if (constructors) null else driver(row.getJSONObject("Driver"))
            val affiliations = if (constructors) listOf(row.getJSONObject("Constructor")) else row.getJSONArray("Constructors").rows()
            require(affiliations.isNotEmpty())
            val team = affiliations.first()
            Standing(driver?.id ?: team.getString("constructorId"), driver?.name ?: team.getString("name"),
                if (driver != null) affiliations.joinToString(" / ") { it.getString("name") } else team.text("nationality"), team.getString("constructorId"),
                row.getString("position"), row.getString("points"), row.getString("wins"), driver,
                affiliations.map { it.getString("constructorId") }.distinct())
        }
        complete(root, mapped.size)
        require(mapped.map { it.id }.distinct().size == mapped.size) { "积分榜存在重复条目。" }
        return mapped
    }
}
