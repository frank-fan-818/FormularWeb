package com.formularone.nativeapp

import com.formularone.nativeapp.data.F1Mapper
import com.formularone.nativeapp.model.Session
import com.formularone.nativeapp.model.chooseFeaturedRace
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class F1MappingTest {
    private fun envelope(races: String, total: Int) = """{"MRData":{"total":"$total","RaceTable":{"Races":$races}}}"""
    private val race = """{"season":"2025","round":"1","raceName":"测试大奖赛","Circuit":{"circuitId":"test","circuitName":"测试赛道","Location":{"locality":"测试城市","country":"测试国家"}},"date":"2025-03-16","time":"04:00:00Z"}"""

    @Test fun `race start retains UTC and complete identity`() {
        val mapped = F1Mapper.races(envelope("[$race]", 1)).single()
        assertEquals(2025, mapped.season)
        assertEquals(1, mapped.round)
        assertEquals(Instant.parse("2025-03-16T04:00:00Z"), mapped.start)
        assertEquals("测试大奖赛", mapped.name)
    }

    @Test fun `unknown start time stays unknown`() {
        val mapped = F1Mapper.races(envelope("[${race.replace(",\"time\":\"04:00:00Z\"", "")}]", 1)).single()
        assertNull(mapped.start)
    }

    @Test fun `partial pagination is rejected instead of showing incomplete calendar`() {
        assertThrows(IllegalArgumentException::class.java) { F1Mapper.races(envelope("[$race]", 2)) }
    }

    @Test fun `duplicate rounds are rejected`() {
        assertThrows(IllegalArgumentException::class.java) { F1Mapper.races(envelope("[$race,$race]", 2)) }
    }

    @Test fun `missing official result position is not fabricated`() {
        val result = """{"number":"16","positionText":"R","points":"0","status":"Engine","Driver":{"driverId":"test","givenName":"Test","familyName":"Driver","code":"TST"},"Constructor":{"constructorId":"test","name":"Team"}}"""
        val payload = race.dropLast(1) + ",\"Results\":[$result]}"
        val mapped = F1Mapper.classification(envelope("[$payload]", 1), Session.RACE).single()
        assertEquals("R", mapped.position)
        assertEquals("Engine", mapped.timing)
        assertEquals("0", mapped.points)
    }

    @Test fun `featured race falls back to latest after season ends`() {
        val mapped = F1Mapper.races(envelope("[$race]", 1))
        assertEquals(1, chooseFeaturedRace(mapped, Instant.parse("2025-12-01T00:00:00Z"))?.round)
        assertNull(chooseFeaturedRace(emptyList(), Instant.EPOCH))
    }
}
