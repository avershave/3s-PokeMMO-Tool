package com.pokemmo.tool.overlay.match

import java.util.Locale

/** Port of simplifyName + LIVE_ALIASES + aliasKey from src/lib/areas.js. */
object AliasKey {
    // JS \b and \s semantics: \b is ASCII-word based, \s includes Unicode spaces.
    private const val W = "A-Za-z0-9_"
    private const val B = "(?:(?<=[$W])(?![$W])|(?<![$W])(?=[$W]))"
    private const val S = "[\\s\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"
    private val I = RegexOption.IGNORE_CASE

    val LIVE_ALIASES: Map<String, String> = mapOf(
        "oreburghcity" to "oreburghcity",
        "jubilifecity" to "jubilifecity",
        "mtcoronet" to "mountcoronet",
        "mtcoronet4f" to "mountcoronet",
        "victoryroad" to "victoryroad",
        "pokathlondome" to "pokeathlondome",
        "pokmonmansion" to "pokemonmansion",
        "pokmontower" to "pokemontower",
    )

    private val chapter = Regex("$S+Ch\\.?$S*\\d+$B", I)
    private val money = Regex("\\$[\\d,.]+")
    private val days = Regex(
        "$B(Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$B", I,
    )
    private val clock = Regex("$B\\d{1,2}:\\d{2}$B")
    private val mt = Regex("${B}mt\\.?$B", I)
    private val parens = Regex("$S*\\([^)]*\\)$S*")
    private val floors = Regex("$B(?:b\\d+f|\\d+f)$B", I)
    private val nonAlnum = Regex("[^a-z0-9 ]+")
    private val spaces = Regex("$S+")
    private val generic = Regex("$B(city|town|forest|cave|road|gate|outside|inside|entrance|exit)$B")

    private fun simplify(s: String): String {
        var r = s
        r = chapter.replace(r, "")
        r = money.replace(r, "")
        r = days.replace(r, "")
        r = clock.replace(r, "")
        r = mt.replace(r, "mount")
        r = parens.replace(r, " ")
        r = floors.replace(r, "")
        r = r.lowercase(Locale.ROOT)
        r = nonAlnum.replace(r, " ")
        r = spaces.replace(r, " ")
        r = r.trim()
        r = generic.replace(r, "")
        return spaces.replace(r, "")
    }

    fun of(s: String): String {
        val key = simplify(s)
        return LIVE_ALIASES[key] ?: key
    }
}
