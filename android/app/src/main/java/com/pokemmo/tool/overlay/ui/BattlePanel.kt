package com.pokemmo.tool.overlay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokemmo.tool.overlay.battle.BallLine
import com.pokemmo.tool.overlay.battle.Catch
import com.pokemmo.tool.overlay.battle.OpponentGroup
import com.pokemmo.tool.overlay.data.OverlayRepository

/** Which value row is open in the battle panel: one at a time across all blocks. */
data class PanelRow(val group: Int, val row: Int)

/** Moves the panel window: [moveBy] is the finger's total travel since [start], in screen px. */
interface PanelDrag {
    fun start()
    fun moveBy(dx: Float, dy: Float)
    fun end()
}

/**
 * A tap runs [onTap]; a press that travels past the touch slop drags the window through [drag]
 * instead. One pointerInput(Unit) gesture loop, so redraws and the panel's own scrolling can't cut
 * a tap short (they did with pointerInteropFilter). Positions are taken on screen (window corner +
 * position in the window), because the window moves under the finger.
 */
private fun Modifier.dragOrTap(drag: PanelDrag?, onTap: () -> Unit): Modifier = composed {
    val view = LocalView.current
    val slop = LocalViewConfiguration.current.touchSlop
    val tap by rememberUpdatedState(onTap)
    val mover by rememberUpdatedState(drag)
    val coords = remember { arrayOfNulls<LayoutCoordinates>(1) }
    fun screen(local: Offset): Offset {
        val c = coords[0] ?: return local
        val loc = IntArray(2).also { view.getLocationOnScreen(it) }
        return c.localToWindow(local) + Offset(loc[0].toFloat(), loc[1].toFloat())
    }
    onGloballyPositioned { coords[0] = it }.pointerInput(Unit) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            down.consume()
            val start = screen(down.position)
            var dragging = false
            while (true) {
                val change = awaitPointerEvent().changes.firstOrNull { it.id == down.id } ?: break
                if (!change.pressed) {
                    change.consume()
                    if (dragging) mover?.end() else tap()
                    return@awaitEachGesture
                }
                val d = screen(change.position) - start
                if (!dragging && mover != null && d.getDistance() > slop) {
                    dragging = true
                    mover?.start()
                }
                if (dragging) mover?.moveBy(d.x, d.y)
                change.consume()
            }
            if (dragging) mover?.end()
        }
    }
}

/** [PanelRow.row] of a block's catch section (its conditional balls). */
const val CATCH_ROW = -1

/**
 * Left-side battle panel, the same content as the desktop Live Battle view: icon, name and ×N, the
 * caught ball, types, catch rate, 4× and 2× weaknesses, and value rows that open inline.
 * Mixed hordes stack one block per species; the panel scrolls if they don't fit. Under the
 * weaknesses, each ball's catch chance at the HP read from the screen ([OpponentGroup.hp]);
 * [safari] adds the Safari Ball.
 * Tapping a block's name row folds the panel into a small tab of opponent icons ([collapsed]);
 * tapping the tab opens it again. Dragging either moves the panel ([drag]).
 */
