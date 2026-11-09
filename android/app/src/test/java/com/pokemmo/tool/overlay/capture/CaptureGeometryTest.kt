package com.pokemmo.tool.overlay.capture

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CaptureGeometryTest {
    @Test
    fun `rotation triggers a resize`() {
        assertTrue(CaptureGeometry.needsResize(1080, 2400, 2400, 1080))
        assertFalse(CaptureGeometry.needsResize(2400, 1080, 2400, 1080))
        assertFalse(CaptureGeometry.needsResize(2400, 1080, 0, 0))
    }

    @Test
    fun `portrait is not landscape`() {
        assertFalse(CaptureGeometry.isLandscape(1080, 2400))
        assertTrue(CaptureGeometry.isLandscape(2400, 1080))
    }
}
