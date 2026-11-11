package com.pokemmo.tool.overlay.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.LocalTextStyle
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** The two 32x32 animation frames of a menu icon (the party "bounce"). */
class IconFrames(val frame0: ImageBitmap, val frame1: ImageBitmap)

/**
 * Loads the ROM-extracted icons from assets: overlay/icons/{id}.png (32x64, two frames) and
 * overlay/items/{name}.png (32x32). Missing assets give null, never an exception.
 */
class IconCache(private val context: Context) {
    private val mons = LruCache<Int, IconFrames>(96)
    private val items = HashMap<String, ImageBitmap?>()

    private fun decode(path: String): Bitmap? = try {
        context.assets.open(path).use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inScaled = false })
        }
    } catch (e: Exception) {
        null
    }

    fun pokemon(id: Int): IconFrames? {
        mons.get(id)?.let { return it }
        val bmp = decode("overlay/icons/$id.png") ?: return null
        val half = bmp.height / 2
        if (half <= 0) return null
        val frames = IconFrames(
            Bitmap.createBitmap(bmp, 0, 0, bmp.width, half).asImageBitmap(),
            Bitmap.createBitmap(bmp, 0, half, bmp.width, half).asImageBitmap(),
        )
        mons.put(id, frames)
        return frames
    }

    fun item(name: String): ImageBitmap? = items.getOrPut(name) { decode("overlay/items/$name.png")?.asImageBitmap() }
}

private val GREYSCALE = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) })

/** True when the background panel is off: text and pixel art then get a soft drop shadow. */
val LocalNoPanel = staticCompositionLocalOf { false }

private val SHADOW = Color(0xCC000000)
private val SHADOW_DY = 1.5.dp

/** Provides the panel-off look (shadows on all text and pixel art) to [content]. */
@Composable
fun PanelStyle(panel: Boolean, content: @Composable () -> Unit) {
    if (panel) {
        CompositionLocalProvider(LocalNoPanel provides false, content = content)
        return
    }
    val d = LocalDensity.current
    val shadow = with(d) { Shadow(SHADOW, Offset(0f, SHADOW_DY.toPx()), 3.dp.toPx()) }
    CompositionLocalProvider(
        LocalNoPanel provides true,
        LocalTextStyle provides LocalTextStyle.current.copy(shadow = shadow),
        content = content,
    )
}

private val SHADOW_FILTER = ColorFilter.tint(SHADOW)

@Composable
private fun PixelImage(img: ImageBitmap?, size: Dp, faded: Boolean, modifier: Modifier) {
    if (img == null) {
        Box(modifier.size(size))
        return
    }
    val alpha = if (faded) FADED_ALPHA else 1f
    Box(modifier.size(size)) {
        if (LocalNoPanel.current) {
            // A blur-free offset copy in black: a crisp pixel drop shadow.
            Image(
                img, null, Modifier.size(size).offset(y = SHADOW_DY),
                alpha = alpha, colorFilter = SHADOW_FILTER, filterQuality = FilterQuality.None,
            )
        }
        Image(
            img, null, Modifier.size(size),
            alpha = alpha,
            colorFilter = if (faded) GREYSCALE else null,
            filterQuality = FilterQuality.None,
        )
    }
}

/** A Pokémon menu icon, crisp. [frame] 0 or 1. Faded = greyscale at [FADED_ALPHA]. */
@Composable
fun PixelIcon(
    cache: IconCache,
    id: Int,
    size: Dp,
    frame: Int = 0,
    modifier: Modifier = Modifier,
    faded: Boolean = false,
) {
    val frames = remember(id) { cache.pokemon(id) }
    PixelImage(if (frame == 0) frames?.frame0 else frames?.frame1, size, faded, modifier)
}

/** The Poké Ball item icon: full colour when caught, grey and faint when not (or unknown). */
@Composable
fun BallIcon(cache: IconCache, caught: Boolean, size: Dp, modifier: Modifier = Modifier) {
    val img = remember { cache.item("ball-poke") }
    PixelImage(img, size, faded = !caught, modifier = modifier)
}

/** An 8x8 pixel drawing: (x, y, w, h, argb) cells. */
class PixelArt(val cells: List<IntArray>, val colors: List<Long>)

private fun art(vararg r: Pair<IntArray, Long>) = PixelArt(r.map { it.first }, r.map { it.second })
private fun r(x: Int, y: Int, w: Int, h: Int) = intArrayOf(x, y, w, h)

private const val GRASS_DARK = 0xFF3F9A3A
private const val GRASS_MID = 0xFF7BD45A
private const val GRASS_LIGHT = 0xFF9AE86F
private const val WAVE_LIGHT = 0xFF8FD0FF
private const val WAVE_DARK = 0xFF4F9BE8
private const val ROD_WOOD = 0xFFC99A5B
private const val LINE = 0xFFE8E8E8
private const val ROCK = 0xFFA39282
private const val ROCK_LIGHT = 0xFFCDBBA6
private const val CAVE_DARK = 0xFF26221F
private const val STAR = 0xFFF0C84A
private const val STAR_LIGHT = 0xFFFFF3B0