@Composable
fun BattlePanelView(
    groups: List<OpponentGroup>,
    repo: OverlayRepository,
    icons: IconCache,
    panel: Boolean,
    width: Dp,
    maxHeight: Dp,
    iconSize: Dp,
    expanded: PanelRow?,
    onRow: (PanelRow) -> Unit,
    collapsed: Boolean,
    onCollapse: (Boolean) -> Unit,
    safari: Boolean = false,
    drag: PanelDrag? = null,
) {
    PanelStyle(panel) {
        if (collapsed) {
            Row(
                Modifier
                    .then(if (panel) Modifier.background(PanelBg, RoundedCornerShape(iconSize * 0.3f)) else Modifier)
                    .dragOrTap(drag) { onCollapse(false) }
                    .padding(horizontal = 6.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                groups.forEach { PixelIcon(icons, it.pokemon.id, iconSize * 0.8f) }
                PixelArtView(CHEVRON_DOWN, iconSize * 0.4f)
            }
            return@PanelStyle
        }
        Column(
            Modifier
                .width(width)
                .heightIn(max = maxHeight)
                .then(if (panel) Modifier.background(PanelBg, RoundedCornerShape(iconSize * 0.4f)) else Modifier)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            groups.forEachIndexed { gi, g ->
                OpponentBlock(g, repo, icons, iconSize, safari, drag, expanded?.takeIf { it.group == gi }?.row, { onCollapse(true) }) { ri -> onRow(PanelRow(gi, ri)) }
            }
        }
    }
}

@Composable
private fun OpponentBlock(
    g: OpponentGroup,
    repo: OverlayRepository,
    icons: IconCache,
    iconSize: Dp,
    safari: Boolean,
    drag: PanelDrag?,
    expandedRow: Int?,
    onHeader: () -> Unit,
    onRow: (Int) -> Unit,
) {
    val p = g.pokemon
    val rows = buildCard(p.id, repo, null, null, g.count).rows
    Column {
        Row(
            Modifier.dragOrTap(drag) { onHeader() },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            PixelIcon(icons, p.id, iconSize)
            Text(p.name, color = PanelText, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            if (g.count > 1) Text("×${g.count}", color = PanelMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            BallIcon(icons, caught = g.caught, size = iconSize * 0.55f)
        }
        Line {
            p.types.forEach { TypePill(it, fontSize = 7.5.sp) }
        }
        if (p.weak4.isNotEmpty()) {
            Line {
                Label("WEAK 4×")
                p.weak4.forEach { TypePill(it, fontSize = 7.5.sp) }
            }
        }
        if (p.weak2.isNotEmpty()) {
            Line {
                Label("WEAK 2×")
                p.weak2.forEach { TypePill(it, fontSize = 7.5.sp) }
            }
        }
        if (p.catchRate != null) {
            CatchSection(g, icons, iconSize, safari, open = expandedRow == CATCH_ROW) { onRow(CATCH_ROW) }
        }
        if (rows.isNotEmpty()) {
            Box(Modifier.padding(top = 4.dp).fillMaxWidth().height(1.dp).background(PanelDivider))
            rows.forEachIndexed { i, row ->
                if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(PanelDivider.copy(alpha = 0.08f)))
                ValueRow(row, open = expandedRow == i, onToggle = { onRow(i) }, fontSize = 9f)
            }
        }
    }
}

/**
 * CATCH, the catch rate and the HP read ("?" when the bar wasn't found: counted as full), then:
 * Poké, Great and Ultra by name; "Best" for any ball that beats Ultra now, with its reason; and
 * "More balls", which opens every other ball on its own line with when it applies.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CatchSection(g: OpponentGroup, icons: IconCache, iconSize: Dp, safari: Boolean, open: Boolean, onToggle: () -> Unit) {
    val p = g.pokemon
    val hp = g.hp
    val view = remember(p, g.minLevel, hp, safari) { Catch.view(p, g.minLevel, hp ?: 1f, safari) } ?: return
    val ball = iconSize * 0.42f
    Column(Modifier.padding(top = 4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Label("CATCH")
            Text("rate ${p.catchRate} · HP ${hp?.let { "${Catch.percent(it)}%" } ?: "?"}", color = PanelMuted, fontSize = 8.sp)
        }
        FlowRow(
            Modifier.fillMaxWidth().padding(top = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            view.basic.forEach { BallName(it, icons, ball) }
        }
        view.best.forEach { line ->
            Row(Modifier.padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Best ", color = Story, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                BallName(line, icons, ball)
                line.note?.let { Text("  $it", color = PanelGrey, fontSize = 8.sp) }
            }
        }
        if (view.more.isNotEmpty()) {
            Text(
                if (open) "Fewer balls ▾" else "More balls ▸",
                color = Story,
                fontSize = 8.5.sp,
                modifier = Modifier
                    .padding(top = 3.dp)
                    .clickable(remember { MutableInteractionSource() }, indication = null) { onToggle() },
            )
            if (open) {
                Column(Modifier.padding(top = 2.dp), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    view.more.forEach { line ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            BallName(line, icons, ball, nameWidth = 38.dp)
                            line.note?.let { Text("  $it", color = PanelGrey, fontSize = 8.sp) }
                        }
                    }
                }
            }
        }
    }
}

/** Ball icon, name and chance: "◓ Ultra 37%". [nameWidth] lines names up in a list. */
@Composable
private fun BallName(line: BallLine, icons: IconCache, ball: Dp, nameWidth: Dp? = null) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        ItemIcon(icons, "ball-${line.ball.key}", ball)
        Text(
            line.ball.label,
            color = PanelMuted,
            fontSize = 9.sp,
            modifier = Modifier.padding(start = 2.dp).then(if (nameWidth != null) Modifier.width(nameWidth) else Modifier),
        )
        Text(
            (if (line.upTo) "up to " else " ") + "${line.percent}%",
            color = PanelText,
            fontSize = 9.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

private val Story get() = TagKind.STORY.labelColor()

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Line(content: @Composable FlowRowScope.() -> Unit) {
    FlowRow(
        Modifier.fillMaxWidth().padding(top = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

@Composable
private fun Label(text: String) {
    Text(
        text,
        color = PanelGrey,
        fontSize = 7.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.4.sp,
        modifier = Modifier.padding(end = 2.dp),
    )
}
