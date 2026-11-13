package com.pokemmo.tool.overlay.state

import com.pokemmo.tool.overlay.battle.OpponentGroup
import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.data.Encounter
import com.pokemmo.tool.overlay.data.Spawn
import com.pokemmo.tool.overlay.match.Season
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class SeasonViewTest {
    private val water = Spawn(79, "Slowpoke", listOf(Encounter("Water", listOf("Very Common"))))
    private val horde = Spawn(79, "Slowpoke", listOf(Encounter("Water", listOf("Very Common", "Horde"))))
    private val route6 = Area(
        "Kanto", "Route 6", "route6",
        spawns = listOf(horde),
        seasons = mapOf("Spring" to listOf(horde), "Autumn" to listOf(water)),
    )

    @Test
    fun `an area shows the spawns of the season it is in`() {
        assertEquals(listOf(water), route6.forSeason(Season.Autumn).spawns)
        assertEquals(listOf(horde), route6.forSeason(Season.Spring).spawns)
    }

    @Test
    fun `an unknown season, or one with no list, shows every season's spawns`() {
        assertSame(route6, route6.forSeason(null))
        assertSame(route6, route6.forSeason(Season.Winter))
    }

    @Test
    fun `screen states carry the seasonal area`() {
        val groups = emptyList<OpponentGroup>()
        assertEquals(
            ScreenState.Overworld(route6.forSeason(Season.Autumn)),
            ScreenState.Overworld(route6).forSeason(Season.Autumn),
        )
        assertEquals(
            ScreenState.Battle(groups, route6.forSeason(Season.Autumn)),
            ScreenState.Battle(groups, route6).forSeason(Season.Autumn),
        )
        assertEquals(ScreenState.Idle, ScreenState.Idle.forSeason(Season.Autumn))
    }
}
