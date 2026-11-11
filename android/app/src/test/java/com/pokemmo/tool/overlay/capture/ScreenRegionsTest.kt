package com.pokemmo.tool.overlay.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class ScreenRegionsTest {
    @Test
    fun `overlay regions never overlap OCR regions in their state`() {
        // Overworld: the drawer and card are shown; only the route name must stay clear.
        assertFalse(ScreenRegions.DRAWER_AREA.intersects(ScreenRegions.ROUTE))
        // Battle: the panel is shown; the drawer and card are hidden.
        assertFalse(ScreenRegions.BATTLE_PANEL.intersects(ScreenRegions.BATTLE))
        assertFalse(ScreenRegions.BATTLE_PANEL.intersects(ScreenRegions.ROUTE))
    }

    @Test
    fun `touching edges do not count as intersecting`() {
        assertFalse(FRect(0f, 0f, 0.5f, 0.5f).intersects(FRect(0.5f, 0f, 1f, 0.5f)))
    }

    @Test
    fun `toPixels scales by screen size`() {
        val r = ScreenRegions.ROUTE.toPixels(2000, 1000)
        assertEquals(60, r.left)
        assertEquals(0, r.top)
        assertEquals(520, r.right)
        assertEquals(55, r.bottom)
    }
}
