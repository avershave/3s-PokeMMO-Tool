package com.pokemmo.tool.overlay.capture

/** Pure size rules for the capture loop (JVM-testable). */
object CaptureGeometry {
    fun needsResize(capW: Int, capH: Int, curW: Int, curH: Int): Boolean =
        curW > 0 && curH > 0 && (capW != curW || capH != curH)

    /** Regions are fractions of the landscape screen; portrait frames must not be read. */
    fun isLandscape(w: Int, h: Int): Boolean = w >= h

    /** The capture is always landscape-sized: the long side is the width. */
    fun landscapeWidth(w: Int, h: Int): Int = maxOf(w, h)

    fun landscapeHeight(w: Int, h: Int): Int = minOf(w, h)
}
