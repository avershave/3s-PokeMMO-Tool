package com.pokemmo.tool.overlay.ui

import android.content.ComponentCallbacks
import android.content.Context
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log
import android.view.Display
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.pokemmo.tool.overlay.battle.OpponentGroup
import com.pokemmo.tool.overlay.capture.ScreenRegions
import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.data.OverlayRepository
import com.pokemmo.tool.overlay.state.OverlayStateBus
import com.pokemmo.tool.overlay.state.ScreenState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/** Minimal owner so ComposeViews can live in a Service-hosted window. */
class OverlayLifecycleOwner : LifecycleOwner, SavedStateRegistryOwner {
    private val registry = LifecycleRegistry(this)
    private val controller = SavedStateRegistryController.create(this)

    override val lifecycle: Lifecycle get() = registry
    override val savedStateRegistry: SavedStateRegistry get() = controller.savedStateRegistry

    fun start() {
        controller.performRestore(null)
        registry.currentState = Lifecycle.State.RESUMED
    }

    fun stop() {
        registry.currentState = Lifecycle.State.DESTROYED
    }
}

/**
 * Owns the overlay windows (strip, battle panel, detail card). Created by CaptureService
 * when capture starts and disposed in its shutdown, both on the Main thread.
 */
class OverlayWindows(private val context: Context, initialRepo: OverlayRepository) {
    // Main thread only. Swapped when updated tags arrive; only tags differ between copies.
    private var repo: OverlayRepository = initialRepo

    /** Swaps in a repository with updated tags and re-renders. Main thread only. */
    fun updateRepo(newRepo: OverlayRepository) {
        if (disposed) return
        repo = newRepo
        render()
    }

    private val wm = context.getSystemService(WindowManager::class.java)
    private val owner = OverlayLifecycleOwner().also { it.start() }
    private val scope = CoroutineScope(
        SupervisorJob() + Dispatchers.Main.immediate +
            kotlinx.coroutines.CoroutineExceptionHandler { _, e -> Log.e("OverlayWindows", "overlay scope failed", e) },
    )
    private val sprites = SpriteCache(context)

    private data class OpenCard(val id: Int, val card: Card, val fromBattle: Boolean)

    // Compose state read by the hosted views.
    private var stripModel by mutableStateOf<DrawerModel?>(null)
    private var groups by mutableStateOf<List<OpponentGroup>>(emptyList())
    private var openCard by mutableStateOf<OpenCard?>(null)
    private var stripMaxDp by mutableStateOf(400.dp)
    private var panelMaxDp by mutableStateOf(DpSize(150.dp, 300.dp))

    private var current: ScreenState = ScreenState.Idle
    private var stripExpanded = false
    private var disposed = false

    private var stripView: ComposeView? = null
    private var panelView: ComposeView? = null
    private var cardView: ComposeView? = null

    private val callbacks = object : ComponentCallbacks {
        override fun onConfigurationChanged(newConfig: Configuration) {
            if (!disposed) render()
        }

        @Deprecated("Deprecated in Java")
        override fun onLowMemory() = Unit
    }

    private fun onState(s: ScreenState) = guarded {
        val prev = current
        current = s
        if (areaOf(prev) != areaOf(s) || prev::class != s::class) {
            stripExpanded = false
            closeCard()
        }
        render()
    }

    private fun areaOf(s: ScreenState): Area? = when (s) {
        is ScreenState.Overworld -> s.area
        is ScreenState.Battle -> s.area
        ScreenState.Idle -> null
    }

    private fun metrics(): DisplayMetrics {
        val m = DisplayMetrics()
        @Suppress("DEPRECATION")
        context.getSystemService(DisplayManager::class.java)
            .getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(m)
        return m
    }

