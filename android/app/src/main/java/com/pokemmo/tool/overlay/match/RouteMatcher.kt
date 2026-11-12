package com.pokemmo.tool.overlay.match

import com.pokemmo.tool.overlay.data.Area

/** Turns the OCR'd first line of the screen into a known [Area]. */
class RouteMatcher(private val areas: List<Area>) {

    private companion object {
        val REGION_ORDER = listOf("Kanto", "Johto", "Hoenn", "Sinnoh", "Unova")
        const val FUZZY_THRESHOLD = 0.85
        val GENERIC = listOf("city", "town", "forest", "cave", "road", "gate", "outside", "inside", "entrance", "exit")
        val DOT_CUT = Regex("\\s*[·•]\\s*")
        // OCR sometimes drops the dot entirely ("Vermilion City VILLAGE CH 5"), so a plain space
        // before a standalone "CH n" counts too. "CH" is often read as "GH" on the Pixel.
        val CHANNEL_MARKER = Regex("(?:[·•-]\\s*|\\s)[CG]H\\s*\\d+(?![A-Za-z0-9])", RegexOption.IGNORE_CASE)
        val ROUTE_NUM = Regex("route\\s*(\\d+)(?![A-Za-z0-9])", RegexOption.IGNORE_CASE)
        val ROUTE_LINE = Regex("^route\\b", RegexOption.IGNORE_CASE)
        val NON_ALNUM = Regex("[^a-z0-9]+")
        val ALL_CAPS = Regex("^\\p{Lu}{3,}$")
    }

    fun match(ocrLine: String, currentRegion: String?): Area? {
        val cleaned = clean(ocrLine)
        if (alnumCount(cleaned) < 3) return null
        val key = AliasKey.of(cleaned)

        val routeNum = ROUTE_NUM.find(cleaned)?.groupValues?.get(1)?.toIntOrNull()
        val pool = if (routeNum == null) areas else areas.filter { routeNumberOf(it) == routeNum }

        // AliasKey drops generic words (city, town...), so a typo in one survives into the key;
        // retry with generic words repaired.
        val repaired = repairGenericWords(cleaned)
        val fixedKey = AliasKey.of(repaired)
        val keys = listOf(key, fixedKey).filter { it.isNotEmpty() }.distinct()
        // The key drops generic words ("Oreburgh City" -> "oreburgh"), so a name that merely shares the
        // key ("Oreburgh Gate") must not match: candidates must contain the line's generic words too.
        val generics = words(repaired).filter { it in GENERIC }.toSet()
        fun sameGenerics(list: List<Area>) =
            if (generics.isEmpty()) list else list.filter { words(it.name).containsAll(generics) }
        // A route number is all-or-nothing: route lines never use the fuzzy fallback.
        val isRouteLine = ROUTE_LINE.containsMatchIn(cleaned)
        val candidates = keys.firstNotNullOfOrNull { k -> sameGenerics(pool.filter { it.key == k }).ifEmpty { null } }
            ?: (if (isRouteLine) null else keys.firstNotNullOfOrNull { k -> sameGenerics(fuzzy(pool, k)).ifEmpty { null } })
            ?: emptyList()

        if (candidates.isNotEmpty()) return choose(candidates, cleaned, currentRegion)

        // Every real route is in the data, so an unmatched route line is a misread: no synthetic area.
        if (!isRouteLine && CHANNEL_MARKER.containsMatchIn(ocrLine)) {
            return Area(currentRegion ?: "", cleaned, key, emptyList())
        }
        return null
    }

    /**
     * True when the line, once the place type and channel are cut, is exactly [area]'s name:
     * a read that clean is trusted on its own, without waiting for a second tick. Places not in
     * the data (a garbled line with a channel marker) are never exact.
     */
    fun isExact(ocrLine: String, area: Area): Boolean =
        areas.any { it === area } && clean(ocrLine).equals(area.name, ignoreCase = true)

    private fun clean(line: String): String {
        var s = DOT_CUT.split(line.trim(), 2).first().trim()
        // "Pallet Lab INSIDE - CH 2" / "... INSIDE CH 2" (dot misread as hyphen, or dropped).
        // Cut the channel first so the place-type word (INSIDE, VILLAGE...) is last.
        s = CHANNEL_MARKER.find(s)?.let { s.substring(0, it.range.first).trim() } ?: s
        val lastSpace = s.lastIndexOf(' ')
        if (lastSpace > 0) {
            val last = s.substring(lastSpace + 1)
            val rest = s.substring(0, lastSpace)
            if (ALL_CAPS.matches(last) && rest.any { it.isLowerCase() }) s = rest.trim()
        }
        return s
    }

    /** Whole lowercase words, like desktop tokenizeName. */
    private fun words(s: String): List<String> =
        s.lowercase().replace(NON_ALNUM, " ").split(' ').filter { it.isNotEmpty() }

    // Words that appear verbatim in some area name are never "repaired" into a generic word.
    private val nameWords: Set<String> by lazy { areas.flatMapTo(HashSet()) { words(it.name) } }

    private fun repairGenericWords(s: String): String =
        s.split(' ').joinToString(" ") { w ->
            val lw = w.lowercase()
            if (w.length < 4 || lw in GENERIC || lw in nameWords) w
            else GENERIC.firstOrNull { it.length >= 4 && levenshtein(lw, it) == 1 } ?: w
        }

    private fun alnumCount(s: String) = s.count { it.isLetterOrDigit() }

    private fun routeNumberOf(a: Area) =
        ROUTE_NUM.find(a.name)?.groupValues?.get(1)?.toIntOrNull()

    private fun fuzzy(pool: List<Area>, key: String): List<Area> {
        var best = 0.0
        var bestKeys = emptyList<String>()
        for (k in pool.map { it.key }.distinct()) {
            val sim = similarity(key, k)
            if (sim < FUZZY_THRESHOLD) continue
            if (sim > best) {
                best = sim
                bestKeys = listOf(k)
            } else if (sim == best) {
                bestKeys = bestKeys + k
            }
        }
        return pool.filter { it.key in bestKeys }
    }

    private fun choose(candidates: List<Area>, cleaned: String, currentRegion: String?): Area {
        val regions = candidates.map { it.region }.distinct()
        val region = when {
            currentRegion != null && currentRegion in regions -> currentRegion
            regions.size == 1 -> regions.first()
            else -> regions.minByOrNull {
                REGION_ORDER.indexOf(it).let { i -> if (i < 0) Int.MAX_VALUE else i }
            }!!
        }
        val inRegion = candidates.filter { it.region == region }
        // Exact name first, then the name closest to the text (not the shortest: a typo'd
        // "Cerulean Clty" must not fall to "Cerulean Cave" just because it is shorter).
        val text = cleaned.lowercase()
        return inRegion.firstOrNull { it.name.equals(cleaned, ignoreCase = true) }
            ?: inRegion.sortedBy { it.name.length }.maxByOrNull { similarity(text, it.name.lowercase()) }!!
    }

    private fun similarity(a: String, b: String): Double {
        val max = maxOf(a.length, b.length)
        if (max == 0) return 1.0
        return 1.0 - levenshtein(a, b).toDouble() / max
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
}
