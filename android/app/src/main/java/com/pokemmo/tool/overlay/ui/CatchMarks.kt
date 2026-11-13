package com.pokemmo.tool.overlay.ui

import com.pokemmo.tool.overlay.data.Spawn

/** How a Pokémon is caught, shown as a tiny pixel mark under its icon. Declared in display order. */
enum class CatchMark { GRASS, SURF, ROD, CAVE, SPECIAL }

/**
 * The mark for an encounter method, ignoring any time-of-day suffix ("Grass (Night)").
 * Lures need an item, so they get no mark (null). Unknown methods are SPECIAL, never dropped.
 */
fun markOf(method: String): CatchMark? {
    val base = method.substringBefore(" (").trim().lowercase()
    return when {
        base.startsWith("lure") -> null
        base == "grass" || base == "dark grass" || base == "shadow" -> CatchMark.GRASS
        base == "water" -> CatchMark.SURF
        base.endsWith("rod") || base == "fishing" -> CatchMark.ROD
        base == "cave" || base == "inside" || base == "dust cloud" -> CatchMark.CAVE
        else -> CatchMark.SPECIAL
    }
}

/** Distinct marks for a spawn, in display order. */
fun marksFor(spawn: Spawn): List<CatchMark> =
    spawn.encounters.mapNotNull { markOf(it.method) }.distinct().sorted()

/** True when every encounter needs a lure (and there is at least one). */
fun isLureOnly(spawn: Spawn): Boolean =
    spawn.encounters.isNotEmpty() && spawn.encounters.all { markOf(it.method) == null }
