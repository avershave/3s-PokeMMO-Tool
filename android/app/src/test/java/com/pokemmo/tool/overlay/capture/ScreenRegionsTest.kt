package com.pokemmo.tool.overlay.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class ScreenRegionsTest {
    @Test
    fun `overlay regions never overlap OCR regions in their state`() {
        // Overworld: the strip is shown, battle OCR is not running.
        assertFalse(ScreenRegions.STRIP_AREA.intersects(ScreenRegions.ROUTE))
        // Battle: the panel is shown; the strip is hidden.
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
