package com.formularone.nativeapp

import com.formularone.nativeapp.data.*
import com.formularone.nativeapp.model.*
import org.junit.Assert.*
import org.junit.Test

class FeatureSnapshotTest {
    private fun fixture(name: String) = javaClass.getResource("/fixtures/features/$name")!!.readText()
    @Test fun `actual career summary maps all seasons`() {
        val profile = FeatureMapper.history(fixture("history.json"), "max_verstappen", false)!!
        assertTrue(profile.facts.getValue("参赛") > 0)
        assertTrue(profile.seasons.size >= 10)
    }
    @Test fun `actual driver archive exposes pagination instead of truncating history`() {
        val page = FeatureMapper.archive(fixture("archive-drivers.json"), "drivers", 0)
        assertEquals(100, page.entries.size)
        assertTrue(page.total > page.entries.size)
        assertTrue(page.entries.all { it.id.isNotBlank() && it.name.isNotBlank() })
    }
    @Test fun `actual circuit archive retains identities`() {
        val page = FeatureMapper.archive(fixture("archive-circuits.json"), "circuits", 0)
        assertTrue(page.entries.isNotEmpty())
        assertTrue(page.entries.any { it.id == "monza" })
    }
    @Test fun `actual RSS and Atom sources produce trusted native news rows`() {
        NewsSource.entries.forEach { source ->
            val rows = NewsMapper.parse(fixture("news-${source.slug}.xml"), source)
            assertEquals(source.name, 2, rows.size)
            assertTrue(rows.all { FeatureMapper.safeUrl(it.url, source.hosts) != null })
        }
    }
    @Test fun `news rejects entity injection and arbitrary destinations`() {
        assertThrows(IllegalArgumentException::class.java) { NewsMapper.parse("<!DOCTYPE rss [<!ENTITY x SYSTEM 'file:///secret'>]><rss/>", NewsSource.FIA) }
        assertTrue(NewsMapper.parse("<rss><channel><item><title>Test</title><link>javascript:alert(1)</link></item></channel></rss>", NewsSource.FIA).isEmpty())
        assertNull(FeatureMapper.safeUrl("https://www.fia.com@evil.example/path", NewsSource.FIA.hosts))
    }
    @Test fun `actual DHL award preserves standings and fastest records`() {
        val data = FeatureMapper.pits(fixture("pit.json"), 2025)
        assertTrue(data.standings.isNotEmpty())
        assertTrue(data.fastest.all { it.stationary.toDouble() > 0 && it.lane.isEmpty() })
    }
    @Test fun `actual FIA rows retain component descriptions and context`() {
        val rows = FeatureMapper.upgrades(fixture("upgrades.json"), 2025, 1, false)
        assertEquals(2, rows.size)
        assertTrue(rows.all { it.title.isNotBlank() && it.detail.isNotBlank() })
        assertThrows(IllegalArgumentException::class.java) { FeatureMapper.upgrades(fixture("upgrades.json"), 2025, 2, false) }
    }
    @Test fun `actual circuit history maps all 76 published races`() {
        val rows = FeatureMapper.historyRaces(fixture("circuit-history.json"), "monza", "circuits", null)
        assertEquals(76, rows.size)
        assertTrue(rows.all { it.race.circuitId == "monza" })
    }
    @Test fun `actual driver season results preserve all 24 races`() {
        val rows = FeatureMapper.historyRaces(fixture("driver-season.json"), "max_verstappen", "drivers", 2025)
        assertEquals(24, rows.size)
        assertTrue(rows.all { it.results.single().driver.id == "max_verstappen" })
    }
    @Test fun `actual constructor season keeps both drivers in each race`() {
        val rows = FeatureMapper.historyRaces(fixture("constructor-season.json"), "mercedes", "constructors", 2025)
        assertEquals(48, rows.sumOf { it.results.size })
    }
}
