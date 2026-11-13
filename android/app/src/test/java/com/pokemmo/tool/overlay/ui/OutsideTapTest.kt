package com.pokemmo.tool.overlay.ui

import com.pokemmo.tool.overlay.capture.IntRect
import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.data.Spawn
import com.pokemmo.tool.overlay.match.Season
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OutsideTapTest {
    private val drawer = IntRect(700, 0, 1500, 120)

    @Test
    fun `a tap on the game closes the card`() {
        assertTrue(outsideTapClosesCard(200f, 600f, drawer))
        // Taps on other apps' windows arrive with their position hidden, as 0,0.
        assertTrue(outsideTapClosesCard(0f, 0f, drawer))
    }

    @Test
    fun `a tap on the drawer is left to the drawer`() {
        assertFalse(outsideTapClosesCard(900f, 60f, drawer))
        assertFalse(outsideTapClosesCard(700f, 0f, drawer))
    }

    @Test
    fun `with no drawer every outside tap closes the card`() {
        assertTrue(outsideTapClosesCard(900f, 60f, null))
    }

    @Test
    fun `a season change is still the same place`() {
        val all = Area("Kanto", "Route 6", "route6", listOf(Spawn(79, "Slowpoke")),
            mapOf("Autumn" to emptyList()))
        assertTrue(samePlace(all, all.forSeason(Season.Autumn)))
        assertFalse(samePlace(all, Area("Kanto", "Route 5", "route5")))
        assertFalse(samePlace(all, null))
        assertTrue(samePlace(null, null))
    }
}
