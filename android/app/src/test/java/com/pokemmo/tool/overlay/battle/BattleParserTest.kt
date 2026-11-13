package com.pokemmo.tool.overlay.battle

import com.pokemmo.tool.overlay.data.OverlayRepository
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BattleParserTest {

    private fun read(name: String): String {
        val dir = listOf(
            File("src/main/assets/overlay"),
            File("app/src/main/assets/overlay"),
            File("android/app/src/main/assets/overlay"),
        ).first { it.isDirectory }
        return File(dir, name).readText(Charsets.UTF_8)
    }

    private val repo by lazy {
        OverlayRepository(read("pokemon.json"), read("areas.json"), read("tags.json"))
    }
    private val parser by lazy { BattleParser(repo) }

    private fun line(t: String, top: Int = 0) = OcrLine(t, 0, top, 100, top + 20)

    // CaughtDetector fixtures
    private fun image(w: Int, h: Int, bg: Int = 0xFF202020.toInt()) = IntArray(w * h) { bg }

    private fun fill(img: IntArray, w: Int, x0: Int, y0: Int, x1: Int, y1: Int, c: Int) {
        for (y in y0 until y1) for (x in x0 until x1) img[y * w + x] = c
    }

    @Test
    fun parsesEnglishAndSpanishLevels() {
        val r = parser.parse(listOf(line("Ursaring Nv. 58"), line("Abra Lv. 12")))
        assertEquals(listOf(217 to 58, 63 to 12), r.map { it.pokemon.id to it.level })
    }

    @Test
    fun levelLabelIsCaseInsensitiveAndRangeChecked() {
        val ok = parser.parse(listOf(line("Abra LV. 58"), line("Abra lv 12"), line("Abra NV 100")))
        assertEquals(listOf(58, 12, 100), ok.map { it.level })
        assertTrue(parser.parse(listOf(line("Abra Lv. 0"), line("Abra Lv. 101"), line("Abra Lv. 999"))).isEmpty())
    }

    @Test
    fun ignoresNonBattleText() {
        val r = parser.parse(
            listOf("0/7", "14,158", "LUCHA", "nito que se ve tesela :V").map { line(it) },
        )
        assertTrue(r.isEmpty())
    }

    @Test
    fun groupsMixedHordeSkipsUnreadableLines() {
        val opps = parser.parse(
            listOf(
                line("Ursaring Nv. 58"),
                line("Ursaring Nv. 58"),
                line("Ursaring Nv. 61"),
                line("Ursar1ng Nv. 6l"),
                line("Teddiursa Nv. 30"),
            ),
        )
        assertEquals(4, opps.size)
        val groups = parser.group(opps) { false }
        assertEquals(listOf(217 to 3, 216 to 1), groups.map { it.pokemon.id to it.count })
        assertEquals(58, groups[0].minLevel)
        assertEquals(61, groups[0].maxLevel)
        assertFalse(groups[0].caught)
    }

    @Test
    fun fuzzyMatchesOcrTypoAndCaughtIsPerSpecies() {
        val opps = parser.parse(listOf(line("Ursar1ng Nv. 58", 0), line("Ursaring Nv. 59", 30)))
        assertEquals(2, opps.size)
        val groups = parser.group(opps) { it.box.top == 30 }
        assertEquals(1, groups.size)
        assertTrue(groups[0].caught)
    }

    @Test
    fun caughtDetectorTrueOnSyntheticBall() {
        val w = 200
        val h = 100
        val img = image(w, h)
        val l = OcrLine("x", 20, 50, 100, 70)
        fill(img, w, 100, 50, 160, 60, 0xFFFF0000.toInt())
        fill(img, w, 100, 60, 160, 70, 0xFFFFFFFF.toInt())
        assertTrue(CaughtDetector.isCaught(img, w, h, l))
    }

    @Test
    fun caughtDetectorFalseOnPlainBackground() {
        val w = 200
        val h = 100
        assertFalse(CaughtDetector.isCaught(image(w, h), w, h, OcrLine("x", 20, 50, 100, 70)))
    }

    @Test
    fun caughtDetectorFalseWhenProbeOffScreen() {
        val w = 200
        val h = 100
        val img = image(w, h, 0xFFFFFFFF.toInt())
        assertFalse(CaughtDetector.isCaught(img, w, h, OcrLine("x", 120, 50, 200, 70)))
        assertFalse(CaughtDetector.isCaught(img, w, h, OcrLine("x", 120, 150, 150, 170)))
    }
}
