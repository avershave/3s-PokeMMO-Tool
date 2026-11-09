package com.pokemmo.tool.overlay.battle

import com.pokemmo.tool.overlay.data.NameKey
import com.pokemmo.tool.overlay.data.OverlayRepository
import com.pokemmo.tool.overlay.data.PokemonData

/** OCR-agnostic text line with its bounding box in image pixels. */
data class OcrLine(val text: String, val left: Int, val top: Int, val right: Int, val bottom: Int)

data class Opponent(val pokemon: PokemonData, val level: Int, val box: OcrLine)

data class OpponentGroup(
    val pokemon: PokemonData,
    val count: Int,
    val minLevel: Int,
    val maxLevel: Int,
    val caught: Boolean,
)

class BattleParser(private val repo: OverlayRepository) {

    private val keyed: List<Pair<String, PokemonData>> by lazy {
        repo.allPokemon.map { NameKey.of(it.name) to it }
    }

    fun parse(lines: List<OcrLine>): List<Opponent> = lines.mapNotNull { line ->
        val m = LINE_REGEX.find(line.text.trim()) ?: return@mapNotNull null
        val level = m.groupValues[2].toIntOrNull() ?: return@mapNotNull null
        val mon = match(NameKey.of(m.groupValues[1])) ?: return@mapNotNull null
        Opponent(mon, level, line)
    }

    /** Groups by species in first-seen order; a group is caught if any member is. */
    fun group(opps: List<Opponent>, caught: (Opponent) -> Boolean): List<OpponentGroup> =
        opps.groupBy { it.pokemon.id }.values.map { g ->
            OpponentGroup(
                pokemon = g.first().pokemon,
                count = g.size,
                minLevel = g.minOf { it.level },
                maxLevel = g.maxOf { it.level },
                caught = g.any(caught),
            )
        }

    private fun match(key: String): PokemonData? {
        if (key.isEmpty()) return null
        repo.pokemonByName(key)?.let { return it }
        if (key.length < MIN_FUZZY_LEN) return null
        var best = Int.MAX_VALUE
        var bestMon: PokemonData? = null
        var ties = 0
        for ((k, mon) in keyed) {
            val d = levenshtein(key, k)
            if (d < best) {
                best = d; bestMon = mon; ties = 1
            } else if (d == best) {
                ties++
            }
        }
        return if (best <= MAX_DISTANCE && ties == 1) bestMon else null
    }

    private fun levenshtein(a: String, b: String): Int {
        var prev = IntArray(b.length + 1) { it }
        var cur = IntArray(b.length + 1)
        for (i in 1..a.length) {
            cur[0] = i
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                cur[j] = minOf(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
            }
            val t = prev; prev = cur; cur = t
        }
        return prev[b.length]
    }

    companion object {
        private val LINE_REGEX = Regex("""^(.+?)\s+(?:Lv|Nv|Niv|Lvl)\.?\s*(\d{1,3})\b""")
        private const val MIN_FUZZY_LEN = 5
        private const val MAX_DISTANCE = 2
    }
}
