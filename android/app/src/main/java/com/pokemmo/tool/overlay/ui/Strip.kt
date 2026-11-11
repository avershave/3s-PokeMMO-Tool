package com.pokemmo.tool.overlay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Temporary until the drawer view (Task 9): draws the route's icons in one row. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun StripView(
    model: DrawerModel?,
    icons: IconCache,
    spriteSize: Dp,
    maxWidth: Dp,
    onItem: (DrawerItem) -> Unit,
    onOverflow: () -> Unit,
) {
    Box(
        Modifier
            .widthIn(max = maxWidth)
            .background(PanelBg, RoundedCornerShape(10.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        if (model == null || model.empty) {
            Text(NO_WILD_TEXT, color = PanelMuted, fontSize = 12.sp)
        } else {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                model.items.forEach { item ->
                    PixelIcon(
                        icons, item.id, spriteSize,
                        modifier = Modifier.clickable { onItem(item) },
                        faded = !item.worth,
                    )
                }
            }
        }
    }
}
