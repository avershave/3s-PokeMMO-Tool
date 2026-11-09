package com.pokemmo.tool.overlay.data

/** Normalizes names for lookups: lowercase, keeps a-z plus the gender symbols, drops the rest. */
object NameKey {
    fun of(s: String): String = buildString(s.length) {
        for (c in s.lowercase()) {
            if (c in 'a'..'z' || c == '♀' || c == '♂') append(c)
        }
    }
}
