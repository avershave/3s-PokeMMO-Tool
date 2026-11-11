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

internal val SLOWPOKE_PREVIEW = Card(
    name = "Slowpoke",
    types = listOf("Water", "Psychic"),
    where = listOf(
        WhereLine(CatchMark.SURF, "Surfing · Very common · Hordes of 5 · Level 30–35"),
        WhereLine(CatchMark.ROD, "Super Rod · Rare · Hordes of 5 · Level 25–40"),
    ),
    rows = listOf(
        CardRow(TagKind.PVP, "Smogon Gen 5 OU", "Slowbro", "Slowbro is a standard defensive pick in Smogon Gen 5 OU.", null),
        CardRow(
            TagKind.STORY, "Very bulky Water/Psychic", "Slowbro",
            "Slowbro has high HP and Defense, and its Water and Psychic moves cover Fire, Rock, Ground, " +
                "Fighting and Poison types. It evolves at 37. It is very slow, so it wins by outlasting rather than outspeeding.",
            "Story picks are judged for a normal playthrough.",
        ),
        CardRow(TagKind.EV, "+1 HP each · +5 per horde", null, "", null),
    ),
    tip = null,
    footer = "Route 6 · Kanto",
)

@Composable
private fun CardFrame(expanded: Int?) {
    val ctx = LocalContext.current
    val icons = remember { IconCache(ctx) }
    Column(
        Modifier.fillMaxWidth().background(Color(0xFF5A7A4A)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        DrawerView(ROUTE6_PREVIEW, true, 79, true, icons, 28.dp, 438.dp, false, 160.dp, {}, {}, {})
        DetailCardView(SLOWPOKE_PREVIEW, 79, icons, true, 438.dp, 260.dp, 28.dp, expanded, {})
    }
}

@Preview(widthDp = 997, heightDp = 448)
@Composable
fun CardCollapsedPreview() = CardFrame(null)

@Preview(widthDp = 997, heightDp = 448)
@Composable
fun CardStoryOpenPreview() = CardFrame(1)
