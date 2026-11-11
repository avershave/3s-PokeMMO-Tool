package com.pokemmo.tool.overlay.ui

import androidx.compose.ui.graphics.Color

/** rgba(28,32,42,0.86), like the game's own top-right menu. */
val PanelBg = Color(0xDB1C202A)
val PanelText = Color(0xFFFFFFFF)
val PanelMuted = Color(0xFFCFD6E4)
val PanelGrey = Color(0xFF8F99AB)
val PanelDivider = Color(0x1FFFFFFF)
val SelectedBg = Color(0x29FFFFFF)

/** Not-worth-catching icons: greyscale at this alpha; their marks at [FADED_MARK_ALPHA]. */
const val FADED_ALPHA = 0.35f
const val FADED_MARK_ALPHA = 0.45f

private val TYPE_COLORS = mapOf(
    "normal" to 0xFF9A9A6E, "fire" to 0xFFE8742C, "water" to 0xFF4F8FE0,
    "electric" to 0xFFE8C42C, "grass" to 0xFF5FAF4A, "ice" to 0xFF6CC8C8,
    "fighting" to 0xFFC03028, "poison" to 0xFF9A4A9A, "ground" to 0xFFC9A752,
    "flying" to 0xFF8F7FE0, "psychic" to 0xFFE0507F, "bug" to 0xFF9AAA2A,
    "rock" to 0xFFA8913A, "ghost" to 0xFF6A5A92, "dragon" to 0xFF6A3AE8,
    "dark" to 0xFF6B5A4F, "steel" to 0xFFA8A8C0,
)

fun typeColor(type: String): Color = Color(TYPE_COLORS[type.lowercase()] ?: 0xFF777777)

fun TagKind.label(): String = when (this) {
    TagKind.PVP -> "PvP"
    TagKind.STORY -> "Story"
    TagKind.UTILITY -> "Utility"
    TagKind.EV -> "EV"
}

fun TagKind.labelColor(): Color = when (this) {
    TagKind.PVP -> Color(0xFFFF8A7A)
    TagKind.STORY -> Color(0xFF7FB8FF)
    TagKind.UTILITY -> Color(0xFF8FE08F)
    TagKind.EV -> Color(0xFFAAB3C2)
}
