package com.pokemmo.tool.overlay.battle

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assume.assumeTrue
import org.junit.Test

class HpBarTest {
    private val bg = 0xFF1A1E2C.toInt() // dark blue background
    private val track = 0xFF656769.toInt()
    private val trackLight = 0xFF76787A.toInt()
    private val border = 0xFF3B3E3F.toInt()
    private val green = 0xFF42654B.toInt() // dimmed green, from the move-menu screenshot
    private val red = 0xFFC83C30.toInt()

    /** A 2244x200 screen with a name box at (56, 40)-(300, 70) and its bar like the real one. */
    private fun screen(fraction: Float, fill: Int = green): IntArray {
        val w = 2244; val h = 200
        val px = IntArray(w * h) { bg }
        fun rect(x0: Int, y0: Int, x1: Int, y1: Int, c: Int) {
            for (y in y0 until y1) for (x in x0 until x1) px[y * w + x] = c
        }
        rect(0, 80, 440, 110, track)
        rect(0, 85, 440, 92, trackLight)
        rect(85, 92, 364, 107, border) // inner bar with its border (x 85 and 363)
        val inner = 277
        val len = (inner * fraction).toInt()
        rect(86, 93, 363, 106, 0xFF2A2C2E.toInt()) // empty inner part
        if (len > 0) rect(86, 93, 86 + len, 106, fill)
        return px
    }

    private val box = OcrLine("Drowzee Lv. 17", 56, 40, 300, 70)

    @Test
    fun `reads the fill fraction`() {
        assertEquals(1f, HpBar.read(screen(1f), 2244, 200, box, 2244)!!, 0.01f)
        assertEquals(0.4f, HpBar.read(screen(0.4f), 2244, 200, box, 2244)!!, 0.01f)
        assertEquals(0.05f, HpBar.read(screen(0.05f, red), 2244, 200, box, 2244)!!, 0.01f)
    }

    @Test
    fun `no bar gives null`() {
        assertNull(HpBar.read(IntArray(2244 * 200) { bg }, 2244, 200, box, 2244))
        assertNull(HpBar.read(screen(0f), 2244, 200, box, 2244))
    }

    @Test
    fun `colours`() {
        assertEquals(true, HpBar.isFill(green))
        assertEquals(true, HpBar.isFill(red))
        assertEquals(true, HpBar.isFill(0xFFE8C030.toInt())) // yellow
        assertEquals(false, HpBar.isFill(0xFFE650B4.toInt())) // pink (gender sign)
        assertEquals(false, HpBar.isFill(0xFF3C78DC.toInt())) // blue
        assertEquals(false, HpBar.isFill(track))
    }

    /**
     * The Pixel screenshot the numbers came from, as raw RGBA (2244x1008) when it is on this machine
     * (never committed): sharp('battle-15x.png').ensureAlpha().raw().toBuffer(), written to battle-15x.rgba
     */
    @Test
    fun `reads full HP on the real move-menu screenshot`() {
        val f = generateSequence(File("").absoluteFile) { it.parentFile }
            .map { File(it, ".superpowers/screenshots/pixel/battle-15x.rgba") }
            .firstOrNull { it.exists() }
        assumeTrue(f != null)
        val w = 2244; val h = 1008
        val b = f!!.readBytes()
        val px = IntArray(w * h) { i ->
            val o = i * 4
            (0xFF shl 24) or ((b[o].toInt() and 0xFF) shl 16) or ((b[o + 1].toInt() and 0xFF) shl 8) or (b[o + 2].toInt() and 0xFF)
        }
        val name = OcrLine("Drowzee Lv. 17", 56, 134, 305, 168)
        assertEquals(1f, HpBar.read(px, w, h, name, w)!!, 0.02f)
    }
}
