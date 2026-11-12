package com.pokemmo.tool.overlay.state

import com.pokemmo.tool.overlay.battle.OpponentGroup
import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.data.PokemonData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScreenStateMachineTest {
    private val a = Area("Kanto", "Route 1", "route-1")
    private val b = Area("Kanto", "Route 2", "route-2")

    private fun group(id: Int) =
        OpponentGroup(PokemonData(id, "Mon$id", listOf("Normal")), 1, 5, 5, false)

    private val g1 = listOf(group(1))
    private val g2 = listOf(group(2))
    private val none = emptyList<OpponentGroup>()

    private fun ScreenStateMachine.confirm(area: Area) {
        onTick(area, none); onTick(area, none)
    }

    @Test
    fun `starts idle and first route needs two ticks`() {
        val m = ScreenStateMachine()
        assertEquals(ScreenState.Idle, m.onTick(a, none))
        assertEquals(ScreenState.Overworld(a), m.onTick(a, none))
    }

    @Test
    fun `an exact route read switches on the first tick`() {
        val m = ScreenStateMachine()
        assertEquals(ScreenState.Overworld(a), m.onTick(a, none, routeExact = true))
        assertEquals(ScreenState.Overworld(b), m.onTick(b, none, routeExact = true))
    }

    @Test
    fun `a fuzzy route read still needs two ticks`() {
        val m = ScreenStateMachine()
        m.confirm(a)
        assertEquals(ScreenState.Overworld(a), m.onTick(b, none, routeExact = false))
        assertEquals(ScreenState.Overworld(b), m.onTick(b, none, routeExact = false))
    }

    @Test
    fun `an exact read during a battle does not change the area`() {
        val m = ScreenStateMachine()
        m.confirm(a)
        m.onTick(null, g1); m.onTick(null, g1)
        assertEquals(ScreenState.Battle(g1, a), m.onTick(b, g1, routeExact = true))
    }

    @Test
    fun `battle entry needs two ticks`() {
        val m = ScreenStateMachine()
        m.confirm(a)
        assertEquals(ScreenState.Overworld(a), m.onTick(null, g1))
        assertEquals(ScreenState.Battle(g1, a), m.onTick(null, g1))
    }

    @Test
    fun `non consecutive battle ticks do not enter battle`() {
        val m = ScreenStateMachine()
        m.confirm(a)
        m.onTick(null, g1)
        m.onTick(null, none)
        assertEquals(ScreenState.Overworld(a), m.onTick(null, g1))
    }

    @Test
    fun `battle exit needs three empty ticks`() {
        val m = ScreenStateMachine()
        m.confirm(a)
        m.onTick(null, g1); m.onTick(null, g1)
        assertEquals(ScreenState.Battle(g1, a), m.onTick(null, none))
        assertEquals(ScreenState.Battle(g1, a), m.onTick(null, none))
        assertEquals(ScreenState.Overworld(a), m.onTick(null, none))
    }

    @Test
    fun `dropout resets and groups update to latest non-empty`() {
        val m = ScreenStateMachine()
        m.confirm(a)
        m.onTick(null, g1); m.onTick(null, g1)
        m.onTick(null, none); m.onTick(null, none)
        assertEquals(ScreenState.Battle(g2, a), m.onTick(null, g2))
        // counter was reset, so two more empties still stay in battle
        m.onTick(null, none)
        assertEquals(ScreenState.Battle(g2, a), m.onTick(null, none))
    }

    @Test
    fun `route ticks during battle do not exit or change area`() {
        val m = ScreenStateMachine()
        m.confirm(a)
        m.onTick(null, g1); m.onTick(null, g1)
        repeat(5) { assertEquals(ScreenState.Battle(g1, a), m.onTick(b, g1)) }
    }

    @Test
    fun `battle without any route exits to idle`() {
        val m = ScreenStateMachine()
        m.onTick(null, g1)
        assertEquals(ScreenState.Battle(g1, null), m.onTick(null, g1))
        m.onTick(null, none); m.onTick(null, none)
        assertEquals(ScreenState.Idle, m.onTick(null, none))
    }

    @Test
    fun `route change needs two agreeing ticks`() {
        val m = ScreenStateMachine()
        m.confirm(a)
        assertEquals(ScreenState.Overworld(a), m.onTick(b, none))
        assertEquals(ScreenState.Overworld(a), m.onTick(a, none))
        assertEquals(ScreenState.Overworld(a), m.onTick(b, none))
        assertEquals(ScreenState.Overworld(b), m.onTick(b, none))
    }

    @Test
    fun `null route keeps last`() {
        val m = ScreenStateMachine()
        m.confirm(a)
        repeat(4) { assertEquals(ScreenState.Overworld(a), m.onTick(null, none)) }
        assertTrue(m.onTick(null, none) is ScreenState.Overworld)
    }
}
