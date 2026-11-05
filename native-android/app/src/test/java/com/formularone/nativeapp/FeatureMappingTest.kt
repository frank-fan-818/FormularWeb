package com.formularone.nativeapp

import com.formularone.nativeapp.data.FeatureMapper
import com.formularone.nativeapp.model.Session
import org.junit.Assert.*
import org.junit.Test

class FeatureMappingTest {
    @org.junit.Test
    fun practiceFallbackRanksOnlyValidTimedLaps() {
        val data = """{"season":"2025","round":"2","session":"FP1","lapTimeSeries":[
            {"driver":"AAA","team":"A","laps":[{"lapTimeSeconds":92.2},{"lapTimeSeconds":91.2}]},
            {"driver":"BBB","team":"B","laps":[{"lapTimeSeconds":90.1}]},
            {"driver":"CCC","team":"C","laps":[{"lapTimeSeconds":0}]}
        ]}"""
        val results = com.formularone.nativeapp.data.FeatureMapper.practice(data, 2025, 2, "FP1")
        org.junit.Assert.assertEquals(listOf("BBB", "AAA"), results.map { it.driver.code })
        org.junit.Assert.assertEquals("90.100 s", results.first().timing)
    }

    @Test fun `history keeps official points and every season`() {
        val profile = FeatureMapper.history("""[{"driver_id":"test","given_name":"Test","family_name":"Driver","nationality":"British","career_summary":{"raceCount":42,"winCount":3,"poleCount":2,"podiumCount":10,"championshipCount":1,"totalPoints":99.5},"seasons":[{"season":"2024","position":"2","points":70.5,"wins":2,"constructorName":"Team A / Team B"},{"season":"2025","position":"1","points":29,"wins":1}]}]""", "test", false)!!
        assertEquals(99.5, profile.facts.getValue("生涯积分"), 0.0)
        assertEquals(listOf(2025, 2024), profile.seasons.map { it.year })
        assertEquals("Team A / Team B", profile.seasons.last().team)
    }
    @Test(expected = IllegalArgumentException::class) fun `wrong profile identity is rejected`() {
        FeatureMapper.history("""[{"driver_id":"other"}]""", "test", false)
    }
    @Test fun `private analysis validates context and preserves missing laps`() {
        val json = """{"season":"2025","round":"1","session":"R","lapTimeSeries":[{"driver":"AAA","team":"Team","laps":[{"lapNumber":1,"lapTimeSeconds":91,"position":2,"compound":"SOFT"},{"lapNumber":3,"lapTimeSeconds":89,"position":1,"compound":"MEDIUM"}]}],"tyreStrategies":[],"raceControlMessages":[]}"""
        val analysis = FeatureMapper.analysis(json, 2025, 1, "R")
        assertEquals(listOf(1.0, 3.0), analysis.laps.single().points.map { it.x })
        assertEquals(2.0, analysis.positions.single().points.first().y!!, 0.0)
        assertThrows(IllegalArgumentException::class.java) { FeatureMapper.analysis(json, 2025, 2, "R") }
    }
    @Test fun `pit lane and stationary duration stay distinct`() {
        val data = FeatureMapper.pits("""{"season":"2025","records":[{"driver":"AAA","lap":4,"stop":1,"laneDuration":"23.50","stopDuration":"2.10","team":"Team"}]}""", 2025)
        assertEquals("23.50", data.stops.single().lane)
        assertEquals("2.10", data.stops.single().stationary)
    }
    @Test fun `telemetry does not turn unknown speed into zero`() {
        val json = """{"season":"2025","round":"1","session":"Q","telemetry":{"drivers":[{"driver":"AAA","team":"Team","samples":{"distanceM":[0,10,20],"speedKph":[100,null,120],"throttlePct":[80,90,100],"brake":[false,true,false],"gear":[2,3,3],"rpm":[9000,10000,11000]}}]}}"""
        val series = FeatureMapper.telemetry(json, 2025, 1, "Q", "speedKph").single()
        assertNull(series.points[1].y)
        assertEquals(20.0, series.points.last().x, 0.0)
    }
    @Test fun `practice and sprint qualifying have distinct result keys`() {
        assertEquals("FP1", Session.PRACTICE1.code)
        assertEquals("QualifyingResults", Session.SPRINT_QUALIFYING.listKey)
    }
}
