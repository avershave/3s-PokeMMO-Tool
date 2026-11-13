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
    fun `poke great and ultra always come first, by name`() {
        val v = Catch.view(mon(), level = 40, hp = 1f, safari = false)!!
        assertEquals(listOf(Ball.POKE, Ball.GREAT, Ball.ULTRA), v.basic.map { it.ball })
        assertTrue(v.best.isEmpty()) // nothing special about a level 40 Normal type
    }

    @Test
    fun `best lists balls that beat ultra now, with the reason`() {
        // Mankey Lv. 16 (catch rate 190): the Nest Ball is 4x.
        val v = Catch.view(mon(rate = 190), level = 16, hp = 1f, safari = false)!!
        val best = v.best.single()
        assertEquals(Ball.NEST, best.ball)
        assertEquals("low level", best.note)
        assertTrue(best.percent > v.basic.last().percent)
        assertFalse(v.more.any { it.ball == Ball.NEST })
    }

    @Test
    fun `more lists the rest best first, conditions only when they help`() {
        val v = Catch.view(mon(), level = 40, hp = 1f, safari = false)!!
        assertEquals(v.more.sortedByDescending { it.percent }, v.more)
        val plain = v.basic.first().percent
        val quick = v.more.single { it.ball == Ball.QUICK }
        assertEquals("on turn 1", quick.note)
        assertTrue(quick.percent > plain)
        // A 1x Net Ball has no reason attached.
        assertEquals(null, v.more.single { it.ball == Ball.NET }.note)
        assertTrue(v.more.single { it.ball == Ball.HEAVY }.upTo)
    }

    @Test
    fun `no catch rate, nothing to show`() {
        assertEquals(null, Catch.view(PokemonData(1, "X", listOf("Normal")), 10, 1f, false))
    }
}
