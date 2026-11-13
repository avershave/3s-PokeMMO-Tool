package com.pokemmo.tool.overlay.ui

import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.data.Encounter
import com.pokemmo.tool.overlay.data.OverlayRepository
import com.pokemmo.tool.overlay.data.Spawn
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlayModelsTest {
    private fun assetsDir(): File {
        System.getProperty("overlay.assets.dir")?.let { return File(it) }
        return listOf(File("src/main/assets/overlay"), File("app/src/main/assets/overlay"))
            .first { it.isDirectory }
    }

    private fun read(name: String) = File(assetsDir(), name).readText(Charsets.UTF_8)

    private val repo by lazy {
        OverlayRepository(read("pokemon.json"), read("areas.json"), read("tags.json"))
    }

    private val route6 get() = repo.areas.first { it.region == "Kanto" && it.name == "Route 6" }

    private fun tagsJson(vararg entries: Pair<Int, String>): String =
        """{"schemaVersion":1,"pokemon":{${entries.joinToString(",") { "\"${it.first}\":${it.second}" }}}}"""

    private fun tag(kind: String, key: String = kind, summary: String = "s") =
        """{"kind":"$kind","key":"$key","summary":"$summary"${if (kind == "pvp") ",\"tier\":\"ou\"" else ""}}"""

    // --- Drawer ---

    @Test
    fun `route 6 drawer keeps spawn order with marks and fades`() {
        val d = buildDrawer(route6, repo)
        assertFalse(d.empty)
        val first = d.items.first()
        assertEquals(16, first.id)
        assertEquals(listOf(CatchMark.GRASS), first.marks)
        assertFalse(first.worth)
        val psyduck = d.items.first { it.id == 54 }
        assertEquals(listOf(CatchMark.GRASS, CatchMark.SURF, CatchMark.ROD), psyduck.marks)
        val ids = d.items.map { it.id }
        assertFalse("Politoed is lure only", 186 in ids)
        assertFalse("Smeargle is lure only", 235 in ids)
        assertEquals(37, d.cycle.first())
        assertEquals(d.items.filter { it.worth }.map { it.id }, d.cycle)
    }

    @Test
    fun `drawer dedupes by id`() {
        val a = Area("Kanto", "T", "t", listOf(
            Spawn(16, "Pidgey", listOf(Encounter("Grass"))),
            Spawn(16, "Pidgey", listOf(Encounter("Water"))),
        ))
        assertEquals(listOf(16), buildDrawer(a, repo).items.map { it.id })
    }

    @Test
    fun `no area or lure-only area is empty`() {
        val none = buildDrawer(null, repo)
        assertTrue(none.empty)
        assertTrue(none.items.isEmpty())
        assertTrue(none.cycle.isEmpty())
        val lures = Area("Kanto", "T", "t", listOf(Spawn(186, "Politoed", listOf(Encounter("Lure (Water)")))))
        assertTrue(buildDrawer(lures, repo).empty)
    }

    // --- Where lines ---

    @Test
    fun `level text uses the word Level and an en dash`() {
        assertEquals("Level 30–35", levelText(30, 35))
        assertEquals("Level 38", levelText(38, 38))
        assertNull(levelText(null, 40))
        assertNull(levelText(30, null))
    }

    @Test
    fun `water reads as surfing`() {
        assertEquals("Surfing", methodName("Water"))
        assertEquals("Surfing (Night)", methodName("Water (Night)"))
        assertEquals("Super Rod", methodName("Super Rod"))
    }

    @Test
    fun `slowpoke surfing line on route 6`() {
        val e = route6.spawns.first { it.id == 79 }.encounters.first { it.method == "Water" }
        assertEquals("Surfing · Very common · Hordes of 5 · Level 30–35", whereText(e))
    }

    @Test
    fun `horde without size and horde listed first`() {
        assertEquals("Grass · Uncommon · Hordes · Level 10–15",
            whereText(Encounter("Grass", listOf("Horde", "Uncommon"), 10, 15)))
    }

    @Test
    fun `card where lines skip lures and carry marks`() {
        val spawn = Spawn(54, "Psyduck", listOf(Encounter("Water", listOf("Common"), 30, 35), Encounter("Lure (Water)")))
        val card = buildCard(54, repo, spawn, route6, 5)
        assertEquals(listOf(CatchMark.SURF), card.where.map { it.mark })
        assertEquals("Route 6 · Kanto", card.footer)
        assertEquals(listOf("Water"), card.types)
    }

    @Test
    fun `battle card has no where lines or footer`() {
        val card = buildCard(63, repo, null, null, null)
        assertTrue(card.where.isEmpty())
        assertNull(card.footer)
    }

    @Test
    fun `no overworld text could pass for a battle line`() {
        val battleLike = Regex("(?i)\\b(Lv|Nv|Niv|Lvl)\\.?\\s*\\d")
        for (area in repo.areas) {
            for (spawn in area.spawns) {
                val horde = spawn.encounters.mapNotNull { it.hordeSize }.maxOrNull()
                val card = buildCard(spawn.id, repo, spawn, area, horde)
                val text = buildList {
                    add(card.name)
                    card.where.forEach { add(it.text) }
                    card.rows.forEach { add(it.summary); add(it.via.orEmpty()) }
                    add(card.tip.orEmpty())
                    add(card.footer.orEmpty())
                }.joinToString("\n")
                assertFalse("${area.name} ${spawn.name}: $text", battleLike.containsMatchIn(text))
            }
        }
        assertFalse(battleLike.containsMatchIn(NO_WILD_TEXT))
    }

    // --- Card rows ---

    @Test
    fun `carried tags name the evolution`() {
        val pvp = buildCard(63, repo, null, null, null).rows.first { it.kind == TagKind.PVP }
        assertEquals("Alakazam", pvp.via)
        assertTrue(pvp.body.contains("Smogon Gen 5"))
        assertTrue(pvp.body.contains("may differ"))
        assertNull(buildCard(217, repo, null, null, null).rows.first { it.kind == TagKind.STORY }.via)
    }

    @Test
    fun `ev rows come last and unknown kinds are ignored`() {
        val r = repo.withTags(
            tagsJson(1 to "[${tag("ev", "ev", "+1 SpA")},${tag("gtm")},${tag("utility", "utility.pickup")}]"),
        )
        assertEquals(listOf(TagKind.UTILITY, TagKind.EV), buildCard(1, r, null, null, null).rows.map { it.kind })
    }

    @Test
    fun `ev row shows per horde`() {
        val r = repo.withTags(tagsJson(1 to "[${tag("ev", "ev", "+2 Atk")}]"))
        assertEquals("+2 Atk each · +10 per horde", buildCard(1, r, null, null, 5).rows.single().summary)
        val multi = repo.withTags(tagsJson(1 to "[${tag("ev", "ev", "+1 Atk, +2 Def")}]"))
        assertEquals("+1 Atk, +2 Def each · +3 Atk, +6 Def per horde",
            buildCard(1, multi, null, null, 3).rows.single().summary)
        assertEquals("+2 Atk", buildCard(1, r, null, null, 1).rows.single().summary)
        assertEquals("+2 Atk", buildCard(1, r, null, null, null).rows.single().summary)
    }

    @Test
    fun `worth follows hasOutline`() {
        val r = repo.withTags(tagsJson(1 to "[${tag("utility")}]", 4 to "[${tag("ev", "ev", "+1 SpA")}]"))
        val a = Area("Kanto", "T", "t", listOf(
            Spawn(1, "Bulbasaur", listOf(Encounter("Grass"))),
            Spawn(4, "Charmander", listOf(Encounter("Grass"))),
        ))
        val d = buildDrawer(a, r)
        assertEquals(listOf(true, false), d.items.map { it.worth })
        assertEquals(listOf(1), d.cycle)
    }
}
