package com.pokemmo.tool.overlay.battle

import com.pokemmo.tool.overlay.data.PokemonData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CatchTest {
    private fun mon(types: List<String> = listOf("Normal"), rate: Int = 45, speed: Int = 50, moon: Boolean = false, friend: Boolean = false) =
        PokemonData(1, "Test", types, catchRate = rate, speed = speed, moonStone = moon, friendship = friend)

    private fun multiplier(p: PokemonData, ball: Ball, level: Int = 30) =
        Catch.balls(p, level, safari = false).single { it.ball == ball }.multiplier

    @Test
    fun `matches mmobreeder's worked examples for catch rate 45`() {
        assertEquals(5.9f, Catch.chance(45, 1f, 1f) * 100, 0.1f) // Poké Ball, full HP
        assertEquals(17.6f, Catch.chance(45, 0f, 1f) * 100, 0.3f) // Poké Ball, 1 HP
        assertEquals(70.6f, Catch.chance(45, 0f, 2f, status = 2f) * 100, 0.3f) // Ultra Ball, asleep, 1 HP
    }

    @Test
    fun `a high enough rate is certain`() {
        assertEquals(1f, Catch.chance(255, 0f, 1f), 0f)
        assertEquals(0f, Catch.chance(0, 0f, 2f), 0f)
    }

    @Test
    fun `less HP means a better chance`() {
        assertTrue(Catch.chance(45, 0.3f, 1f) > Catch.chance(45, 0.7f, 1f))
    }

    @Test
    fun `net ball only on water and bug`() {
        assertEquals(3.5f, multiplier(mon(listOf("Bug", "Flying")), Ball.NET))
        assertEquals(1f, multiplier(mon(), Ball.NET))
    }

    @Test
    fun `nest ball falls from 4x at level 16 to 1x at 31`() {
        assertEquals(4f, multiplier(mon(), Ball.NEST, level = 10))
        assertEquals(4f, multiplier(mon(), Ball.NEST, level = 16))
        assertEquals(2.2f, multiplier(mon(), Ball.NEST, level = 25), 0.001f)
        assertEquals(1f, multiplier(mon(), Ball.NEST, level = 40))
    }

    @Test
    fun `moon friend and fast balls follow the species`() {
        assertEquals(4f, multiplier(mon(moon = true), Ball.MOON))
        assertEquals(2.5f, multiplier(mon(friend = true), Ball.FRIEND))
        assertEquals(4f, multiplier(mon(speed = 100), Ball.FAST))
        assertEquals(1f, multiplier(mon(speed = 99), Ball.FAST))
    }

    @Test
    fun `safari ball only in the safari zone`() {
        assertFalse(Catch.balls(mon(), 30, safari = false).any { it.ball == Ball.SAFARI })
        assertTrue(Catch.balls(mon(), 30, safari = true).any { it.ball == Ball.SAFARI })
    }

    @Test
    fun `chips merge equal chances and sort best first`() {
        val (now, ifs) = Catch.chips(mon(), level = 40, hp = 1f, safari = false)
        assertEquals(now.sortedByDescending { it.percent }, now)
        assertEquals(now.size, now.map { it.percent }.toSet().size)
        // Ultra and Cherish (2x) share a chip; Poké, Luxury and the 1x specials share another.
        assertTrue(now.any { Ball.ULTRA in it.balls && Ball.CHERISH in it.balls })
        assertTrue(now.any { Ball.POKE in it.balls && Ball.LUXURY in it.balls && Ball.NET in it.balls })
        // Every conditional ball beats a Poké Ball, or it would not be listed.
        val plain = now.single { Ball.POKE in it.balls }.percent
        assertTrue(ifs.all { it.percent > plain && it.condition != null })
        assertEquals(ifs.sortedByDescending { it.percent }, ifs)
    }

    @Test
    fun `no catch rate, no chips`() {
        val (now, ifs) = Catch.chips(PokemonData(1, "X", listOf("Normal")), 10, 1f, false)
        assertTrue(now.isEmpty() && ifs.isEmpty())
    }
}
