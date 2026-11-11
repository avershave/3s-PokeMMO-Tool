package com.pokemmo.tool.overlay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.pokemmo.tool.overlay.battle.OpponentGroup
import com.pokemmo.tool.overlay.data.OverlayRepository

@Composable
private fun PanelFrame(expanded: PanelRow?) {
    val ctx = LocalContext.current
    val icons = remember { IconCache(ctx) }
    val repo = remember { OverlayRepository.fromAssets(ctx) }
    val groups = listOf(
        OpponentGroup(repo.pokemon(217)!!, 5, 30, 32, caught = true),
        OpponentGroup(repo.pokemon(228)!!, 1, 30, 30, caught = false),
    )
    Box(Modifier.fillMaxSize().background(Color(0xFF7A6A52)).padding(10.dp)) {
        BattlePanelView(groups, repo, icons, true, 194.dp, 420.dp, 28.dp, expanded) {}
    }
}

@Preview(widthDp = 260, heightDp = 448)
@Composable
fun BattlePanelPreview() = PanelFrame(null)

@Preview(widthDp = 260, heightDp = 448)
@Composable
fun BattlePanelOpenPreview() = PanelFrame(PanelRow(0, 1))
