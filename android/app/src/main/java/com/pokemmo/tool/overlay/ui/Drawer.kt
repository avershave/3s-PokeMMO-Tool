package com.pokemmo.tool.overlay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokemmo.tool.overlay.capture.ScreenRegions
import kotlin.math.roundToInt
import kotlinx.coroutines.delay

// --- Pure layout rules (unit-tested) ---

private const val ART_PX = 32

/**
 * Icon edge in px: [ScreenRegions.ICON_FRACTION] of the long side, snapped to the nearest whole
 * multiple of the 32 px art so nearest-neighbour scaling stays even. Below 32 px it stays exact.
 */
fun iconSizePx(w: Int, h: Int): Int {
    val raw = ScreenRegions.ICON_FRACTION * maxOf(w, h)
    if (raw < ART_PX) return raw.toInt()
    return (raw / ART_PX).roundToInt().coerceAtLeast(1) * ART_PX
}

/** Catch marks are 8x8 art; a quarter of the icon keeps them at a whole scale (16 px under 64). */
fun markSizePx(iconPx: Int): Int = maxOf(1, iconPx / 4)

const val MARK_GAP_PX = 2

fun slotsPerRow(widthPx: Int, slotPx: Int): Int = maxOf(1, widthPx / maxOf(1, slotPx))

/** [shown] icons are drawn; when [more] > 0 a "+N" slot follows them. */
data class DrawerSlots(val shown: Int, val more: Int)

/** Two rows at most, unless the player asked to see everything. */
fun drawerSlots(count: Int, perRow: Int, showAll: Boolean): DrawerSlots {
    val cap = 2 * perRow
    if (showAll || count <= cap) return DrawerSlots(count, 0)
    val shown = cap - 1
    return DrawerSlots(shown, count - shown)
}

data class TabFrame(val index: Int, val frame: Int)

/** The closed tab advances one icon every 3 ticks (1.5 s at 500 ms) and bounces 0, 1, 0. */
fun tabFrame(tick: Long, cycleSize: Int): TabFrame {
    val index = if (cycleSize <= 0) 0 else ((tick / 3) % cycleSize).toInt()
    return TabFrame(index, ((tick % 3) % 2).toInt())
}

const val TAB_TICK_MS = 500L

// --- Views ---

/** Hangs from the top edge: only the bottom corners are rounded. */
private fun hanging(r: Dp) = RoundedCornerShape(topStart = 0.dp, topEnd = 0.dp, bottomStart = r, bottomEnd = r)

private fun Modifier.panelBg(panel: Boolean, shape: RoundedCornerShape) =
    if (panel) background(PanelBg, shape) else this

