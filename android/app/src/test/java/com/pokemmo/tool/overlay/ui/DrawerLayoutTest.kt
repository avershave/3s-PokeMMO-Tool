package com.pokemmo.tool.overlay.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class DrawerLayoutTest {
    @Test
    fun `icon size snaps to whole multiples of the 32 px art`() {
        // Austin's Pixel at "High": 2.5% of 2244 is 56 px, nearest whole scale is 2x.
        assertEquals(64, iconSizePx(2244, 1008))
        assertEquals(64, iconSizePx(1008, 2244))
        // Full resolution 3120: 78 px -> 2x.
        assertEquals(64, iconSizePx(3120, 1440))
        // Big tablet: 2.5% of 4000 = 100 -> 3x.
        assertEquals(96, iconSizePx(4000, 2000))
        // Small screen: below one whole scale, keep it exact.
        assertEquals(25, iconSizePx(1000, 500))
    }

    @Test
    fun `two rows fit without overflow`() {
        assertEquals(DrawerSlots(shown = 20, more = 0), drawerSlots(count = 20, perRow = 10, showAll = false))
    }

    @Test
    fun `beyond two rows the last slot becomes plus N`() {
        assertEquals(DrawerSlots(shown = 19, more = 6), drawerSlots(count = 25, perRow = 10, showAll = false))
    }

    @Test
    fun `show all lifts the row limit`() {
        assertEquals(DrawerSlots(shown = 25, more = 0), drawerSlots(count = 25, perRow = 10, showAll = true))
    }

    @Test
    fun `per row never drops below one`() {
        assertEquals(1, slotsPerRow(widthPx = 10, slotPx = 70))
        assertEquals(14, slotsPerRow(widthPx = 987, slotPx = 70))
    }

    @Test
    fun `tab cycles every three ticks and bounces 0 1 0`() {
        val seq = (0L until 7L).map { tabFrame(it, 2) }
        assertEquals(
            listOf(TabFrame(0, 0), TabFrame(0, 1), TabFrame(0, 0), TabFrame(1, 0), TabFrame(1, 1), TabFrame(1, 0), TabFrame(0, 0)),
            seq,
        )
    }
}
