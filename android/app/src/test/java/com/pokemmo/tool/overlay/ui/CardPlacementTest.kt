package com.pokemmo.tool.overlay.ui

import com.pokemmo.tool.overlay.capture.IntRect
import com.pokemmo.tool.overlay.capture.ScreenRegions
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CardPlacementTest {
    private val w = 2244
    private val h = 1008
    private val area = ScreenRegions.DRAWER_AREA.toPixels(w, h)
    private val maxBottom = (ScreenRegions.CARD_MAX_BOTTOM * h).toInt()

    @Test
    fun `card is centred under the drawer, wider than it, just below it`() {
        val p = cardPlacement(drawerBottom = 150, area = area, screenW = w, screenH = h, maxBottom = maxBottom)
        val width = (ScreenRegions.CARD_WIDTH * w).toInt()
        assertEquals(width, p.width)
        assertTrue(p.width > area.width)
        assertEquals((area.left + area.right) / 2 - width / 2, p.x)
        assertEquals(155, p.y) // 150 + 0.5% of 1008
        assertEquals(maxBottom - 155, p.maxHeight)
    }

    @Test
    fun `a one-pokemon route still gets a full-width card`() {
        // Artisan Cave: the drawer content is a single 64 px icon, but the card must stay readable.
        val p = cardPlacement(drawerBottom = 110, area = area, screenW = w, screenH = h, maxBottom = maxBottom)
        assertTrue("card at least 60% of the screen wide", p.width >= 0.6 * w)
    }

    @Test
    fun `under a tall show-all drawer the card still has room`() {
        // "+N" opened on Johto Safari Zone: the drawer body fills DRAWER_AREA.
        val p = cardPlacement(drawerBottom = area.bottom + 40, area = area, screenW = w, screenH = h, maxBottom = maxBottom)
        assertTrue("card gets at least a third of the screen height, got ${p.maxHeight}", p.maxHeight >= h / 3)
    }

    @Test
    fun `max height never goes negative`() {
        val p = cardPlacement(drawerBottom = h, area = area, screenW = w, screenH = h, maxBottom = maxBottom)
        assertEquals(0, p.maxHeight)
    }

    @Test
    fun `the card never covers the route name, even under a closed drawer`() {
        val p = cardPlacement(drawerBottom = 0, area = area, screenW = w, screenH = h, maxBottom = maxBottom)
        val card = com.pokemmo.tool.overlay.capture.FRect(
            p.x.toFloat() / w, p.y.toFloat() / h, (p.x + p.width).toFloat() / w, CARD_MAX_BOTTOM_F,
        )
        assertTrue(!card.intersects(ScreenRegions.ROUTE))
        assertTrue("card stays on screen", p.x >= 0 && p.x + p.width <= w)
    }

    private val CARD_MAX_BOTTOM_F = ScreenRegions.CARD_MAX_BOTTOM
}
