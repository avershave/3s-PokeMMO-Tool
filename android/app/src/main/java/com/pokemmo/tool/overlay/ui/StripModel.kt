package com.pokemmo.tool.overlay.ui

import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.data.OverlayRepository
import com.pokemmo.tool.overlay.data.Spawn
import kotlin.math.max

/**
 * Tag kinds shown in the first version. Declaration order is the priority order
 * (PvP > Story > Utility); EV is shown in cards but never outlines a sprite.
 */
enum class TagKind(val argb: Long) {
    PVP(0xFFC0392B),
    STORY(0xFF2E6FD8),
    UTILITY(0xFF1F9D55),
    EV(0xFF555555);

    companion object {
        /** Null for unknown kinds (e.g. a future "gtm"), which are ignored. */
        fun of(kind: String): TagKind? = when (kind) {
            "pvp" -> PVP
            "story" -> STORY
            "utility" -> UTILITY
            "ev" -> EV
            else -> null
        }
    }
}

/** Panel background rgba(18,20,28,0.9). */
const val PANEL_BG_ARGB: Long = 0xE612141C

data class StripItem(val id: Int, val name: String, val outline: TagKind?, val dimmed: Boolean)

data class StripModel(
    val title: String,
    val region: String,
    val items: List<StripItem>,
    val overflow: Int,
    val empty: Boolean,
)

const val EMPTY_STRIP_TEXT = "No wild Pokémon here"

/** [StripModel.items] holds only the visible items; [StripModel.overflow] counts the hidden rest. */
fun buildStrip(area: Area, repo: OverlayRepository, maxVisible: Int): StripModel {
    val all = area.spawns.distinctBy { it.id }.map { sp ->
        val outline = repo.tags(sp.id)
            .mapNotNull { TagKind.of(it.kind) }
            .filter { it != TagKind.EV }
            .minOrNull()
        StripItem(sp.id, sp.name, outline, dimmed = outline == null)
    }
    val sorted = all.sortedWith(
        compareBy<StripItem>({ it.outline == null }, { it.outline?.ordinal ?: 0 }, { it.name }),
    )
    val visible = sorted.take(max(0, maxVisible))
    return StripModel(
        title = area.name,
        region = area.region,
        items = visible,
        overflow = max(0, sorted.size - maxVisible),
        empty = area.spawns.isEmpty(),
    )
}

data class CardRow(
    val kind: TagKind,
    val title: String,
    val summary: String,
    val body: String,
    val more: String?,
)

data class Card(val name: String, val subtitle: String, val rows: List<CardRow>, val tip: String?)

private val RARITY_ORDER = listOf("Very Common", "Common", "Uncommon", "Rare", "Very Rare")
private val NUMBER = Regex("""\+(\d+)""")

/** "+2 Atk" -> "+2 Atk each, +10 per horde" for a horde of 5; every stat is multiplied. */
fun evSummaryForHorde(summary: String, hordeCount: Int?): String {
    if (hordeCount == null || hordeCount <= 1) return summary
    val scaled = if (',' in summary) {
        NUMBER.replace(summary) { "+" + it.groupValues[1].toInt() * hordeCount }
    } else {
        // Single stat: the label is already in the "each" part.
        "+" + (NUMBER.find(summary)?.groupValues?.get(1)?.toInt() ?: return summary) * hordeCount
    }
    return "$summary each, $scaled per horde"
}

/** [spawn] is null when opened from battle (types only); [hordeCount] scales EV text. */
fun buildCard(id: Int, repo: OverlayRepository, spawn: Spawn?, hordeCount: Int?): Card {
    val data = repo.pokemon(id)
    val subtitleParts = buildList {
        if (spawn != null) {
            spawn.encounters.flatMap { it.rarities }
                .filter { it in RARITY_ORDER }
                .maxByOrNull { RARITY_ORDER.indexOf(it) }
                ?.let { add(it) }
            spawn.encounters.firstOrNull()?.method?.let { add(it) }
        }
        data?.types?.let { addAll(it) }
    }
    val rows = repo.tags(id).mapNotNull { tag ->
        val kind = TagKind.of(tag.kind) ?: return@mapNotNull null
        val ex = repo.explanation(tag.key)
        val base = ex?.title ?: tag.key
        CardRow(
            kind = kind,
            title = if (tag.via != null && tag.viaName != null) "$base (as ${tag.viaName})" else base,
            summary = if (kind == TagKind.EV) evSummaryForHorde(tag.summary, hordeCount) else tag.summary,
            body = tag.body ?: ex?.body.orEmpty(),
            more = ex?.more,
        )
    }.sortedBy { it.kind == TagKind.EV } // stable: tag order kept, EV last
    return Card(
        name = data?.name ?: spawn?.name ?: "#$id",
        subtitle = subtitleParts.joinToString(" · "),
        rows = rows,
        tip = repo.tip(id),
    )
}
