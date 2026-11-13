package com.pokemmo.tool.overlay.battle

/** Detects the Poke Ball icon after a name box: red top half over white bottom half. */
object CaughtDetector {
    // Tunable on device.
    const val MIN_RED_FRACTION = 0.08
    const val MIN_WHITE_FRACTION = 0.08

    fun isCaught(argb: IntArray, width: Int, height: Int, line: OcrLine): Boolean {
        val h = line.bottom - line.top
        if (h <= 0) return false
        val x0 = maxOf(line.right, 0)
        val x1 = minOf(line.right + 3 * h, width)
        val y0 = maxOf(line.top, 0)
        val y1 = minOf(line.bottom, height)
        if (x0 >= x1 || y0 >= y1) return false
        val mid = (y0 + y1) / 2

        var red = 0
        var redTotal = 0
        var white = 0
        var whiteTotal = 0
        for (y in y0 until y1) {
            for (x in x0 until x1) {
                val p = argb[y * width + x]
                val r = (p shr 16) and 0xFF
                val g = (p shr 8) and 0xFF
                val b = p and 0xFF
                if (y < mid) {
                    redTotal++
                    if (r > 170 && g < 90 && b < 90) red++
                } else {
                    whiteTotal++
                    if (r > 200 && g > 200 && b > 200) white++
                }
            }
        }
        if (redTotal == 0 || whiteTotal == 0) return false
        return red.toDouble() / redTotal >= MIN_RED_FRACTION &&
            white.toDouble() / whiteTotal >= MIN_WHITE_FRACTION
    }
}
