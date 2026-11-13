package com.pokemmo.tool.overlay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlaySettingsTest {
    private class FakeStore : KeyValue {
        val map = HashMap<String, Boolean>()
        override fun getBoolean(k: String, d: Boolean) = map[k] ?: d
        override fun putBoolean(k: String, v: Boolean) {
            map[k] = v
        }
        val ints = HashMap<String, Int>()
        override fun getInt(k: String, d: Int) = ints[k] ?: d
        override fun putInt(k: String, v: Int) {
            ints[k] = v
        }
    }

    @Test
    fun `the panel offset starts at zero and is saved`() {
        val store = FakeStore()
        OverlaySettings.init(store)
        assertEquals(0 to 0, OverlaySettings.panelOffset)
        OverlaySettings.setPanelOffset(-120, 40)
        OverlaySettings.init(store)
        assertEquals(-120 to 40, OverlaySettings.panelOffset)
    }

    @Test
    fun `the panel is on by default`() {
        OverlaySettings.init(FakeStore())
        assertTrue(OverlaySettings.panelBackground.value)
    }

    @Test
    fun `turning it off updates the flow and the store`() {
        val store = FakeStore()
        OverlaySettings.init(store)
        OverlaySettings.setPanelBackground(false)
        assertFalse(OverlaySettings.panelBackground.value)
        assertEquals(false, store.map["panel_background"])
    }

    @Test
    fun `a new init reads the saved value`() {
        val store = FakeStore()
        OverlaySettings.init(store)
        OverlaySettings.setPanelBackground(false)
        OverlaySettings.init(FakeStore())
        assertTrue(OverlaySettings.panelBackground.value)
        OverlaySettings.init(store)
        assertFalse(OverlaySettings.panelBackground.value)
    }
}
