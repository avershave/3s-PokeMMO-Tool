package com.pokemmo.tool.overlay.data

import com.pokemmo.tool.overlay.match.Season
import kotlinx.serialization.Serializable

@Serializable
data class PokemonData(
    val id: Int,
    val name: String,
    val types: List<String>,
    val catchRate: Int? = null,
    val evYield: Map<String, Int> = emptyMap(),
    val weak4: List<String> = emptyList(),
    val weak2: List<String> = emptyList(),
    val heldItems: List<String> = emptyList(),
)

@Serializable
data class Encounter(
    val method: String,
    val rarities: List<String> = emptyList(),
    val min: Int? = null,
    val max: Int? = null,
    val hordeSize: Int? = null,
)

@Serializable
data class Spawn(
    val id: Int,
    val name: String,
    val encounters: List<Encounter> = emptyList(),
)

@Serializable
data class Area(
    val region: String,
    val name: String,
    val key: String,
    /** Every season's spawns together. */
    val spawns: List<Spawn> = emptyList(),
    /** Spawns per season ("Spring"…), only where they differ by season (personal Hub builds). */
    val seasons: Map<String, List<Spawn>> = emptyMap(),
) {
    /** This area as it is in [season]; unchanged when the season is unknown or not listed. */
    fun forSeason(season: Season?): Area {
        val list = season?.let { seasons[it.name] } ?: return this
        return copy(spawns = list)
    }
}

@Serializable
data class Tag(
    val kind: String,
    val key: String,
    val summary: String,
    val body: String? = null,
    val tier: String? = null,
    val via: Int? = null,
    val viaName: String? = null,
)

@Serializable
data class Explanation(
    val title: String,
    val summary: String,
    val body: String,
    val more: String? = null,
)

@Serializable
data class TagsFile(
    val schemaVersion: Int,
    val generatedAt: String = "",
    val explanations: Map<String, Explanation> = emptyMap(),
    val pokemon: Map<String, List<Tag>> = emptyMap(),
    val tips: Map<String, String> = emptyMap(),
)

@Serializable
internal data class PokemonFile(val schemaVersion: Int, val pokemon: List<PokemonData>)

@Serializable
internal data class AreasFile(val schemaVersion: Int, val areas: List<Area>)
