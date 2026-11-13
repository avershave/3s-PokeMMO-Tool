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
 * known: types, level, evolutions, base Speed); otherwise it says when [multiplier] applies, which
 * the screen can't show. [why]: for a ball that applies now with a bonus, the reason for it.
 * [upTo]: the bonus grows to [multiplier] (streaks, sleep, weight).
 */
data class BallValue(
    val ball: Ball,
    val multiplier: Float,
    val condition: String? = null,
    val upTo: Boolean = false,
    val why: String? = null,
)

/** One line of the ball list: name, chance, and the reason or condition ([note]). */
data class BallLine(val ball: Ball, val percent: Int, val note: String? = null, val upTo: Boolean = false)

/**
 * What the panel shows: Poké, Great and Ultra always ([basic]); [best], balls that beat Ultra
 * right now; [more], every other ball (best first), conditional ones only when they beat a Poké Ball.
 */
data class CatchView(val basic: List<BallLine>, val best: List<BallLine>, val more: List<BallLine>)

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
        add(BallValue(Ball.NET, if (p.types.any { it.equals("Water", true) || it.equals("Bug", true) }) 3.5f else 1f, why = "Water/Bug"))
        add(BallValue(Ball.NEST, (7f - 0.2f * (level - 1)).coerceIn(1f, 4f), why = "low level"))
        add(BallValue(Ball.MOON, if (p.moonStone) 4f else 1f, why = "Moon Stone line"))
        add(BallValue(Ball.FRIEND, if (p.friendship) 2.5f else 1f, why = "friendship line"))
        add(BallValue(Ball.FAST, if ((p.speed ?: 0) >= 100) 4f else 1f, why = "fast species"))
        add(BallValue(Ball.QUICK, 5f, "on turn 1"))
        add(BallValue(Ball.TIMER, 4f, "from turn 11"))
        add(BallValue(Ball.DUSK, 2.5f, "at night or in caves"))
        add(BallValue(Ball.DIVE, 3.5f, "surfing or fishing"))
        add(BallValue(Ball.LURE, 4f, "hooked on a rod"))
        add(BallValue(Ball.REPEAT, 2.5f, "on a catch streak", upTo = true))
        add(BallValue(Ball.LEVEL, 4f, "same level as yours"))
        add(BallValue(Ball.LOVE, 8f, "same family, other gender"))
        add(BallValue(Ball.DREAM, 4f, "while asleep", upTo = true))
        add(BallValue(Ball.HEAVY, 4f, "heavy species", upTo = true))
    }

    fun percent(chance: Float): Int = (chance * 100).roundToInt()

    private val BASIC = listOf(Ball.POKE, Ball.GREAT, Ball.ULTRA)

    fun view(p: PokemonData, level: Int, hp: Float, safari: Boolean, status: Float = 1f): CatchView? {
        val rate = p.catchRate ?: return null
        val lines = balls(p, level, safari).map { v ->
            val pct = percent(chance(rate, hp, v.multiplier, status))
            // A reason only when it earns a bonus ("Water/Bug" on a 1x Net Ball would mislead).
            val note = v.condition ?: v.why?.takeIf { v.multiplier > 1f }
            v to BallLine(v.ball, pct, note, v.upTo)
        }
        val byBall = lines.associate { it.first.ball to it.second }
        val basic = BASIC.map { byBall.getValue(it) }
        val ultra = byBall.getValue(Ball.ULTRA).percent
        val plain = byBall.getValue(Ball.POKE).percent
        val best = lines.filter { (v, l) -> v.condition == null && v.ball !in BASIC && l.percent > ultra }
            .map { it.second }.sortedByDescending { it.percent }
        val more = lines.filter { (v, l) ->
            v.ball !in BASIC && l !in best && (v.condition == null || l.percent > plain)
        }.map { it.second }.sortedByDescending { it.percent }
        return CatchView(basic, best, more)
    }
}
