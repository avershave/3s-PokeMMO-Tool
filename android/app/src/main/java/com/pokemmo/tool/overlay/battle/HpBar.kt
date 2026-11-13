package com.pokemmo.tool.overlay.battle

/**
 * Reads an opponent's HP bar from screen pixels. The bar sits under the name line: a light hatched
 * track with a dark border round the inner bar, filled from the left in green, yellow or red. The
 * fill's length over the inner bar's full length is the fraction of HP left.
 *
 * Measured on a Pixel 9 Pro XL (2244 px wide: inner bar 277 px) and a 2392 px reference screenshot
 * (horde: 0.124 of the width), so the inner length is taken as a fraction of the screen width.
 */
object HpBar {
    const val INNER_WIDTH = 0.1234f

    private const val MIN_ROWS = 4

    /**
     * HP left (0..1) in the bar under [box] (in the coordinates of [pixels], ARGB, [w] x [h]), or
     * null when no bar is found there. [screenW] is the full screen width.
     */
    fun read(pixels: IntArray, w: Int, h: Int, box: OcrLine, screenW: Int): Float? {
        val boxH = (box.bottom - box.top).coerceAtLeast(1)
        val y0 = box.bottom.coerceIn(0, h - 1)
        val y1 = (box.bottom + 3 * boxH).coerceIn(0, h - 1)
        val x0 = (box.left - 0.06f * screenW).toInt().coerceIn(1, w - 1)
        val x1 = (box.left + 0.18f * screenW).toInt().coerceIn(0, w - 1)
        if (y1 <= y0 || x1 <= x0) return null

        // Per row: fill runs that start just right of a neutral (border) pixel.
        val runs = HashMap<Int, MutableList<Int>>() // start x -> lengths
        val tops = HashMap<Int, Int>() // start x -> topmost row
        for (y in y0..y1) {
            val row = y * w
            var x = x0
            while (x <= x1) {
                if (isFill(pixels[row + x]) && isNeutral(pixels[row + x - 1])) {
                    var e = x
                    while (e + 1 < w && isFill(pixels[row + e + 1])) e++
                    runs.getOrPut(x) { mutableListOf() }.add(e - x + 1)
                    tops.putIfAbsent(x, y)
                    x = e + 1
                } else {
                    x++
                }
            }
        }
        // The bar: the start with the most rows, above which the light track shows.
        val lengths = runs.entries
            .filter { it.value.size >= MIN_ROWS && hasTrackAbove(pixels, w, it.key, tops.getValue(it.key)) }
            .maxByOrNull { it.value.size }
            ?.value
            ?: return null
        val len = lengths.sorted()[lengths.size / 2]
        val fraction = len / (INNER_WIDTH * screenW)
        return if (fraction > 1.1f) null else fraction.coerceIn(0f, 1f)
    }

    private fun hasTrackAbove(pixels: IntArray, w: Int, x: Int, top: Int): Boolean {
        for (k in 2..12) {
            val y = top - k
            if (y < 0) return false
            val c = pixels[y * w + minOf(x + 1, w - 1)]
            if (isNeutral(c) && value(c) >= 80) return true
        }
        return false
    }

    private fun value(c: Int) = maxOf(c shr 16 and 0xFF, c shr 8 and 0xFF, c and 0xFF)

    /** Grey: the track, its hatching and the dark border. */
    internal fun isNeutral(c: Int): Boolean {
        val r = c shr 16 and 0xFF; val g = c shr 8 and 0xFF; val b = c and 0xFF
        return maxOf(r, g, b) - minOf(r, g, b) <= 12
    }

    /** Green, yellow or red (not blue, purple or pink), saturated enough to be the fill, even dimmed. */
    internal fun isFill(c: Int): Boolean {
        val r = c shr 16 and 0xFF; val g = c shr 8 and 0xFF; val b = c and 0xFF
        val mx = maxOf(r, g, b); val mn = minOf(r, g, b)
        return mx - mn >= 24 && mx >= 50 && b - mn <= (mx - mn) / 2
    }
}
