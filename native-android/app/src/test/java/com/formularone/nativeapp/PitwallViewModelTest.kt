package com.formularone.nativeapp

import androidx.lifecycle.ViewModelStore
import com.formularone.nativeapp.data.AppSettings
import com.formularone.nativeapp.data.F1Repository
import com.formularone.nativeapp.data.Loaded
import com.formularone.nativeapp.model.*
import com.formularone.nativeapp.ui.PitwallViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.time.Instant
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class PitwallViewModelTest {
    private val store = ViewModelStore()
    private val settings = MutableStateFlow(AppSettings())
    @Before fun prepare() { Dispatchers.setMain(UnconfinedTestDispatcher()) }
    @After fun cleanup() { store.clear(); Dispatchers.resetMain() }
    private fun race(year: Int) = Race(year, 1, "Test Grand Prix", "test", "Test Circuit", "City", "Country", LocalDate.of(year, 3, 1), null, emptyList())
    private inner class FakeRepository : F1Repository {
        var oldCalendar: CompletableDeferred<Loaded<List<Race>>>? = null
        var failResults = false
        val requests = mutableListOf<Pair<Int, Session>>()
        override suspend fun races(year: Int, refresh: Boolean): Loaded<List<Race>> {
            if (year == 2024 && oldCalendar != null) return withContext(NonCancellable) { oldCalendar!!.await() }
            return Loaded(listOf(race(year)), Instant.EPOCH)
        }
        override suspend fun results(race: Race, session: Session, refresh: Boolean): Loaded<List<Classification>> {
            requests += race.round to session
            if (failResults) throw IOException("offline")
            return Loaded(emptyList(), Instant.EPOCH)
        }
        override suspend fun standings(year: Int, constructors: Boolean, refresh: Boolean) = Loaded(emptyList<Standing>(), Instant.EPOCH)
    }
    private fun viewModel(repository: F1Repository) = PitwallViewModel(repository, settings, {}, {}).also { store.put("test", it) }

    @Test fun `cancelled old season never overwrites the selected season`() = runTest {
        val repository = FakeRepository().apply { oldCalendar = CompletableDeferred() }
        val vm = viewModel(repository)
        vm.selectYear(2024)
        vm.selectYear(2025)
        repository.oldCalendar!!.complete(Loaded(listOf(race(2024)), Instant.EPOCH))
        advanceUntilIdle()
        assertEquals(2025, vm.year.value)
        assertEquals(2025, vm.races.value.data!!.single().season)
    }

    @Test fun `unpublished result differs from a failed request`() = runTest {
        val repository = FakeRepository()
        val vm = viewModel(repository)
        vm.openRace(race(2025))
        assertNotNull(vm.results.value.data)
        assertTrue(vm.results.value.data!!.isEmpty())
        assertNull(vm.results.value.error)
        repository.failResults = true
        vm.selectSession(Session.QUALIFYING)
        assertNotNull(vm.results.value.error)
        assertNull(vm.results.value.data)
        assertFalse(vm.results.value.loading)
    }

    @Test fun `returning through another race restores the original race and session`() = runTest {
        val repository = FakeRepository()
        val vm = viewModel(repository)
        vm.openRace(race(2025))
        vm.selectSession(Session.QUALIFYING)
        vm.openDriver(Driver("test", "Test Driver", "Driver", "TST", "1", "Test"))
        vm.openCalendar()
        vm.openRace(race(2025).copy(round = 2))
        vm.back()
        vm.back()
        vm.back()
        assertEquals(1 to Session.QUALIFYING, repository.requests.last())
        assertEquals(Session.QUALIFYING, vm.session.value)
    }
}
