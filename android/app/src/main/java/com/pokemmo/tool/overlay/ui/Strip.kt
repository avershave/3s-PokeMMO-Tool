package com.pokemmo.tool.overlay.ui

import android.content.Context
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val PanelBg = Color(PANEL_BG_ARGB)
val PanelText = Color(0xFFE8EAF0)
val PanelMuted = Color(0xFFA0A6B8)

fun TagKind.color() = Color(argb)

/** Sprites are 96x96 webp assets; a small LRU keeps the strip cheap to redraw. */
class SpriteCache(private val context: Context) {
    private val cache = LruCache<Int, ImageBitmap>(64)

    fun get(id: Int): ImageBitmap? {
        cache.get(id)?.let { return it }
        val bmp = try {
            context.assets.open("overlay/sprites/$id.webp").use { BitmapFactory.decodeStream(it) }
        } catch (e: Exception) {
            null
        } ?: return null
        return bmp.asImageBitmap().also { cache.put(id, it) }
    }
}

@Composable
fun Sprite(sprites: SpriteCache, id: Int, size: Dp, modifier: Modifier = Modifier) {
    val img = remember(id) { sprites.get(id) }
    if (img != null) {
        Image(img, null, modifier.size(size), filterQuality = FilterQuality.None)
    } else {
        Box(modifier.size(size))
    }
}

/**
 * The slim strip: route name and spawn sprites. Valuable spawns get a colored outline, the
 * rest are dimmed. No level text is ever drawn here (see the overlay text rule).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun StripView(
    model: StripModel?,
    sprites: SpriteCache,
    spriteSize: Dp,
    maxWidth: Dp,
    onItem: (StripItem) -> Unit,
    onOverflow: () -> Unit,
) {
    Box(
        Modifier
            .widthIn(max = maxWidth)
            .background(PanelBg, RoundedCornerShape(10.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        if (model == null) {
            Text("Looking for route…", color = PanelMuted, fontSize = 12.sp)
        } else {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
                itemVerticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    model.title,
                    color = PanelText,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(end = 4.dp),
                )
                if (model.empty) {
                    Text(EMPTY_STRIP_TEXT, color = PanelMuted, fontSize = 12.sp)
                }
                model.items.forEach { item ->
                    val shape = RoundedCornerShape(5.dp)
                    val frame = item.outline?.let { Modifier.border(2.dp, it.color(), shape) } ?: Modifier
                    Sprite(
                        sprites, item.id, spriteSize,
                        Modifier
                            .alpha(if (item.dimmed) 0.4f else 1f)
                            .then(frame)
                            .clickable { onItem(item) },
                    )
                }
                if (model.overflow > 0) {
                    Text(
                        "+${model.overflow}",
                        color = PanelText,
                        fontSize = 12.sp,
                        modifier = Modifier
                            .clickable { onOverflow() }
                            .background(Color(0xFF3A3F52), RoundedCornerShape(8.dp))
                            .padding(horizontal = 6.dp, vertical = 3.dp),
                    )
                }
            }
        }
    }
}