    /**
     * ScreenRegions are fractions of the full display (real metrics, same as the capture). To make
     * window coordinates equal capture coordinates the window must be laid out against the whole
     * display, not the frame that excludes the camera cutout and system bars: layout in screen, cutout
     * mode ALWAYS (SHORT_EDGES on API 29), and no fit-insets. Callers then use gravity TOP|START with
     * absolute pixel x/y.
     */
    private fun baseParams(flags: Int, w: Int, h: Int) = WindowManager.LayoutParams(
        w, h,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or flags,
        PixelFormat.TRANSLUCENT,
    ).also {
        it.gravity = Gravity.TOP or Gravity.START
        if (Build.VERSION.SDK_INT >= 30) {
            it.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            it.fitInsetsTypes = 0
            it.fitInsetsSides = 0
        } else {
            it.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
    }

    /** Left edge that centres a window of [widthPx] on [centre]; never off the left of the screen. */
    private fun centredX(centre: Int, widthPx: Int) = (centre - widthPx / 2).coerceAtLeast(0)

    /** Re-renders when a centred window's measured width changes, so x can be recomputed. */
    private fun watchWidth(view: View, set: (Int) -> Int) {
        view.addOnLayoutChangeListener { _, l, _, r, _, _, _, _, _ ->
            val w = r - l
            if (w > 0 && set(w) != w) render()
        }
    }

    private fun newView(content: @androidx.compose.runtime.Composable () -> Unit): ComposeView =
        ComposeView(context).also {
            it.setViewTreeLifecycleOwner(owner)
            it.setViewTreeSavedStateRegistryOwner(owner)
            it.setContent(content)
        }

    // isAttachedToWindow lags addView by a traversal, so track adds explicitly.
    private val added = HashSet<View>()

    // Measured widths of the centred windows; used to compute x ourselves (see centredX).
    private var stripWidthPx = 0
    private var cardWidthPx = 0

    // Keep this init block AFTER every field above. The collector runs on Dispatchers.Main.immediate,
    // so while the object is still being constructed on Main it renders the current Idle state
    // straight away. Fields declared below this block are still null then, which throws an NPE
    // (swallowed by guarded), and StateFlow never re-emits an equal Idle value, so the strip would
    // never appear at start-up.
    init {
        context.registerComponentCallbacks(callbacks)
        scope.launch { OverlayStateBus.state.collect { onState(it) } }
    }

    private fun show(view: View?, params: WindowManager.LayoutParams) {
        if (view == null) return
        try {
            if (view in added) {
                wm.updateViewLayout(view, params)
            } else {
                wm.addView(view, params)
                added.add(view)
            }
        } catch (e: RuntimeException) {
            // E.g. the overlay permission was revoked; keep the capture service alive.
            Log.w("OverlayWindows", "cannot show overlay window", e)
        }
    }

    private fun hide(view: View?) {
        if (view != null && added.remove(view)) {
            try {
                wm.removeViewImmediate(view)
            } catch (e: RuntimeException) {
                Log.w("OverlayWindows", "cannot remove overlay window", e)
            }
        }
    }

    private inline fun guarded(block: () -> Unit) {
        try {
            block()
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            Log.e("OverlayWindows", "overlay update failed", e)
        }
    }

    private fun render() = guarded { renderUnsafe() }

    private fun renderUnsafe() {
        if (disposed) return
        val m = metrics()
        val density = m.density
        val s = current

        // Strip: Idle and Overworld.
        if (s is ScreenState.Battle) {
            hide(stripView)
        } else {
            val rect = ScreenRegions.STRIP_AREA.toPixels(m.widthPixels, m.heightPixels)
            val spritePx = (SPRITE_DP * density).toInt()
            val titleReserve = (TITLE_RESERVE_DP * density).toInt()
            val maxVisible = ((rect.width - titleReserve) / (spritePx + 4 * density)).toInt().coerceAtLeast(1)
            stripModel = buildDrawer((s as? ScreenState.Overworld)?.area, repo)
            stripMaxDp = (rect.width / density).dp
            val view = stripView ?: newView {
                StripView(
                    model = stripModel,
                    sprites = sprites,
                    spriteSize = SPRITE_DP.dp,
                    maxWidth = stripMaxDp,
                    onItem = { onStripItem(it.id) },
                    onOverflow = {
                        stripExpanded = true
                        render()
                    },
                )
            }.also {
                stripView = it
                watchWidth(it) { w -> stripWidthPx.also { stripWidthPx = w } }
            }
            val p = baseParams(0, WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
            p.x = centredX((rect.left + rect.right) / 2, stripWidthPx)
            p.y = rect.top
            show(view, p)
        }

        // Battle panel.
        if (s is ScreenState.Battle && s.groups.isNotEmpty()) {
            groups = s.groups
            val rect = ScreenRegions.BATTLE_PANEL.toPixels(m.widthPixels, m.heightPixels)
            panelMaxDp = DpSize((rect.width / density).dp, (rect.height / density).dp)
            val view = panelView ?: newView {
                BattlePanelView(
                    groups = groups,
                    repo = repo,
                    sprites = sprites,
                    maxWidth = panelMaxDp.width,
                    maxHeight = panelMaxDp.height,
                    onGroup = { g -> onBattleGroup(g) },
                )
            }.also { panelView = it }
            val p = baseParams(0, WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
            p.x = rect.left
            p.y = rect.top
            show(view, p)
        } else {
            hide(panelView)
        }

        renderCard(m)
    }

    private fun renderCard(m: DisplayMetrics) {
        val oc = openCard
        if (oc == null) {
            hide(cardView)
            return
        }
        val density = m.density
        val maxW = (m.widthPixels * 0.4f).toInt()
        val margin = (8 * density).toInt()
        val topY = if (oc.fromBattle) ScreenRegions.BATTLE_PANEL.toPixels(m.widthPixels, m.heightPixels).top
        else ScreenRegions.STRIP_AREA.toPixels(m.widthPixels, m.heightPixels).bottom
        val maxH = (m.heightPixels - topY - margin).coerceAtLeast((80 * density).toInt())
        val view = cardView ?: ComposeView(context).also { v ->
            v.setViewTreeLifecycleOwner(owner)
            v.setViewTreeSavedStateRegistryOwner(owner)
            v.setOnTouchListener { _, e ->
                if (e.action == MotionEvent.ACTION_OUTSIDE) closeCard()
                false
            }
            cardView = v
            watchWidth(v) { w -> cardWidthPx.also { cardWidthPx = w } }
        }
        view.setContent {
            val c = openCard
            if (c != null) {
                DetailCardView(
                    c.card, c.id, sprites,
                    maxWidth = (maxW / density).dp,
                    maxHeight = (maxH / density).dp,
                )
            }
        }
        val p = baseParams(WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
        if (oc.fromBattle) {
            val panel = ScreenRegions.BATTLE_PANEL.toPixels(m.widthPixels, m.heightPixels)
            p.x = panel.right + (6 * density).toInt()
            p.y = panel.top
        } else {
            val strip = ScreenRegions.STRIP_AREA.toPixels(m.widthPixels, m.heightPixels)
            p.x = centredX((strip.left + strip.right) / 2, cardWidthPx)
            p.y = strip.bottom
        }
        show(view, p)
    }

    private fun onStripItem(id: Int) {
        val area = (current as? ScreenState.Overworld)?.area ?: return
        val spawn = area.spawns.firstOrNull { it.id == id }
        val horde = spawn?.encounters?.mapNotNull { it.hordeSize }?.maxOrNull()
        openCard = OpenCard(id, buildCard(id, repo, spawn, area, horde), fromBattle = false)
        render()
    }

    private fun onBattleGroup(g: OpponentGroup) {
        openCard = OpenCard(g.pokemon.id, buildCard(g.pokemon.id, repo, null, null, g.count), fromBattle = true)
        render()
    }

    private fun closeCard() {
        openCard = null
        hide(cardView)
    }

    /** Removes all windows and releases everything. Call on Main. */
    fun dispose() {
        if (disposed) return
        disposed = true
        scope.cancel()
        context.unregisterComponentCallbacks(callbacks)
        hide(cardView); hide(panelView); hide(stripView)
        cardView = null; panelView = null; stripView = null
        owner.stop()
    }

    companion object {
        private const val SPRITE_DP = 28
        private const val TITLE_RESERVE_DP = 110
    }
}
