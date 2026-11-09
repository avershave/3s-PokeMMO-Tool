package com.pokemmo.tool.overlay.match

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AliasKeyTest {

    private val fixtures by lazy {
        val text = javaClass.classLoader!!.getResourceAsStream("alias-fixtures.json")!!
            .readBytes().toString(Charsets.UTF_8)
        (Json.parseToJsonElement(text) as JsonArray).map {
            it.jsonObject["input"]!!.jsonPrimitive.content to it.jsonObject["key"]!!.jsonPrimitive.content
        }
    }

    @Test
    fun matchesEveryJsFixture() {
        assertTrue(fixtures.isNotEmpty())
        val bad = fixtures.filter { AliasKey.of(it.first) != it.second }
            .map { "${it.first} -> ${AliasKey.of(it.first)} (expected ${it.second})" }
        assertTrue("Mismatches (${bad.size}/${fixtures.size}): $bad", bad.isEmpty())
    }

    @Test
    fun aliasesAndAccents() {
        assertEquals("mountcoronet", AliasKey.of("Mt. Coronet 4F"))
        assertEquals("pokeathlondome", AliasKey.of("Pokéathlon Dome"))
        assertEquals("pokeathlondome", AliasKey.of("Pok�athlon Dome"))
        assertEquals("pokemonmansion", AliasKey.of("Pokmon Mansion"))
        assertEquals("pokmansion", AliasKey.of("Pok�mon Mansion")) // JS parity: "mon" is stripped as a day name
    }

    @Test
    fun asciiWordBoundaryLikeJs() {
        // JS \b is ASCII-only: "mon" after an accented letter is a day name and is stripped.
        assertEquals("pok", AliasKey.of("Pokémon"))
    }
}
