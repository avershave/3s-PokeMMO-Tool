package com.pokemmo.tool.overlay.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Process-wide channel from CaptureService to the overlay UI, so the UI needs no binding. */
object OverlayStateBus {
    private val _state = MutableStateFlow<ScreenState>(ScreenState.Idle)
    val state: StateFlow<ScreenState> = _state.asStateFlow()

    private val _capturing = MutableStateFlow(false)
    val capturing: StateFlow<Boolean> = _capturing.asStateFlow()

    fun publish(s: ScreenState) {
        _state.value = s
    }

    fun setCapturing(on: Boolean) {
        _capturing.value = on
        if (!on) _state.value = ScreenState.Idle
    }
}
