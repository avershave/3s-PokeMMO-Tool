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
    // OCR regions. ROUTE takes the place name and the clock line under it ("Mon 21:35 · Autumn").
    val ROUTE = FRect(0.03f, 0.00f, 0.26f, 0.085f)
    val BATTLE = FRect(0.00f, 0.08f, 0.86f, 0.28f)

    // Overlay regions. The drawer and card are shown in the overworld, the panel during battle.
    // DRAWER_AREA: its width is the drawer and card width; its bottom is the lowest the card may reach.
    // It overlaps BATTLE, which is fine: they are hidden as soon as a battle is suspected.
    val DRAWER_AREA = FRect(0.28f, 0.00f, 0.72f, 0.42f)
    val BATTLE_PANEL = FRect(0.01f, 0.29f, 0.205f, 0.71f)

    /**
     * The lowest the card may reach, as a fraction of the height. The card is only open in the
     * overworld, where only ROUTE must stay clear, so it may run well below DRAWER_AREA.
     */
    const val CARD_MAX_BOTTOM = 0.9f

    /** Pokémon icon edge as a fraction of the screen's long side (about 56 px on 2244 px). */
    const val ICON_FRACTION = 0.025f
}
