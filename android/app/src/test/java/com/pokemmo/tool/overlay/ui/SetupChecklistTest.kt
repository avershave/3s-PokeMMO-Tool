package com.pokemmo.tool.overlay.ui

import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue

class SetupChecklistTest {
    @Test
    fun startDisabledWithoutOverlayPermission() {
        assertFalse(SetupChecklist.startEnabled(SetupState(false, true, false)))
    }

    @Test
    fun startEnabledWhenGrantedAndIdle() {
        assertTrue(SetupChecklist.startEnabled(SetupState(true, false, false)))
    }

    @Test
    fun startDisabledWhileCapturingAndStopEnabled() {
        val s = SetupState(true, true, true)
        assertFalse(SetupChecklist.startEnabled(s))
        assertTrue(SetupChecklist.stopEnabled(s))
        assertFalse(SetupChecklist.stopEnabled(s.copy(capturing = false)))
    }

    @Test
    fun itemsReflectState() {
        val items = SetupChecklist.items(SetupState(true, false, true))
        assertEquals(listOf(true, false, true), items.map { it.done })
    }
}
