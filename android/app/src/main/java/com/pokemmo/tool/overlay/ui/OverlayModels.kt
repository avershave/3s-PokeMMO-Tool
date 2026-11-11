package com.pokemmo.tool.overlay.ui

import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.data.Encounter
import com.pokemmo.tool.overlay.data.OverlayRepository
import com.pokemmo.tool.overlay.data.Spawn

/**
 * Tag kinds shown on the overlay. Declaration order is the display order on cards
 * (PvP > Story > Utility, EV last). Unknown kinds (e.g. a future "gtm") are ignored.
 */
enum class TagKind {
    PVP, STORY, UTILITY, EV;

    companion object {
        fun of(kind: String): TagKind? = when (kind) {
            "pvp" -> PVP
            "story" -> STORY
            "utility" -> UTILITY
            "ev" -> EV
            else -> null
        }
    }
}

const val NO_WILD_TEXT = "No wild Pokémon here"

// --- Drawer ---

/** One icon in the route drawer. [worth] false draws it faded. */
data class DrawerItem(val id: Int, val name: String, val marks: List<CatchMark>, val worth: Boolean)

/** [cycle] holds the ids of worth-catching items in item order, for the closed tab. */
data class DrawerModel(val items: List<DrawerItem>, val cycle: List<Int>, val empty: Boolean)

/** Spawn order kept, deduplicated by id, lure-only spawns removed. Null area = empty. */
fun buildDrawer(area: Area?, repo: OverlayRepository): DrawerModel {
    if (area == null) return DrawerModel(emptyList(), emptyList(), true)
    val items = area.spawns.distinctBy { it.id }.filterNot { isLureOnly(it) }.map { sp ->
        DrawerItem(sp.id, sp.name, marksFor(sp), repo.hasOutline(repo.tags(sp.id)))
    }
    return DrawerModel(items, items.filter { it.worth }.map { it.id }, items.isEmpty())
}

// --- Where lines ---

data class WhereLine(val mark: CatchMark, val text: String)

/** "Level 30–35", "Level 38", or null when either end is unknown. Never "Lv". */
fun levelText(min: Int?, max: Int?): String? = when {
    min == null || max == null -> null
    min == max -> "Level $min"
    else -> "Level $min–$max"
}

/** "Water…" means surfing in the data; everything else reads as is. */
fun methodName(method: String): String =
    if (method.startsWith("Water")) "Surfing" + method.removePrefix("Water") else method

private fun sentenceCase(s: String) = s.lowercase().replaceFirstChar { it.uppercase() }

/** "Surfing · Very common · Hordes of 5 · Level 30–35". */
fun whereText(e: Encounter): String = buildList {
    add(methodName(e.method))
    e.rarities.firstOrNull { !it.equals("Horde", ignoreCase = true) }?.let { add(sentenceCase(it)) }
    when {
        e.hordeSize != null -> add("Hordes of ${e.hordeSize}")
        e.rarities.any { it.equals("Horde", ignoreCase = true) } -> add("Hordes")
    }
    levelText(e.min, e.max)?.let { add(it) }
}.joinToString(" · ")

// --- Card ---

/** One value row. [via] names the evolution a carried tag comes from ("as Slowbro"). */
data class CardRow(
    val kind: TagKind,
    val summary: String,
    val via: String?,
    val body: String,
    val more: String?,
)

data class Card(
    val name: String,
    val types: List<String>,
    val where: List<WhereLine>,
    val rows: List<CardRow>,
    val tip: String?,
    val footer: String?,
)

private val NUMBER = Regex("""\+(\d+)""")

/** "+2 Atk" -> "+2 Atk each · +10 per horde" for a horde of 5; every stat is multiplied. */
fun evSummaryForHorde(summary: String, hordeCount: Int?): String {
    if (hordeCount == null || hordeCount <= 1) return summary
    val scaled = if (',' in summary) {
        NUMBER.replace(summary) { "+" + it.groupValues[1].toInt() * hordeCount }
    } else {
        // Single stat: the label is already in the "each" part.
        "+" + (NUMBER.find(summary)?.groupValues?.get(1)?.toInt() ?: return summary) * hordeCount
    }
    return "$summary each · $scaled per horde"
}

/**
 * [spawn] and [area] are null when built for the battle panel (no where lines, no footer).
 * [hordeCount] scales the EV text. Lure encounters get no where line (they have no mark).
 */
fun buildCard(id: Int, repo: OverlayRepository, spawn: Spawn?, area: Area?, hordeCount: Int?): Card {
    val data = repo.pokemon(id)
    val where = spawn?.encounters.orEmpty().mapNotNull { e ->
        markOf(e.method)?.let { WhereLine(it, whereText(e)) }
    }
    val rows = repo.tags(id).mapNotNull { tag ->
        val kind = TagKind.of(tag.kind) ?: return@mapNotNull null
        val ex = repo.explanation(tag.key)
        CardRow(
            kind = kind,
            summary = if (kind == TagKind.EV) evSummaryForHorde(tag.summary, hordeCount) else tag.summary,
            via = if (tag.via != null) tag.viaName else null,
            body = tag.body ?: ex?.body.orEmpty(),
            more = ex?.more,
        )
    }.sortedBy { it.kind == TagKind.EV } // stable: tag order kept, EV last
    return Card(
        name = data?.name ?: spawn?.name ?: "#$id",
        types = data?.types.orEmpty(),
        where = where,
        rows = rows,
        tip = repo.tip(id),
        footer = area?.let { "${it.name} · ${it.region}" },
    )
}
