package com.pokemmo.tool.overlay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

private val G = listOf(CatchMark.GRASS)
private val S = listOf(CatchMark.SURF)
private val Rd = listOf(CatchMark.ROD)

/** Route 6, Kanto, as in the approved drawer.html mockup. */
internal val ROUTE6_PREVIEW = DrawerModel(
    items = listOf(
        DrawerItem(16, "Pidgey", G, false), DrawerItem(19, "Rattata", G, false),
        DrawerItem(37, "Vulpix", G, true), DrawerItem(39, "Jigglypuff", G, true),
        DrawerItem(43, "Oddish", G, true), DrawerItem(52, "Meowth", G, true),
        DrawerItem(54, "Psyduck", listOf(CatchMark.GRASS, CatchMark.SURF, CatchMark.ROD), false),
        DrawerItem(55, "Golduck", S, false), DrawerItem(56, "Mankey", G, true),
        DrawerItem(58, "Growlithe", G, true), DrawerItem(60, "Poliwag", Rd, true),
        DrawerItem(61, "Poliwhirl", Rd, true), DrawerItem(63, "Abra", G, true),
        DrawerItem(69, "Bellsprout", G, true), DrawerItem(79, "Slowpoke", listOf(CatchMark.SURF, CatchMark.ROD), true),
        DrawerItem(81, "Magnemite", G, true), DrawerItem(118, "Goldeen", Rd, false),
        DrawerItem(129, "Magikarp", Rd, true), DrawerItem(130, "Gyarados", Rd, true),
        DrawerItem(96, "Drowzee", G, false), DrawerItem(209, "Snubbull", G, true),
    ),
    cycle = listOf(37, 39, 43),
    empty = false,
)

@Composable
private fun DrawerPreviewFrame(open: Boolean, model: DrawerModel = ROUTE6_PREVIEW, selected: Int? = null) {
    val ctx = LocalContext.current
    val icons = remember { IconCache(ctx) }
    // 2244x1008 at 360 dpi: icon 64 px = 28.4 dp, drawer area 44% of 997 dp.
    Column(Modifier.fillMaxWidth().background(Color(0xFF5A7A4A)), horizontalAlignment = Alignment.CenterHorizontally) {
        DrawerView(model, open, selected, true, icons, 28.dp, 438.dp, false, 160.dp, {}, {}, {})
    }
}

@Preview(widthDp = 997, heightDp = 160)
@Composable
fun DrawerOpenPreview() = DrawerPreviewFrame(open = true, selected = 79)

@Preview(widthDp = 997, heightDp = 60)
@Composable
fun DrawerClosedPreview() = DrawerPreviewFrame(open = false)

@Preview(widthDp = 997, heightDp = 60)
@Composable
fun DrawerEmptyPreview() = DrawerPreviewFrame(open = true, model = DrawerModel(emptyList(), emptyList(), true))
