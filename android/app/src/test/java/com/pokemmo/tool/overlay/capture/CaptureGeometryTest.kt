package com.pokemmo.tool.overlay.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CaptureGeometryTest {
    @Test
    fun `only a size change triggers a resize`() {
        assertTrue(CaptureGeometry.needsResize(2400, 1080, 2244, 1008))
        assertFalse(CaptureGeometry.needsResize(2400, 1080, 2400, 1080))
        assertFalse(CaptureGeometry.needsResize(2400, 1080, 0, 0))
    }

    @Test
    fun `capture size is landscape whichever way the phone is held`() {
        assertEquals(2244, CaptureGeometry.landscapeWidth(1008, 2244))
        assertEquals(1008, CaptureGeometry.landscapeHeight(1008, 2244))
        assertEquals(2244, CaptureGeometry.landscapeWidth(2244, 1008))
        assertEquals(1008, CaptureGeometry.landscapeHeight(2244, 1008))
    }

    @Test
    fun `portrait is not landscape`() {
        assertFalse(CaptureGeometry.isLandscape(1080, 2400))
        assertTrue(CaptureGeometry.isLandscape(2400, 1080))
    }
}
