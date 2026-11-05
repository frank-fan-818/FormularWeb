package com.formularone.nativeapp.model

data class HistorySeason(val year: Int, val position: String, val points: String, val wins: String, val team: String)
data class CareerProfile(val name: String, val nationality: String, val birth: String, val facts: Map<String, Double>, val seasons: List<HistorySeason>, val note: String)
data class HistoryRace(val race: Race, val results: List<Classification>)
data class ArchiveEntry(val id: String, val name: String, val detail: String)
data class ArchivePage(val entries: List<ArchiveEntry>, val total: Int, val offset: Int)
data class NewsItem(val id: String, val title: String, val summary: String, val url: String, val published: String)
enum class NewsSource(val label: String, val slug: String, val hosts: Set<String>) {
    MOTORSPORT("Motorsport", "motorsport", setOf("www.motorsport.com", "motorsport.com")),
    FIA("FIA", "fia", setOf("www.fia.com", "fia.com")),
    REDDIT("Reddit", "reddit", setOf("www.reddit.com", "reddit.com"))
}
data class PitStanding(val rank: String, val team: String, val points: String)
data class PitRecord(val driver: String, val team: String, val lap: String, val lane: String, val stationary: String, val note: String)
data class PitData(val standings: List<PitStanding>, val stops: List<PitRecord>, val fastest: List<PitRecord>, val stale: Boolean, val partial: Boolean, val updatedAt: String, val event: String)
data class ChartPoint(val x: Double, val y: Double?)
data class ChartSeries(val name: String, val team: String, val points: List<ChartPoint>)
data class TyreStint(val driver: String, val compound: String, val start: Int, val end: Int, val fresh: Boolean?)
data class TextRecord(val title: String, val detail: String, val url: String = "")
data class AnalysisData(val laps: List<ChartSeries>, val positions: List<ChartSeries>, val stints: List<TyreStint>, val weather: List<ChartSeries>, val messages: List<TextRecord>, val strategy: List<TextRecord>, val qualifying: List<TextRecord>, val fastest: String, val generatedAt: String, val weatherSummary: List<TextRecord> = emptyList())
data class Prediction(val driver: String, val team: String, val rank: Int, val probability: Double, val factors: List<TextRecord>)
data class PredictionData(val candidates: List<Prediction>, val generatedAt: String, val phase: String, val version: String)
