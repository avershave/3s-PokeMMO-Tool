package com.pokemmo.tool.overlay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokemmo.tool.overlay.battle.OpponentGroup
import com.pokemmo.tool.overlay.data.OverlayRepository

/** Same fields as the desktop Live Battle view: types, weaknesses, catch rate, caught. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BattlePanelView(
    groups: List<OpponentGroup>,
    repo: OverlayRepository,
    icons: IconCache,
    maxWidth: Dp,
    maxHeight: Dp,
    onGroup: (OpponentGroup) -> Unit,
) {
    Column(
        Modifier
            .widthIn(max = maxWidth)
            .heightIn(max = maxHeight)
            .background(PanelBg, RoundedCornerShape(10.dp))
            .verticalScroll(rememberScrollState())
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        groups.forEach { g ->
            val p = g.pokemon
            val ev = repo.tags(p.id).firstOrNull { it.kind == "ev" }?.summary
            Row(
                Modifier.fillMaxWidth().clickable { onGroup(g) },
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PixelIcon(icons, p.id, 40.dp)
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(
                            if (g.count > 1) "${p.name} ×${g.count}" else p.name,
                            color = PanelText, fontSize = 12.sp,
                        )
                        Box(
                            Modifier
                                .size(8.dp)
                                .background(if (g.caught) Color(0xFF1F9D55) else Color(0xFF555555), CircleShape),
                        )
                    }
                    Text(p.types.joinToString(" · "), color = PanelMuted, fontSize = 10.sp)
                    p.catchRate?.let { Text("Catch $it", color = PanelMuted, fontSize = 10.sp) }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        p.weak4.forEach { WeakChip("4×", it, Color(0xFFC0392B)) }
                        p.weak2.forEach { WeakChip("2×", it, Color(0xFF8A5A1E)) }
                    }
                    ev?.let { Text(evSummaryForHorde(it, g.count), color = PanelMuted, fontSize = 10.sp) }
                }
            }
        }
    }
}

@Composable
private fun WeakChip(mult: String, type: String, bg: Color) {
    Text(
        "$mult $type",
        color = Color.White,
        fontSize = 9.sp,
        modifier = Modifier.background(bg, RoundedCornerShape(4.dp)).padding(horizontal = 4.dp, vertical = 1.dp),
    )
}

@Composable
private fun ValueChip(label: String, bg: Color) {
    Text(
        label,
        color = Color.White,
        fontSize = 9.sp,
        modifier = Modifier.background(bg, RoundedCornerShape(4.dp)).padding(horizontal = 4.dp, vertical = 1.dp),
    )
}
