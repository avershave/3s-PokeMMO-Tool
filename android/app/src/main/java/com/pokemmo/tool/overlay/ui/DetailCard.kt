package com.pokemmo.tool.overlay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private fun TagKind.label() = when (this) {
    TagKind.PVP -> "PvP"
    TagKind.STORY -> "Story"
    TagKind.UTILITY -> "Utility"
    TagKind.EV -> "EV"
}

@Composable
fun KindChip(kind: TagKind) {
    Text(
        kind.label(),
        color = Color.White,
        fontSize = 10.sp,
        modifier = Modifier
            .background(kind.color(), RoundedCornerShape(4.dp))
            .padding(horizontal = 5.dp, vertical = 1.dp),
    )
}

/** Detail card. Rows start collapsed; tapping one expands only that row. */
@Composable
fun DetailCardView(card: Card, id: Int, sprites: SpriteCache, maxWidth: Dp, maxHeight: Dp) {
    var expanded by remember(card) { mutableStateOf<Int?>(null) }
    Column(
        Modifier
            .widthIn(max = maxWidth)
            .heightIn(max = maxHeight)
            .background(PanelBg, RoundedCornerShape(10.dp))
            .verticalScroll(rememberScrollState())
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Sprite(sprites, id, 40.dp)
            Column {
                Text(card.name, color = PanelText, fontSize = 15.sp)
                if (card.subtitle.isNotEmpty()) Text(card.subtitle, color = PanelMuted, fontSize = 11.sp)
            }
        }
        card.tip?.let { Text(it, color = PanelMuted, fontSize = 11.sp) }
        card.rows.forEachIndexed { i, row ->
            CardRowView(row, open = expanded == i, onToggle = { expanded = if (expanded == i) null else i })
        }
    }
}

@Composable
private fun CardRowView(row: CardRow, open: Boolean, onToggle: () -> Unit) {
    var showMore by remember(row) { mutableStateOf(false) }
    Column(
        Modifier
            .fillMaxWidth()
            .background(Color(0x22FFFFFF), RoundedCornerShape(6.dp))
            .clickable { onToggle() }
            .padding(6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            KindChip(row.kind)
            Text(row.title, color = PanelText, fontSize = 12.sp, modifier = Modifier.weight(1f, fill = false))
            Text(if (open) "▾" else "▸", color = PanelMuted, fontSize = 12.sp)
        }
        Text(row.summary, color = PanelMuted, fontSize = 11.sp)
        if (open) {
            Text(row.body, color = PanelText, fontSize = 11.sp)
            if (row.more != null) {
                if (showMore) {
                    Text(row.more, color = PanelText, fontSize = 11.sp)
                } else {
                    Text(
                        "More about ${row.title} ▸",
                        color = Color(0xFF7FB2FF),
                        fontSize = 11.sp,
                        modifier = Modifier.clickable { showMore = true },
                    )
                }
            }
        }
    }
}
