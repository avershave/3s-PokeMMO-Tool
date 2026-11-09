package com.pokemmo.tool.overlay.data

/** Normalizes names for lookups: lowercase, keeps a-z, 0-9 and the gender symbols, drops the rest. */
object NameKey {
    fun of(s: String): String = buildString(s.length) {
        for (c in s.lowercase()) {
            if (c in 'a'..'z' || c in '0'..'9' || c == '♀' || c == '♂') append(c)
        }
    }
}
