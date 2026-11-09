package com.pokemmo.tool.overlay.capture

/** Plain rectangle (no android.graphics dependency, so it is unit-testable on the JVM). */
data class FRect(val left: Float, val top: Float, val right: Float, val bottom: Float) {
    fun intersects(o: FRect): Boolean =
        left < o.right && o.left < right && top < o.bottom && o.top < bottom

    fun toPixels(width: Int, height: Int): IntRect = IntRect(
        (left * width).toInt(),
        (top * height).toInt(),
        (right * width).toInt(),
        (bottom * height).toInt(),
    )
}

data class IntRect(val left: Int, val top: Int, val right: Int, val bottom: Int) {
    val width get() = right - left
    val height get() = bottom - top
}

/** Fractions of the landscape screen, taken from the reference screenshots. */
object ScreenRegions {
    // OCR regions.
    val ROUTE = FRect(0.03f, 0.00f, 0.26f, 0.055f)
    val BATTLE = FRect(0.00f, 0.08f, 0.86f, 0.28f)

    // Overlay regions. The strip is shown in the overworld, the panel during battle.
    val STRIP_AREA = FRect(0.27f, 0.00f, 0.735f, 0.10f)
    val BATTLE_PANEL = FRect(0.01f, 0.29f, 0.205f, 0.71f)
}
