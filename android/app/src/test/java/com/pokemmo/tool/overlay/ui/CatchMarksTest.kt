package com.pokemmo.tool.overlay.ui

import com.pokemmo.tool.overlay.data.Encounter
import com.pokemmo.tool.overlay.data.Spawn
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CatchMarksTest {
    private fun spawn(vararg methods: String) =
        Spawn(1, "Test", methods.map { Encounter(it) })

    @Test
    fun `grass methods and their variants`() {
        for (m in listOf("Grass", "Grass (Night)", "Dark Grass (Morning/Day)", "Shadow")) {
            assertEquals(m, CatchMark.GRASS, markOf(m))
        }
    }

    @Test
    fun `water means surfing`() {
        for (m in listOf("Water", "Water (Night)")) assertEquals(m, CatchMark.SURF, markOf(m))
    }

    @Test
    fun `rods and fishing`() {
        for (m in listOf("Old Rod", "Good Rod (Night)", "Super Rod", "Fishing")) {
            assertEquals(m, CatchMark.ROD, markOf(m))
        }
    }

    @Test
    fun `caves inside and dust clouds`() {
        for (m in listOf("Cave", "Cave (Day)", "Inside", "Dust Cloud")) {
            assertEquals(m, CatchMark.CAVE, markOf(m))
        }
    }

    @Test
    fun `headbutt rocks and honey trees are special`() {
        for (m in listOf("Headbutt (Night)", "Rocks", "Honey Tree")) {
            assertEquals(m, CatchMark.SPECIAL, markOf(m))
        }
    }

    @Test
    fun `lures have no mark`() {
        assertNull(markOf("Lure (Water)"))
        assertNull(markOf("Lure (Grass/Cave)"))
    }

    @Test
    fun `an unknown method is special, not dropped`() {
        assertEquals(CatchMark.SPECIAL, markOf("Sky Battle"))
    }

    @Test
    fun `marks are distinct and in display order`() {
        val psyduck = spawn("Super Rod", "Water", "Grass", "Water (Night)", "Lure (Water)")
        assertEquals(listOf(CatchMark.GRASS, CatchMark.SURF, CatchMark.ROD), marksFor(psyduck))
    }

    @Test
    fun `lure-only spawns are detected`() {
        assertTrue(isLureOnly(spawn("Lure (Water)", "Lure (Grass)")))
        assertFalse(isLureOnly(spawn("Lure (Water)", "Grass")))
        assertFalse(isLureOnly(spawn()))
    }
}
