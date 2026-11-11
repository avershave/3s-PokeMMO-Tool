package com.pokemmo.tool.overlay.ui

import com.pokemmo.tool.overlay.state.ScreenState

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
