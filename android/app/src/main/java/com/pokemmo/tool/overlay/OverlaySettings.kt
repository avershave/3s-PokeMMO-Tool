package com.pokemmo.tool.overlay

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Minimal key-value store, so the settings are testable without Android. */
interface KeyValue {
    fun getBoolean(k: String, d: Boolean): Boolean
    fun putBoolean(k: String, v: Boolean)
    fun getInt(k: String, d: Int): Int = d
    fun putInt(k: String, v: Int) = Unit
}

private class PrefsStore(context: Context) : KeyValue {
    private val prefs = context.getSharedPreferences("overlay", Context.MODE_PRIVATE)
    override fun getBoolean(k: String, d: Boolean) = prefs.getBoolean(k, d)
    override fun putBoolean(k: String, v: Boolean) {
        prefs.edit().putBoolean(k, v).apply()
    }
    override fun getInt(k: String, d: Int) = prefs.getInt(k, d)
    override fun putInt(k: String, v: Int) {
        prefs.edit().putInt(k, v).apply()
    }
}

/** App settings, saved on the phone and applied live to a running overlay. */
object OverlaySettings {
    private const val PANEL_BACKGROUND = "panel_background"
    private const val PANEL_DX = "panel_dx"
    private const val PANEL_DY = "panel_dy"

    private var store: KeyValue? = null
    private val _panelBackground = MutableStateFlow(true)

    /** The dark see-through panel behind the drawer, card and battle panel. On by default. */
    val panelBackground: StateFlow<Boolean> = _panelBackground.asStateFlow()

    fun init(store: KeyValue) {
        this.store = store
        _panelBackground.value = store.getBoolean(PANEL_BACKGROUND, true)
    }

    /** Safe to call from every entry point (activity and service); only the first call loads. */
    fun ensureInit(context: Context) {
        if (store == null) init(PrefsStore(context.applicationContext))
    }

    /** Where the player dragged the battle panel, in px from its default spot (0, 0 = not moved). */
    val panelOffset: Pair<Int, Int>
        get() = (store?.getInt(PANEL_DX, 0) ?: 0) to (store?.getInt(PANEL_DY, 0) ?: 0)

    fun setPanelOffset(dx: Int, dy: Int) {
        store?.putInt(PANEL_DX, dx)
        store?.putInt(PANEL_DY, dy)
    }

    fun setPanelBackground(v: Boolean) {
        store?.putBoolean(PANEL_BACKGROUND, v)
        _panelBackground.value = v
    }
}
