package com.pokemmo.tool.overlay.match

import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.data.OverlayRepository
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
    fun `dropped dot before channel still matches (read on Pixel 9 Pro XL)`() {
        val a = matcher.match("Vermilion City VILLAGE CH 5", null)
        assertEquals("Kanto", a!!.region)
        assertEquals("Vermilion City", a.name)

        val unknown = matcher.match("Pallet Lab INSIDE CH 2", "Kanto")
        assertEquals("Pallet Lab", unknown!!.name)
        assertTrue(unknown.spawns.isEmpty())
    }

    @Test
    fun `channel read as GH still matches (read on Pixel 9 Pro XL)`() {
        // Four of the first six reads after walking back into Vermilion City came out like this.
        val a = matcher.match("Vermilion City VILLAGE GH 2", "Kanto")
        assertEquals("Vermilion City", a!!.name)
        assertEquals("Kanto", a.region)
        assertEquals("Route 11", matcher.match("Route 11 ROUTE GH 2", "Kanto")!!.name)
    }

    @Test
    fun `exact reads are told apart from fuzzy ones`() {
        val clean = "Route 11 ROUTE CH 4"
        assertTrue(matcher.isExact(clean, matcher.match(clean, "Kanto")!!))
        val gh = "Vermilion City VILLAGE GH 4"
        assertTrue(matcher.isExact(gh, matcher.match(gh, "Kanto")!!))
        // Read on the Pixel: a stray letter before the name matches fuzzily, so it is not exact.
        val stray = "le Vermilion City VILLAGE CH2"
        assertFalse(matcher.isExact(stray, matcher.match(stray, "Kanto")!!))
        val typo = "Vermilion Clty VILLAGE CH 2"
        assertFalse(matcher.isExact(typo, matcher.match(typo, "Kanto")!!))
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

    @Test
    fun `generic-word collisions never match the wrong area`() {
        val oreburgh = matcher.match("Oreburgh City CITY · CH 1", null)!!
        assertTrue(oreburgh.spawns.isEmpty())
        assertEquals("Oreburgh City", oreburgh.name)

        val mistralton = matcher.match("Mistralton City · CH 1", null)!!
        assertTrue(mistralton.spawns.isEmpty())
        assertEquals("Mistralton City", mistralton.name)
    }

    @Test
    fun `generic-word typo picks the matching area by similarity`() {
        val cerulean = matcher.match("Cerulean Clty", null)
        if (repo.areas.any { it.name == "Cerulean City" }) {
            assertEquals("Cerulean City", cerulean!!.name)
        } else {
            assertTrue(cerulean == null || cerulean.name != "Cerulean Cave")
        }
        assertEquals("Eterna Forest", matcher.match("Eterna Forcst", null)!!.name)
    }

    @Test
    fun `real generic names still match`() {
        assertEquals("Oreburgh Gate", matcher.match("Oreburgh Gate", null)!!.name)
    }
}
