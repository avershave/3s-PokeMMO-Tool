package com.pokemmo.tool.overlay.ui

import com.pokemmo.tool.overlay.capture.IntRect
import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.state.ScreenState

/**
 * Whether a touch outside the card (at screen position [rawX], [rawY]) closes it. Touches on the
 * drawer are left to the drawer, so tapping the open Pokémon again still closes its card and
 * tapping another one switches to it. Touches on other apps' windows arrive as 0,0, which is never
 * on the centred drawer.
 */
fun outsideTapClosesCard(rawX: Float, rawY: Float, drawer: IntRect?): Boolean {
    if (drawer == null) return true
    val onDrawer = rawX >= drawer.left && rawX < drawer.right && rawY >= drawer.top && rawY < drawer.bottom
    return !onDrawer
}

/** Same region and place, whatever season's spawns each carries. */
fun samePlace(a: Area?, b: Area?): Boolean = a?.region == b?.region && a?.name == b?.name

data class Visible(val drawer: Boolean, val card: Boolean, val panel: Boolean)

/**
 * Which overlay windows show. The drawer (tab included) gets out of the way as soon as a battle is
 * suspected (any opponent line read), before the state machine confirms it, so it never covers horde
 * name boxes when the whole screen is shared. The card needs an open drawer; the panel needs a battle.
 */
fun visibility(state: ScreenState, battleSuspected: Boolean, drawerOpen: Boolean, cardOpen: Boolean): Visible {
    val drawer = state !is ScreenState.Battle && !battleSuspected
    return Visible(
        drawer = drawer,
        card = drawer && drawerOpen && cardOpen && state is ScreenState.Overworld,
        panel = state is ScreenState.Battle,
    )
}
