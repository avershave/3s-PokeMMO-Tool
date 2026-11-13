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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokemmo.tool.overlay.battle.OpponentGroup
import com.pokemmo.tool.overlay.data.OverlayRepository

/** Which value row is open in the battle panel: one at a time across all blocks. */
data class PanelRow(val group: Int, val row: Int)

/**
 * Left-side battle panel, the same content as the desktop Live Battle view: icon, name and ×N, the
 * caught ball, types, catch rate, 4× and 2× weaknesses, and value rows that open inline.
 * Mixed hordes stack one block per species; the panel scrolls if they don't fit.
 * Tapping a block's name row folds the panel into a small tab of opponent icons ([collapsed]);
 * tapping the tab opens it again.
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
) {
    PanelStyle(panel) {
        if (collapsed) {
            Row(
                Modifier
                    .then(if (panel) Modifier.background(PanelBg, RoundedCornerShape(iconSize * 0.3f)) else Modifier)
                    .clickable(remember { MutableInteractionSource() }, indication = null) { onCollapse(false) }
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
                OpponentBlock(g, repo, icons, iconSize, expanded?.takeIf { it.group == gi }?.row, { onCollapse(true) }) { ri -> onRow(PanelRow(gi, ri)) }
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
    expandedRow: Int?,
    onHeader: () -> Unit,
    onRow: (Int) -> Unit,
) {
    val p = g.pokemon
    val rows = buildCard(p.id, repo, null, null, g.count).rows
    Column {
        Row(
            Modifier.clickable(remember { MutableInteractionSource() }, indication = null) { onHeader() },
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
            Spacer(Modifier.weight(1f))
            p.catchRate?.let {
                Label("CATCH")
                Text("$it", color = PanelMuted, fontSize = 9.sp)
            }
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
        if (rows.isNotEmpty()) {
            Box(Modifier.padding(top = 4.dp).fillMaxWidth().height(1.dp).background(PanelDivider))
            rows.forEachIndexed { i, row ->
                if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(PanelDivider.copy(alpha = 0.08f)))
                ValueRow(row, open = expandedRow == i, onToggle = { onRow(i) }, fontSize = 9f)
            }
        }
    }
}

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
