package com.pokemmo.tool.overlay.data

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlayRepositoryTest {

    private fun assetsDir(): File {
        System.getProperty("overlay.assets.dir")?.let { return File(it) }
        // Gradle runs unit tests with the module dir (android/app) as working dir.
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

    @Test
    fun areasContainKantoRoute5() {
        assertTrue(repo.areas.any { it.region == "Kanto" && it.name == "Route 5" })
    }

    @Test
    fun pokemonLookupById() {
        assertEquals(listOf("Fighting"), repo.pokemon(217)!!.weak2)
        assertNull(repo.pokemon(99999))
    }

    @Test
    fun allPokemonExposesParsedList() {
        assertTrue(repo.allPokemon.size >= 649)
        assertEquals(1, repo.allPokemon.first().id)
    }

    @Test
    fun pokemonByNameUsesNameKey() {
        assertEquals(122, repo.pokemonByName("mrmime")!!.id)
        assertEquals(83, repo.pokemonByName("farfetchd")!!.id)
        assertNull(repo.pokemonByName("notapokemon"))
    }

    @Test
    fun nameKeyNormalizes() {
        assertEquals("mrmime", NameKey.of("Mr. Mime"))
        assertEquals("farfetchd", NameKey.of("Farfetch'd"))
        assertEquals("nidoran♀", NameKey.of("Nidoran♀"))
        assertEquals("nidoran♂", NameKey.of("Nidoran ♂"))
    }

    @Test
    fun meowthHasOutline() {
        assertTrue(repo.hasOutline(repo.tags(52)))
    }

    @Test
    fun evOnlyTagHasNoOutline() {
        assertFalse(repo.hasOutline(listOf(Tag("ev", "ev", "+1 Spe"))))
    }

    @Test
    fun explanationsAndTipsAreReadable() {
        assertNotNull(repo.explanation("ev"))
        assertNull(repo.explanation("nope"))
        assertTrue(repo.tags(99999).isEmpty())
    }

    @Test
    fun withTagsReplacesOnlyTags() {
        val swapped = repo.withTags(
            """{"schemaVersion":1,"generatedAt":"x","explanations":{},"pokemon":{"1":[{"kind":"ev","key":"ev","summary":"s"}]},"tips":{"1":"hi"}}"""
        )
        assertEquals(1, swapped.tags(1).size)
        assertEquals("hi", swapped.tip(1))
        assertNull(swapped.explanation("ev"))
        assertEquals(repo.allPokemon.size, swapped.allPokemon.size)
        assertEquals(repo.areas.size, swapped.areas.size)
    }
}
