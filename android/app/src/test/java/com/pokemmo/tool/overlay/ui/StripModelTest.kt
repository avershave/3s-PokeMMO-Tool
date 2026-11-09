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

class StripModelTest {
    private fun assetsDir(): File {
        System.getProperty("overlay.assets.dir")?.let { return File(it) }
        return listOf(File("src/main/assets/overlay"), File("app/src/main/assets/overlay"))
            .first { it.isDirectory }
    }

    private fun read(name: String) = File(assetsDir(), name).readText(Charsets.UTF_8)

    private val repo by lazy {
        OverlayRepository(read("pokemon.json"), read("areas.json"), read("tags.json"))
    }

    private val route5 get() = repo.areas.first { it.region == "Kanto" && it.name == "Route 5" }

    private fun tagsJson(vararg entries: Pair<Int, String>): String =
        """{"schemaVersion":1,"pokemon":{${entries.joinToString(",") { "\"${it.first}\":${it.second}" }}}}"""

    private fun tag(kind: String, key: String = kind, summary: String = "s") =
        """{"kind":"$kind","key":"$key","summary":"$summary"}"""

    private fun area(vararg ids: Int) = Area(
        "Kanto", "Test", "test",
        ids.map { Spawn(it, repo.pokemon(it)!!.name, listOf(Encounter("Grass", listOf("Common")))) },
    )

    @Test
    fun route5StripOutlinesMeowthAndAbraDimsRattata() {
        val m = buildStrip(route5, repo, 50)
        val byName = m.items.associateBy { it.name }
        assertEquals(TagKind.PVP, byName.getValue("Meowth").outline)
        assertEquals(TagKind.PVP, byName.getValue("Abra").outline)
        assertFalse(byName.getValue("Abra").dimmed)
        // Current generated data gives every Route 5 spawn a PvP tag (some via an evolution),
        // so the dimmed case is checked on the first real Pokemon with no non-EV tags.
        val plain = repo.allPokemon.first { p -> repo.tags(p.id).none { it.kind != "ev" } }
        val dim = buildStrip(area(plain.id), repo, 5).items.single()
        assertNull(dim.outline)
        assertTrue(dim.dimmed)
        assertEquals("Route 5", m.title)
        assertEquals("Kanto", m.region)
    }

    @Test
    fun outlinedFirstPvpBeforeStoryBeforeUtility() {
        val r = repo.withTags(
            tagsJson(
                1 to "[${tag("utility")}]",
                4 to "[${tag("story")}]",
                7 to "[${tag("pvp")}]",
                10 to "[${tag("ev", "ev")}]",
                25 to "[${tag("gtm")}]",
            ),
        )
        val m = buildStrip(area(10, 1, 25, 4, 7), r, 10)
        assertEquals(listOf(7, 4, 1), m.items.take(3).map { it.id })
        assertEquals(listOf(TagKind.PVP, TagKind.STORY, TagKind.UTILITY), m.items.take(3).map { it.outline })
        // dimmed follow, by name
        val rest = m.items.drop(3)
        assertTrue(rest.all { it.dimmed })
        assertEquals(rest.map { it.name }.sorted(), rest.map { it.name })
    }

    @Test
    fun highestKindWinsOutline() {
        val r = repo.withTags(tagsJson(1 to "[${tag("utility")},${tag("pvp")},${tag("story")}]"))
        assertEquals(TagKind.PVP, buildStrip(area(1), r, 5).items.single().outline)
    }

    @Test
    fun overflowCountsHiddenSprites() {
        val n = route5.spawns.size
        val m = buildStrip(route5, repo, 5)
        assertEquals(5, m.items.size)
        assertEquals(n - 5, m.overflow)
        assertEquals(0, buildStrip(route5, repo, n + 10).overflow)
    }

    @Test
    fun emptyAreaShowsEmptyFlag() {
        val m = buildStrip(Area("Kanto", "Nowhere", "nowhere"), repo, 5)
        assertTrue(m.empty)
        assertEquals(0, m.overflow)
        assertTrue(m.items.isEmpty())
    }

    @Test
    fun cardRowsLabelCarriedTags() {
        val card = buildCard(63, repo, null, null)
        val pvp = card.rows.first { it.kind == TagKind.PVP }
        assertTrue(pvp.title, pvp.title.endsWith("(as Alakazam)"))
        assertTrue(pvp.body.contains("Smogon Gen 5"))
        assertTrue(pvp.body.contains("may differ"))
    }

    @Test
    fun evRowsComeLastAndCardIgnoresUnknownKinds() {
        val r = repo.withTags(
            tagsJson(1 to "[${tag("ev", "ev", "+1 SpA")},${tag("gtm")},${tag("utility", "utility.pickup")}]"),
        )
        val card = buildCard(1, r, null, null)
        assertEquals(listOf(TagKind.UTILITY, TagKind.EV), card.rows.map { it.kind })
    }

    @Test
    fun evNeverOutlined() {
        val r = repo.withTags(tagsJson(1 to "[${tag("ev", "ev", "+1 SpA")}]"))
        val item = buildStrip(area(1), r, 5).items.single()
        assertNull(item.outline)
        assertTrue(item.dimmed)
    }

    @Test
    fun subtitleWithSpawnUsesRarestRarityMethodAndTypes() {
        val spawn = Spawn(
            63, "Abra",
            listOf(
                Encounter("Grass", listOf("Common")),
                Encounter("Cave", listOf("Rare")),
            ),
        )
        assertEquals("Rare · Grass · Psychic", buildCard(63, repo, spawn, null).subtitle)
    }

    @Test
    fun subtitleWithoutSpawnIsTypesOnly() {
        assertEquals("Psychic", buildCard(63, repo, null, null).subtitle)
        assertEquals("Grass · Poison", buildCard(1, repo, null, null).subtitle)
    }

    @Test
    fun evRowShowsPerHordeWhenHorde() {
        val r = repo.withTags(tagsJson(1 to "[${tag("ev", "ev", "+2 Atk")}]"))
        val horde = buildCard(1, r, null, 5).rows.single()
        assertEquals("+2 Atk each, +10 per horde", horde.summary)
        val multi = repo.withTags(tagsJson(1 to "[${tag("ev", "ev", "+1 Atk, +2 Def")}]"))
        assertEquals("+1 Atk, +2 Def each, +3 Atk, +6 Def per horde", buildCard(1, multi, null, 3).rows.single().summary)
        assertEquals("+2 Atk", buildCard(1, r, null, 1).rows.single().summary)
        assertEquals("+2 Atk", buildCard(1, r, null, null).rows.single().summary)
    }

    @Test
    fun cardTextHasNoLevelLabels() {
        val lv = Regex("\\b(lv|nv)\\b", RegexOption.IGNORE_CASE)
        for (id in listOf(1, 52, 63, 65, 130, 143, 248)) {
            val spawn = Spawn(id, "x", listOf(Encounter("Grass", listOf("Rare"), 12, 14, 3)))
            val card = buildCard(id, repo, spawn, 3)
            val text = buildString {
                append(card.name).append(' ').append(card.subtitle).append(' ').append(card.tip.orEmpty())
                card.rows.forEach { append(' ').append(it.title).append(' ').append(it.summary).append(' ').append(it.body).append(' ').append(it.more.orEmpty()) }
            }
            assertFalse("Pokemon $id: $text", lv.containsMatchIn(text))
        }
    }
}
