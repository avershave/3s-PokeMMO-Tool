package com.pokemmo.tool.overlay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

@Preview(widthDp = 360, heightDp = 200)
@Composable
fun PrimitivesPreview() {
    val ctx = LocalContext.current
    val icons = remember { IconCache(ctx) }
    Column(
        Modifier.background(PanelBg).padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            CatchMark.entries.forEach { CatchMarkIcon(it, 24.dp) }
            PixelArtView(CHEVRON_UP, 24.dp)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            listOf(16, 79, 130).forEach { PixelIcon(icons, it, 48.dp) }
            PixelIcon(icons, 16, 48.dp, frame = 1)
            PixelIcon(icons, 16, 48.dp, faded = true)
            BallIcon(icons, caught = true, size = 32.dp)
            BallIcon(icons, caught = false, size = 32.dp)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf("Water", "Psychic", "Fire", "Grass", "Normal", "Dragon").forEach { TypePill(it) }
        }
    }
}
