package com.pokemmo.tool.overlay.match

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SeasonTest {
    @Test
    fun `reads the season from the clock line`() {
        assertEquals(Season.Autumn, Season.find("Mon 21:35 · Autumn · Clear"))
        assertEquals(Season.Winter, Season.find("Sat 08:02 Winter Snow"))
        assertEquals(Season.Spring, Season.find("SPRING"))
        assertEquals(Season.Summer, Season.find("Tue 12:00 • Summer • Rain"))
    }

    @Test
    fun `allows one misread letter and rn for m`() {
        assertEquals(Season.Autumn, Season.find("Mon 21:35 · Autunn · Clear"))
        assertEquals(Season.Autumn, Season.find("Mon 21:35 · Auturn · Clear"))
        assertEquals(Season.Summer, Season.find("Sumrner"))
        assertEquals(Season.Winter, Season.find("Wlnter"))
    }

    @Test
    fun `place names and noise are not seasons`() {
        assertNull(Season.find("Vermilion City VILLAGE · CH 2"))
        assertNull(Season.find("Route 11 ROUTE CH 4"))
        assertNull(Season.find("$31,192"))
        assertNull(Season.find(""))
    }
}