/** GRASS, SURF and ROD are copied from the approved mockup (strip-x-style.html). */
val MARK_ART: Map<CatchMark, PixelArt> = mapOf(
    CatchMark.GRASS to art(
        r(0, 7, 8, 1) to GRASS_DARK, r(1, 3, 1, 4) to GRASS_MID, r(2, 5, 1, 2) to GRASS_MID,
        r(3, 1, 1, 6) to GRASS_LIGHT, r(4, 4, 1, 3) to GRASS_MID, r(5, 2, 1, 5) to GRASS_MID,
        r(6, 4, 1, 3) to GRASS_LIGHT,
    ),
    CatchMark.SURF to art(
        r(0, 3, 2, 1) to WAVE_LIGHT, r(2, 2, 2, 1) to WAVE_LIGHT, r(4, 3, 2, 1) to WAVE_LIGHT,
        r(6, 2, 2, 1) to WAVE_LIGHT, r(0, 6, 2, 1) to WAVE_DARK, r(2, 5, 2, 1) to WAVE_DARK,
        r(4, 6, 2, 1) to WAVE_DARK, r(6, 5, 2, 1) to WAVE_DARK,
    ),
    CatchMark.ROD to art(
        r(0, 7, 1, 1) to ROD_WOOD, r(1, 6, 1, 1) to ROD_WOOD, r(2, 5, 1, 1) to ROD_WOOD,
        r(3, 4, 1, 1) to ROD_WOOD, r(4, 3, 1, 1) to ROD_WOOD, r(5, 2, 1, 1) to ROD_WOOD,
        r(6, 1, 1, 1) to ROD_WOOD, r(7, 1, 1, 4) to LINE, r(6, 5, 1, 1) to LINE, r(6, 4, 1, 1) to LINE,
    ),
    // A dark cave mouth in a rock arch.
    CatchMark.CAVE to art(
        r(2, 1, 4, 1) to ROCK, r(2, 1, 2, 1) to ROCK_LIGHT, r(1, 2, 1, 1) to ROCK, r(6, 2, 1, 1) to ROCK,
        r(0, 3, 1, 5) to ROCK, r(7, 3, 1, 5) to ROCK, r(2, 2, 4, 1) to CAVE_DARK, r(1, 3, 6, 5) to CAVE_DARK,
    ),
    // A small sparkle: headbutt trees, rocks, honey trees and anything unknown.
    CatchMark.SPECIAL to art(
        r(3, 0, 2, 8) to STAR, r(0, 3, 8, 2) to STAR, r(2, 2, 4, 4) to STAR, r(3, 3, 2, 2) to STAR_LIGHT,
    ),
)

/** The drawer's open-tab chevron, from drawer.html. */
val CHEVRON_UP = art(r(1, 5, 1, 1) to LINE, r(2, 4, 1, 1) to LINE, r(3, 3, 2, 1) to LINE, r(5, 4, 1, 1) to LINE, r(6, 5, 1, 1) to LINE)

/** Draws [art] on an 8x8 grid with hard edges. */
@Composable
fun PixelArtView(art: PixelArt, size: Dp, modifier: Modifier = Modifier, alpha: Float = 1f) {
    val shadow = LocalNoPanel.current
    Canvas(modifier.size(size)) {
        val cell = this.size.width / 8f
        if (shadow) {
            val dy = SHADOW_DY.toPx()
            art.cells.forEach { c ->
                drawRect(SHADOW, Offset(c[0] * cell, c[1] * cell + dy), Size(c[2] * cell, c[3] * cell), alpha = alpha)
            }
        }
        art.cells.forEachIndexed { i, c ->
            drawRect(
                Color(art.colors[i]),
                topLeft = Offset(c[0] * cell, c[1] * cell),
                size = Size(c[2] * cell, c[3] * cell),
                alpha = alpha,
            )
        }
    }
}

@Composable
fun CatchMarkIcon(mark: CatchMark, size: Dp, modifier: Modifier = Modifier, faded: Boolean = false) {
    PixelArtView(MARK_ART.getValue(mark), size, modifier, if (faded) FADED_MARK_ALPHA else 1f)
}

/** A small solid pill in the type's colour. */
@Composable
fun TypePill(type: String, fontSize: TextUnit = 9.sp, modifier: Modifier = Modifier) {
    Text(
        type.uppercase(),
        color = Color.White,
        fontSize = fontSize,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.04.sp * fontSize.value,
        modifier = modifier
            .background(typeColor(type), RoundedCornerShape(3.dp))
            .padding(horizontal = 4.dp, vertical = 1.dp),
    )
}
