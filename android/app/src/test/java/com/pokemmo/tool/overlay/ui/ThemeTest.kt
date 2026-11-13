package com.pokemmo.tool.overlay.ui

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test

class ThemeTest {
    @Test
    fun `type colours ignore case and fall back to grey`() {
        assertEquals(Color(0xFF4F8FE0), typeColor("Water"))
        assertEquals(Color(0xFF4F8FE0), typeColor("water"))
        assertEquals(Color(0xFF777777), typeColor("???"))
    }

    @Test
    fun `value labels and colours`() {
        assertEquals("PvP", TagKind.PVP.label())
        assertEquals(Color(0xFFFF8A7A), TagKind.PVP.labelColor())
        assertEquals(Color(0xFF7FB8FF), TagKind.STORY.labelColor())
        assertEquals(Color(0xFF8FE08F), TagKind.UTILITY.labelColor())
        assertEquals(Color(0xFFAAB3C2), TagKind.EV.labelColor())
    }
}