/**
 * The route drawer, top centre. Closed: a small tab cycling the worth-catching icons (or a still
 * Poké Ball). Open: up to two rows of icons with catch marks, above the tab, which closes it.
 * No text that could look like a battle line is ever drawn here.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DrawerView(
    model: DrawerModel,
    open: Boolean,
    selectedId: Int?,
    panel: Boolean,
    icons: IconCache,
    iconSize: Dp,
    maxWidth: Dp,
    showAll: Boolean,
    maxBodyHeight: Dp,
    onTab: () -> Unit,
    onItem: (Int) -> Unit,
    onOverflow: () -> Unit,
) {
    PanelStyle(panel) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            if (open) {
                DrawerBody(model, selectedId, panel, icons, iconSize, maxWidth, showAll, maxBodyHeight, onItem, onOverflow)
            }
            DrawerTab(model, open, panel, icons, iconSize, onTab)
        }
    }
}

@Composable
private fun DrawerTab(model: DrawerModel, open: Boolean, panel: Boolean, icons: IconCache, iconSize: Dp, onTab: () -> Unit) {
    var tick by remember { mutableLongStateOf(0L) }
    val cycling = !open && model.cycle.isNotEmpty()
    LaunchedEffect(cycling, model.cycle) {
        tick = 0
        while (cycling) {
            delay(TAB_TICK_MS)
            tick++
        }
    }
    Box(
        Modifier
            .panelBg(panel, hanging(iconSize * 0.2f))
            .clickable(remember { MutableInteractionSource() }, indication = null) { onTab() }
            .padding(horizontal = iconSize * 0.25f, vertical = 1.dp),
        contentAlignment = Alignment.Center,
    ) {
        when {
            open -> PixelArtView(CHEVRON_UP, iconSize * 0.4f, Modifier.padding(vertical = iconSize * 0.05f))
            cycling -> {
                val f = tabFrame(tick, model.cycle.size)
                PixelIcon(icons, model.cycle[f.index], iconSize, frame = f.frame)
            }
            else -> BallIcon(icons, caught = true, size = iconSize)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DrawerBody(
    model: DrawerModel,
    selectedId: Int?,
    panel: Boolean,
    icons: IconCache,
    iconSize: Dp,
    maxWidth: Dp,
    showAll: Boolean,
    maxBodyHeight: Dp,
    onItem: (Int) -> Unit,
    onOverflow: () -> Unit,
) {
    val gap = iconSize * 0.06f
    val pad = iconSize * 0.15f
    val density = LocalDensity.current
    val perRow = with(density) { slotsPerRow((maxWidth - pad * 2).roundToPx(), (iconSize + gap).roundToPx()) }
    val slots = drawerSlots(model.items.size, perRow, showAll)
    Box(
        // Only as wide as its icons (the window centres it), so a short row leaves no empty end.
        Modifier
            .widthIn(max = maxWidth)
            .then(if (showAll) Modifier.heightIn(max = maxBodyHeight) else Modifier)
            .panelBg(panel, hanging(iconSize * 0.3f))
            .then(if (showAll) Modifier.verticalScroll(rememberScrollState()) else Modifier)
            .padding(horizontal = pad, vertical = pad * 0.6f),
    ) {
        if (model.empty) {
            Text(NO_WILD_TEXT, color = PanelMuted, fontSize = 12.sp, modifier = Modifier.padding(4.dp))
        } else {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(gap, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(gap),
            ) {
                model.items.take(slots.shown).forEach { item ->
                    DrawerSlot(item, item.id == selectedId, icons, iconSize) { onItem(item.id) }
                }
                if (slots.more > 0) MoreSlot(slots.more, iconSize, onOverflow)
            }
        }
    }
}

@Composable
private fun DrawerSlot(item: DrawerItem, selected: Boolean, icons: IconCache, iconSize: Dp, onClick: () -> Unit) {
    val density = LocalDensity.current
    val markSize = with(density) { markSizePx(iconSize.roundToPx()).toDp() }
    val markGap = with(density) { MARK_GAP_PX.toDp() }
    val pull = iconSize * 0.08f
    Column(
        Modifier
            .width(iconSize)
            .then(if (selected) Modifier.background(SelectedBg, RoundedCornerShape(iconSize * 0.15f)) else Modifier)
            .clickable(remember { MutableInteractionSource() }, indication = null) { onClick() },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PixelIcon(icons, item.id, iconSize, faded = !item.worth)
        // The icon art leaves empty rows at the bottom; tuck the marks up into them.
        Row(
            Modifier
                .layout { m, c ->
                    val p = m.measure(c)
                    val up = pull.roundToPx()
                    layout(p.width, (p.height - up).coerceAtLeast(0)) { p.place(0, -up) }
                }
                .padding(bottom = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(markGap),
        ) {
            item.marks.forEach { CatchMarkIcon(it, markSize, faded = !item.worth) }
        }
    }
}

@Composable
private fun MoreSlot(more: Int, iconSize: Dp, onClick: () -> Unit) {
    Box(
        Modifier
            .size(iconSize)
            .clickable(remember { MutableInteractionSource() }, indication = null) { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "+$more",
            color = PanelText,
            fontSize = 12.sp,
            modifier = Modifier
                .background(Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}
