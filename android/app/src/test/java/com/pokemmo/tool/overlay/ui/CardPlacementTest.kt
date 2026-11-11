package com.pokemmo.tool.overlay.ui

import com.pokemmo.tool.overlay.capture.IntRect
import org.junit.Assert.assertEquals
import org.junit.Test

class CardPlacementTest {
    @Test
    fun `card lines up with the drawer and sits just below it`() {
        // Drawer window 987 px wide at x 628, 150 px tall; screen 2244x1008; area bottom at 42%.
        val p = cardPlacement(drawer = IntRect(628, 0, 1615, 150), screenH = 1008, areaBottom = 423)
        assertEquals(628, p.x)
        assertEquals(987, p.width)
        assertEquals(155, p.y) // 150 + 0.5% of 1008
        assertEquals(423 - 155, p.maxHeight)
    }

    @Test
    fun `max height never goes negative`() {
        val p = cardPlacement(drawer = IntRect(0, 0, 100, 500), screenH = 1008, areaBottom = 423)
        assertEquals(0, p.maxHeight)
    }
}
