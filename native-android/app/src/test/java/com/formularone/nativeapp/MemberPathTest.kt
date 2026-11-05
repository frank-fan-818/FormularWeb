package com.formularone.nativeapp

import com.formularone.nativeapp.data.privateSnapshotPath
import com.formularone.nativeapp.data.historyResultsPath
import org.junit.Assert.*
import org.junit.Test

class MemberPathTest {
    @Test fun `private storage matches the website authenticated route`() {
        assertEquals("/storage/v1/object/authenticated/fastf1-private/2025/1/R.json", privateSnapshotPath(2025, 1, "R"))
        assertEquals("/storage/v1/object/authenticated/fastf1-private/2023/4/SS-telemetry.json", privateSnapshotPath(2023, 4, "SS", true))
    }
    @Test fun `private path rejects unknown session and path traversal`() {
        assertThrows(IllegalArgumentException::class.java) { privateSnapshotPath(2025, 1, "../../other") }
        assertThrows(IllegalArgumentException::class.java) { privateSnapshotPath(2025, 0, "R") }
    }
    @Test fun `circuit history requests races instead of circuit metadata`() {
        assertEquals("/ergast/f1/circuits/monza/races.json?limit=100", historyResultsPath("monza", "circuits", null))
    }
}
