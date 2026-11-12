package com.pokemmo.tool.overlay.state

import com.pokemmo.tool.overlay.battle.OpponentGroup
import com.pokemmo.tool.overlay.data.Area

sealed interface ScreenState {
    data object Idle : ScreenState
    data class Overworld(val area: Area) : ScreenState
    data class Battle(val groups: List<OpponentGroup>, val area: Area?) : ScreenState
}

class ScreenStateMachine {
    private var confirmedArea: Area? = null
    private var candidateArea: Area? = null
    private var candidateTicks = 0

    private var battleTicks = 0
    private var emptyTicks = 0
    private var battle: ScreenState.Battle? = null

    /** [routeExact]: the route line read as exactly a known name, so it is trusted at once. */
    fun onTick(route: Area?, opponents: List<OpponentGroup>, routeExact: Boolean = false): ScreenState {
        val inBattle = battle
        if (inBattle != null) {
            // Route ticks during a battle are ignored; only opponents decide when it ends.
            if (opponents.isNotEmpty()) {
                emptyTicks = 0
                battle = inBattle.copy(groups = opponents)
            } else if (++emptyTicks >= BATTLE_EXIT_TICKS) {
                battle = null
                emptyTicks = 0
                battleTicks = 0
                return overworldOrIdle()
            }
            return battle!!
        }

        updateRoute(route, routeExact)

        if (opponents.isNotEmpty()) {
            if (++battleTicks >= BATTLE_ENTER_TICKS) {
                battleTicks = 0
                emptyTicks = 0
                val b = ScreenState.Battle(opponents, confirmedArea)
                battle = b
                return b
            }
        } else {
            battleTicks = 0
        }
        return overworldOrIdle()
    }

    /** A null route is "no information": it neither clears nor disturbs a pending change. */
    private fun updateRoute(route: Area?, exact: Boolean) {
        if (route == null) return
        if (route == confirmedArea || exact) {
            confirmedArea = route
            candidateArea = null
            candidateTicks = 0
            return
        }
        if (route == candidateArea) {
            candidateTicks++
        } else {
            candidateArea = route
            candidateTicks = 1
        }
        if (candidateTicks >= ROUTE_CONFIRM_TICKS) {
            confirmedArea = route
            candidateArea = null
            candidateTicks = 0
        }
    }

    private fun overworldOrIdle(): ScreenState =
        confirmedArea?.let { ScreenState.Overworld(it) } ?: ScreenState.Idle

    companion object {
        const val BATTLE_ENTER_TICKS = 2
        const val BATTLE_EXIT_TICKS = 3
        const val ROUTE_CONFIRM_TICKS = 2
    }
}
