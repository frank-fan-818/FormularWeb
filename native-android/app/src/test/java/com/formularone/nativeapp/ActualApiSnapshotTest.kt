package com.formularone.nativeapp

import com.formularone.nativeapp.data.F1Mapper
import com.formularone.nativeapp.model.Session
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ActualApiSnapshotTest {
    private fun fixture(name: String) = checkNotNull(javaClass.getResource("/fixtures/$name")).readText()

    @Test fun `public calendar and classification snapshots decode fully`() {
        assertEquals(24, F1Mapper.races(fixture("2025-season.json")).size)
        assertEquals(20, F1Mapper.classification(fixture("2025-italy-results.json"), Session.RACE).size)
        val qualifying = F1Mapper.classification(fixture("2025-italy-qualifying.json"), Session.QUALIFYING)
        assertEquals(20, qualifying.size)
        assertTrue(qualifying.all { it.timing != "—" })
    }

    @Test fun `public standings snapshots decode fully`() {
        assertEquals(21, F1Mapper.standings(fixture("2025-driver-standings.json"), false).size)
        assertEquals(10, F1Mapper.standings(fixture("2025-constructor-standings.json"), true).size)
    }

    @Test fun `mid season transfer retains both constructor names`() {
        val lawson = F1Mapper.standings(fixture("2025-driver-standings.json"), false).single { it.id == "lawson" }
        assertTrue(lawson.secondary.contains("Red Bull"))
        assertTrue(lawson.secondary.contains("RB F1 Team"))
        assertEquals(setOf("red_bull", "rb"), lawson.constructorIds.toSet())
    }

    @Test fun `partial standings are rejected instead of presenting a full table`() {
        val json = JSONObject(fixture("2025-driver-standings.json"))
        val rows = json.getJSONObject("MRData").getJSONObject("StandingsTable").getJSONArray("StandingsLists")
            .getJSONObject(0).getJSONArray("DriverStandings")
        rows.remove(rows.length() - 1)
        assertThrows(IllegalArgumentException::class.java) { F1Mapper.standings(json.toString(), false) }
    }
}
