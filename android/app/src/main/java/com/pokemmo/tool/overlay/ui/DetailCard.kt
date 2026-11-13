package com.pokemmo.tool.overlay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokemmo.tool.overlay.capture.IntRect
import com.pokemmo.tool.overlay.capture.ScreenRegions

/** Where the card window goes, in px: under the drawer window. */
data class CardPlacement(val x: Int, val y: Int, val width: Int, val maxHeight: Int)

/**
 * The card spans [area] (CARD_AREA: right of the D-pad, wider than the drawer) and starts just
 * below the drawer window's bottom; it may reach down to [maxBottom]. It never starts above the
 * route name's bottom, which it would otherwise cover on the left.
 */
fun cardPlacement(drawerBottom: Int, area: IntRect, screenH: Int, maxBottom: Int): CardPlacement {
    val gap = (0.005f * screenH).toInt()
    val y = maxOf(drawerBottom, (ScreenRegions.ROUTE.bottom * screenH).toInt()) + gap
    return CardPlacement(area.left, y, area.width, (maxBottom - y).coerceAtLeast(0))
}

private val LABEL_WIDTH = 34.dp

/**
 * The card under the drawer: icon, name and types; where to catch it; the tip; value rows that open
 * one at a time ([expandedRow] is hoisted so it survives the window being hidden); the footer naming
 * the location that was read. No borders, no boxes, and never "Lv" text.
 */
@Composable
fun DetailCardView(
    card: Card,
    id: Int,
    icons: IconCache,
    panel: Boolean,
    width: Dp,
    maxHeight: Dp,
    iconSize: Dp,
    expandedRow: Int?,
    onRow: (Int) -> Unit,
) {
    PanelStyle(panel) {
        Column(
            Modifier
                .width(width)
                .heightIn(max = maxHeight)
                .then(if (panel) Modifier.background(PanelBg, RoundedCornerShape(iconSize * 0.4f)) else Modifier)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 10.dp, vertical = 7.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PixelIcon(icons, id, iconSize * 1.3f)
                Text(card.name, color = PanelText, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                card.types.forEach { TypePill(it, fontSize = 8.sp) }
            }
            if (card.where.isNotEmpty()) {
                Column(Modifier.padding(top = 4.dp, bottom = 3.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    card.where.forEach { w ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            CatchMarkIcon(w.mark, 10.dp)
                            Text(w.text, color = PanelMuted, fontSize = 10.sp)
                        }
                    }
                }
            }
            card.tip?.let { Text(it, color = PanelMuted, fontSize = 9.5.sp, modifier = Modifier.padding(bottom = 3.dp)) }
            if (card.rows.isNotEmpty()) {
                Divider()
                card.rows.forEachIndexed { i, row ->
                    if (i > 0) Divider(faint = true)
                    ValueRow(row, open = expandedRow == i, onToggle = { onRow(i) })
                }
            }
            card.footer?.let {
                Text(
                    it, color = PanelGrey, fontSize = 8.sp, textAlign = TextAlign.End,
                    modifier = Modifier.fillMaxWidth().padding(top = 3.dp),
                )
            }
        }
    }
}

@Composable
private fun Divider(faint: Boolean = false) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(if (faint) PanelDivider.copy(alpha = 0.08f) else PanelDivider),
    )
}

/** One value row: coloured label, summary, "as X" in grey, ▸/▾; the explanation opens below. */
@Composable
fun ValueRow(row: CardRow, open: Boolean, onToggle: () -> Unit, fontSize: Float = 10f) {
    var showMore by remember(row) { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(remember { MutableInteractionSource() }, indication = null) { onToggle() }
                .padding(vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                row.kind.label().uppercase(),
                color = row.kind.labelColor(),
                fontSize = (fontSize * 0.82f).sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                modifier = Modifier.width(LABEL_WIDTH),
            )
            Text(
                buildAnnotatedString {
                    append(row.summary)
                    row.via?.let { withStyle(SpanStyle(color = PanelGrey)) { append("  as $it") } }
                },
                color = PanelText,
                fontSize = fontSize.sp,
                modifier = Modifier.weight(1f),
            )
            Text(if (open) "▾" else "▸", color = PanelGrey, fontSize = (fontSize * 1.3f).sp)
        }
        if (open) {
            Column(
                Modifier.padding(start = LABEL_WIDTH + 6.dp, bottom = 4.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                if (row.body.isNotEmpty()) Text(row.body, color = PanelMuted, fontSize = (fontSize * 0.9f).sp, lineHeight = (fontSize * 1.3f).sp)
                row.more?.let { more ->
                    if (showMore) {
                        Text(
                            more, color = PanelMuted, fontSize = (fontSize * 0.9f).sp, lineHeight = (fontSize * 1.3f).sp,
                            modifier = Modifier.clickable { showMore = false },
                        )
                    } else {
                        Text(
                            "More about ${row.kind.label()} ▸",
                            color = Story,
                            fontSize = (fontSize * 0.85f).sp,
                            modifier = Modifier.clickable { showMore = true },
                        )
                    }
                }
            }
        }
    }
}

private val Story get() = TagKind.STORY.labelColor()
