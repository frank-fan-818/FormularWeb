package com.formularone.nativeapp

import androidx.lifecycle.ViewModelStore
import com.formularone.nativeapp.data.*
import com.formularone.nativeapp.model.*
import com.formularone.nativeapp.ui.PitwallViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.*
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class NativePreferencesTest {
    @Test fun `stored season is restored before fetching data and new selection is saved`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        val store = ViewModelStore()
        try {
            val requests = mutableListOf<Int>(); var saved = 0
            val repository = object : F1Repository {
                override suspend fun races(year: Int, refresh: Boolean): Loaded<List<Race>> { requests += year; return Loaded(emptyList(), Instant.EPOCH) }
                override suspend fun results(race: Race, session: Session, refresh: Boolean) = Loaded(emptyList<Classification>(), Instant.EPOCH)
                override suspend fun standings(year: Int, constructors: Boolean, refresh: Boolean) = Loaded(emptyList<Standing>(), Instant.EPOCH)
            }
            val vm = PitwallViewModel(repository, flowOf(AppSettings(season = 2024)), {}, {}, { saved = it })
            store.put("test", vm)
            assertEquals(listOf(2024), requests)
            vm.selectYear(2025); advanceUntilIdle()
            assertEquals(2025, saved)
            assertEquals(listOf(2024, 2025), requests)
        } finally { store.clear(); Dispatchers.resetMain() }
    }
}
