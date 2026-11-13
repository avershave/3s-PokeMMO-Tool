package com.pokemmo.tool.overlay.match

/** The in-game season, shown under the place name: "Mon 21:35 · Autumn · Clear". */
enum class Season {
    Spring, Summer, Autumn, Winter;

    companion object {
        private val WORD = Regex("[A-Za-z]+")

        /**
         * The season named in an OCR line, or null. Allows one misread letter, and "rn" read
         * for "m". All four names are 6 letters and far apart, so this cannot pick the wrong one.
         */
        fun find(line: String): Season? {
            for (w in WORD.findAll(line)) {
                val word = w.value.lowercase()
                if (word.length !in 5..8) continue
                val variants = setOf(word, word.replace("rn", "m"))
                entries.firstOrNull { s ->
                    variants.any { editDistance(it, s.name.lowercase()) <= 1 }
                }?.let { return it }
            }
            return null
        }

        private fun editDistance(a: String, b: String): Int {
            var prev = IntArray(b.length + 1) { it }
            for (i in 1..a.length) {
                val cur = IntArray(b.length + 1)
                cur[0] = i
                for (j in 1..b.length) {
                    val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                    cur[j] = minOf(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
                }
                prev = cur
            }
            return prev[b.length]
        }
    }
}
