package com.pokemmo.tool.overlay.battle

import com.pokemmo.tool.overlay.data.PokemonData
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sqrt

/** Every ball PokeMMO has except the Master Ball (always 100%). [key] names overlay/items/ball-<key>.png. */
enum class Ball(val key: String, val label: String) {
    POKE("poke", "Poké"), GREAT("great", "Great"), ULTRA("ultra", "Ultra"), PREMIER("premier", "Premier"),
    HEAL("heal", "Heal"), CHERISH("cherish", "Cherish"), LUXURY("luxury", "Luxury"), SAFARI("safari", "Safari"),
    NET("net", "Net"), NEST("nest", "Nest"), MOON("moon", "Moon"), FRIEND("friend", "Friend"), FAST("fast", "Fast"),
    QUICK("quick", "Quick"), TIMER("timer", "Timer"), DUSK("dusk", "Dusk"), DIVE("dive", "Dive"), LURE("lure", "Lure"),
    REPEAT("repeat", "Repeat"), LEVEL("level", "Level"), LOVE("love", "Love"), DREAM("dream", "Dream"), HEAVY("heavy", "Heavy"),
}

/**
 * One ball's multiplier. [condition] is null when it applies now (everything it depends on is
 * known: types, level, evolutions, base Speed); otherwise it names what the screen can't show, and
 * [multiplier] is the bonus when that holds. [upTo]: the bonus grows to [multiplier] (streaks, turns).
 */
data class BallValue(val ball: Ball, val multiplier: Float, val condition: String? = null, val upTo: Boolean = false)

/** Balls sharing one chance, shown as one chip. */
data class BallChip(val balls: List<Ball>, val percent: Int, val condition: String? = null, val upTo: Boolean = false)

/**
 * PokeMMO's catch maths: the Gen 3/4 capture formula with PokeMMO's own ball values (PokeMMO wiki,
 * Poké Ball page; formula and status values as in mmobreeder.com/catch-rate). Approximate: PokeMMO
 * doesn't publish its exact formula, and Fast/Heavy/Repeat/Dream are partly guessed by the wiki.
 */
object Catch {
    /**
     * Chance (0..1) to catch with catch [rate] at [hp] (fraction of max HP left) with a ball worth
     * [ball] and a status worth [status] (sleep/freeze 2, paralysis/burn/poison 1.5).
     */
    fun chance(rate: Int, hp: Float, ball: Float, status: Float = 1f): Float {
        if (rate <= 0) return 0f
        val f = hp.coerceIn(0f, 1f)
        val a = floor((3 - 2 * f) / 3.0 * rate * ball * status)
        if (a >= 255) return 1f
        val b = 1048560.0 / sqrt(sqrt(16711680.0 / a.coerceAtLeast(1.0)))
        return (b / 65536.0).pow(4).toFloat().coerceIn(0f, 1f)
    }

    fun balls(p: PokemonData, level: Int, safari: Boolean): List<BallValue> = buildList {
        add(BallValue(Ball.POKE, 1f))
        add(BallValue(Ball.GREAT, 1.5f))
        add(BallValue(Ball.ULTRA, 2f))
        add(BallValue(Ball.PREMIER, 1.5f))
        add(BallValue(Ball.HEAL, 1.25f))
        add(BallValue(Ball.CHERISH, 2f))
        add(BallValue(Ball.LUXURY, 1f))
        if (safari) add(BallValue(Ball.SAFARI, 1.5f))
        add(BallValue(Ball.NET, if (p.types.any { it.equals("Water", true) || it.equals("Bug", true) }) 3.5f else 1f))
        add(BallValue(Ball.NEST, (7f - 0.2f * (level - 1)).coerceIn(1f, 4f)))
        add(BallValue(Ball.MOON, if (p.moonStone) 4f else 1f))
        add(BallValue(Ball.FRIEND, if (p.friendship) 2.5f else 1f))
        add(BallValue(Ball.FAST, if ((p.speed ?: 0) >= 100) 4f else 1f))
        add(BallValue(Ball.QUICK, 5f, "turn 1"))
        add(BallValue(Ball.TIMER, 4f, "turn 11+"))
        add(BallValue(Ball.DUSK, 2.5f, "night/cave"))
        add(BallValue(Ball.DIVE, 3.5f, "surf/fish"))
        add(BallValue(Ball.LURE, 4f, "fishing"))
        add(BallValue(Ball.REPEAT, 2.5f, "streak", upTo = true))
        add(BallValue(Ball.LEVEL, 4f, "your level"))
        add(BallValue(Ball.LOVE, 8f, "other gender"))
        add(BallValue(Ball.DREAM, 4f, "asleep", upTo = true))
        add(BallValue(Ball.HEAVY, 4f, "heavy", upTo = true))
    }

    fun percent(chance: Float): Int = (chance * 100).roundToInt()

    /**
     * The balls that apply now, merged by percentage (best first), and the conditional ones, each on
     * its own (best first). Conditional balls no better than a plain Poké Ball are dropped.
     */
    fun chips(p: PokemonData, level: Int, hp: Float, safari: Boolean, status: Float = 1f): Pair<List<BallChip>, List<BallChip>> {
        val rate = p.catchRate ?: return emptyList<BallChip>() to emptyList()
        val values = balls(p, level, safari)
        val pct = { v: BallValue -> percent(chance(rate, hp, v.multiplier, status)) }
        val now = values.filter { it.condition == null }
            .groupBy(pct)
            .entries.sortedByDescending { it.key }
            .map { (percent, vs) -> BallChip(vs.map { it.ball }, percent) }
        val plain = percent(chance(rate, hp, 1f, status))
        val ifs = values.filter { it.condition != null }
            .map { BallChip(listOf(it.ball), pct(it), it.condition, it.upTo) }
            .filter { it.percent > plain }
            .sortedByDescending { it.percent }
        return now to ifs
    }
}
