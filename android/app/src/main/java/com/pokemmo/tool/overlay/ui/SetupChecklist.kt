package com.pokemmo.tool.overlay.ui

/** Permission state shown on the main screen. Pure so it can be unit tested. */
data class SetupState(
    val overlayGranted: Boolean,
    val notificationsGranted: Boolean,
    val capturing: Boolean,
)

data class ChecklistItem(val label: String, val done: Boolean)

object SetupChecklist {
    fun items(s: SetupState): List<ChecklistItem> = listOf(
        ChecklistItem("Display over other apps", s.overlayGranted),
        ChecklistItem("Notifications", s.notificationsGranted),
        ChecklistItem("Overlay running", s.capturing),
    )

    /** Start needs the overlay permission and is pointless while already running. */
    fun startEnabled(s: SetupState): Boolean = s.overlayGranted && !s.capturing

    fun stopEnabled(s: SetupState): Boolean = s.capturing
}
