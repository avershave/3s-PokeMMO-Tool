package com.pokemmo.tool.overlay.data

import android.content.Context
import kotlinx.serialization.json.Json

class OverlayRepository(
    private val pokemonJson: String,
    private val areasJson: String,
    tagsJson: String,
) {
    val allPokemon: List<PokemonData> = json.decodeFromString<PokemonFile>(pokemonJson).pokemon

    /** Areas are a plain list: keys collide across regions and names, so there is no key index. */
    val areas: List<Area> = json.decodeFromString<AreasFile>(areasJson).areas

    private val tagsFile: TagsFile = json.decodeFromString(tagsJson)

    private val byId: Map<Int, PokemonData> = allPokemon.associateBy { it.id }
    private val byName: Map<String, PokemonData> =
        allPokemon.groupBy { NameKey.of(it.name) }.mapValues { it.value.first() }

    fun pokemon(id: Int): PokemonData? = byId[id]

    /** [normName] is a [NameKey.of] result. */
    fun pokemonByName(normName: String): PokemonData? = byName[normName]

    fun tags(id: Int): List<Tag> = tagsFile.pokemon[id.toString()].orEmpty()

    fun explanation(key: String): Explanation? = tagsFile.explanations[key]

    fun tip(id: Int): String? = tagsFile.tips[id.toString()]

    /** Same rule as scripts/overlay/tags.js: PvP counts only for OU/UU; EV never counts. */
    fun hasOutline(tags: List<Tag>): Boolean = tags.any {
        (it.kind == "pvp" && (it.tier == "ou" || it.tier == "uu")) || it.kind == "story" || it.kind == "utility"
    }

    fun withTags(tagsJson: String): OverlayRepository =
        OverlayRepository(pokemonJson, areasJson, tagsJson)

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun fromAssets(context: Context): OverlayRepository {
            fun read(name: String) =
                context.assets.open("overlay/$name").bufferedReader(Charsets.UTF_8).use { it.readText() }
            return OverlayRepository(read("pokemon.json"), read("areas.json"), read("tags.json"))
        }
    }
}
