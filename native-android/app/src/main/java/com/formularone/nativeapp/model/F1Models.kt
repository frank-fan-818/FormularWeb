package com.formularone.nativeapp.model

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

enum class Session(val endpoint: String, val listKey: String, val label: String) {
    RACE("results", "Results", "正赛"),
    QUALIFYING("qualifying", "QualifyingResults", "排位赛"),
    SPRINT("sprint", "SprintResults", "冲刺赛"),
    PRACTICE1("", "Results", "一练"),
    PRACTICE2("", "Results", "二练"),
    PRACTICE3("", "Results", "三练"),
    SPRINT_QUALIFYING("", "QualifyingResults", "冲刺排位"),
    ;
    val code: String get() = when (this) {
        RACE -> "R"; QUALIFYING -> "Q"; SPRINT -> "S"
        PRACTICE1 -> "FP1"; PRACTICE2 -> "FP2"; PRACTICE3 -> "FP3"; SPRINT_QUALIFYING -> "SQ"
    }
    val qualifying: Boolean get() = this == QUALIFYING || this == SPRINT_QUALIFYING
}

data class WeekendSession(val label: String, val date: LocalDate, val start: Instant?, val classification: Session?)

data class Race(
    val season: Int, val round: Int, val name: String,
    val circuitId: String, val circuit: String, val locality: String, val country: String,
    val date: LocalDate, val start: Instant?, val sessions: List<WeekendSession>,
)

data class Driver(val id: String, val name: String, val familyName: String, val code: String, val number: String, val nationality: String)

data class Classification(
    val driver: Driver, val constructorId: String, val constructor: String,
    val position: String, val timing: String, val points: String, val status: String,
    val laps: String, val qualifyingTimes: List<Pair<String, String>>,
)

data class Standing(
    val id: String, val name: String, val secondary: String,
    val constructorId: String, val position: String, val points: String,
    val wins: String, val driver: Driver? = null, val constructorIds: List<String> = listOf(constructorId),
)

fun chooseFeaturedRace(races: List<Race>, now: Instant): Race? {
    val ordered = races.sortedBy { it.round }
    return ordered.firstOrNull {
        it.date.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC).isAfter(now)
    } ?: ordered.lastOrNull()
}
