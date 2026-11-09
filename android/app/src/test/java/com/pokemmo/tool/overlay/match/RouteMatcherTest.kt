package com.pokemmo.tool.overlay.match

import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.data.OverlayRepository
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RouteMatcherTest {

    private fun assetsDir(): File {
        System.getProperty("overlay.assets.dir")?.let { return File(it) }
        val candidates = listOf(
            File("src/main/assets/overlay"),
            File("app/src/main/assets/overlay"),
            File("android/app/src/main/assets/overlay"),
        )
        return candidates.firstOrNull { it.isDirectory }
            ?: error("overlay assets not found; run `npm run overlay:build`")
    }

    private fun read(name: String) = File(assetsDir(), name).readText(Charsets.UTF_8)

    private val repo by lazy {
        OverlayRepository(read("pokemon.json"), read("areas.json"), read("tags.json"))
    }
    private val matcher by lazy { RouteMatcher(repo.areas) }

    @Test
    fun `matches new-UI town line`() {
        val a = matcher.match("Ecruteak City CITY · CH 1", null)
        assertNotNull(a)
        assertEquals("Johto", a!!.region)
        assertEquals("Ecruteak City", a.name)
    }

    @Test
    fun `matches route number exactly`() {
        val a = matcher.match("Route 5", "Kanto")
        assertNotNull(a)
        assertEquals("Kanto", a!!.region)
        assertEquals("Route 5", a.name)
    }

    @Test
    fun `prefers current region`() {
        val a = matcher.match("Route 1", "Unova")
        assertEquals("Unova", a!!.region)
        assertEquals("Route 1", a.name)
    }

    @Test
    fun `single region wins without current`() {
        val sinnohOnly = repo.areas.first { area ->
            area.region == "Sinnoh" && repo.areas.none { it.region != "Sinnoh" && it.key == area.key }
        }
        val a = matcher.match(sinnohOnly.name, "Kanto")
        assertEquals("Sinnoh", a!!.region)
        assertEquals(sinnohOnly.key, a.key)
    }

    @Test
    fun `tolerates one OCR typo`() {
        val a = matcher.match("Ecruteak Clty", null)
        assertNotNull(a)
        assertEquals("Ecruteak City", a!!.name)
    }

    @Test
    fun `returns null for low-confidence text`() {
        assertNull(matcher.match("", null))
        assertNull(matcher.match("Ro", null))
        assertNull(matcher.match("14,158", null))
        assertNull(matcher.match("Fri 23:12 · Summer", null))
    }

    @Test
    fun `unknown place with channel marker gives empty area`() {
        assertTrue(repo.areas.none { it.name.equals("Pallet Lab", ignoreCase = true) })
        val a = matcher.match("Pallet Lab INSIDE · CH 2", "Kanto")
        assertNotNull(a)
        assertEquals("Pallet Lab", a!!.name)
        assertTrue(a.spawns.isEmpty())
        assertEquals("Kanto", a.region)
    }

    @Test
    fun `route with misread digit never jumps to another route`() {
        assertNull(matcher.match("Route 1S", null))
        assertNull(matcher.match("Route 1S", "Kanto"))
        assertEquals("Route 15", matcher.match("Route 15", "Kanto")!!.name)
    }

    @Test
    fun `unmatched route line with channel marker gives null`() {
        assertNull(matcher.match("Route 1S · CH 1", "Kanto"))
    }

    @Test
    fun `unknown place without marker gives null`() {
        assertNull(matcher.match("Pallet Lab", "Kanto"))
    }

    @Test
    fun `misread dot still counts as channel marker`() {
        val a = matcher.match("Pallet Lab INSIDE • CH 2", null)
        assertEquals("Pallet Lab", a!!.name)
        assertEquals("", a.region)
    }

    @Test
    fun `same key in one region prefers exact name then shortest`() {
        val areas = listOf(
            Area("Kanto", "Safari Zone Gate", "safarizone", emptyList()),
            Area("Kanto", "Safari Zone", "safarizone", emptyList()),
        )
        assertEquals("Safari Zone", RouteMatcher(areas).match("Safari Zone", null)!!.name)
    }
}
