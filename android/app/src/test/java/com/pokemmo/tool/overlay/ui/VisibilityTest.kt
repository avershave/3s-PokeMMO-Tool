package com.pokemmo.tool.overlay.ui

import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.state.ScreenState
import org.junit.Assert.assertEquals
import org.junit.Test

class VisibilityTest {
    private val area = Area("Kanto", "Route 6", "route6")
    private val overworld = ScreenState.Overworld(area)
    private val battle = ScreenState.Battle(emptyList(), area)

    @Test
    fun `overworld with the drawer open and a card shows both`() {
        assertEquals(Visible(drawer = true, card = true, panel = false), visibility(overworld, false, true, true))
    }

    @Test
    fun `a suspected battle hides the drawer and card`() {
        assertEquals(Visible(false, false, false), visibility(overworld, true, true, true))
    }

    @Test
    fun `battle shows only the panel`() {
        assertEquals(Visible(false, false, true), visibility(battle, false, true, true))
        assertEquals(Visible(false, false, true), visibility(battle, true, false, false))
    }

    @Test
    fun `idle shows the drawer but no card`() {
        assertEquals(Visible(true, false, false), visibility(ScreenState.Idle, false, true, false))
    }

    @Test
    fun `a closed drawer hides the card`() {
        assertEquals(Visible(true, false, false), visibility(overworld, false, false, true))
    }
}
