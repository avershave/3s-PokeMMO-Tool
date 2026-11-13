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
    // DRAWER_AREA: the drawer's widest and tallest; it runs from the route name to the icons at the
    // top right. It overlaps BATTLE, which is fine: it is hidden as soon as a battle is suspected.
    val DRAWER_AREA = FRect(0.27f, 0.00f, 0.79f, 0.50f)
    // Over the player's own Pokémon: between the two move columns (the move menu), below the
    // opponent names and left of the opponents themselves (horde sprites start near 0.52).
    val BATTLE_PANEL = FRect(0.27f, 0.29f, 0.53f, 0.71f)

    /**
     * The card's left and right edges: from just right of the D-pad to the right edge of the old,
     * centred 66% card. Its top comes from the drawer, its bottom from CARD_MAX_BOTTOM.
     */
    val CARD_AREA = FRect(0.28f, 0.00f, 0.86f, 0.90f)

    // The game's on-screen controls, which the overlay must leave free. DPAD is the overworld's;
    // MOVES_LEFT/RIGHT are the two columns of the battle move menu (Pixel 9 Pro XL screenshot).
    val DPAD = FRect(0.13f, 0.56f, 0.27f, 0.87f)
    val MOVES_LEFT = FRect(0.00f, 0.32f, 0.26f, 0.67f)
    val MOVES_RIGHT = FRect(0.80f, 0.32f, 1.00f, 0.67f)

    /** Everything drawn (text, spacing, icons) is this many times the base design size. */
    const val UI_SCALE = 1.5f

    /**
     * The lowest the card may reach, as a fraction of the height. The card is only open in the
     * overworld, where only ROUTE must stay clear, so it may run well below DRAWER_AREA.
     */
    const val CARD_MAX_BOTTOM = 0.9f

    /** Pokémon icon edge as a fraction of the screen's long side (about 84 px on 2244 px, so 96). */
    const val ICON_FRACTION = 0.025f * UI_SCALE
}
