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
 * Owns the overlay windows (route drawer, battle panel, detail card). Created by CaptureService
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
    private val icons = IconCache(context)

    private data class OpenCard(val id: Int, val card: Card)

    // Compose state read by the hosted views.
    private var drawerModel by mutableStateOf(DrawerModel(emptyList(), emptyList(), true))
    private var drawerOpen by mutableStateOf(false) // never reset by route or state changes
    private var drawerShowAll by mutableStateOf(false)
    private var iconDp by mutableStateOf(28.dp)
    private var drawerMaxDp by mutableStateOf(400.dp)
    private var drawerBodyMaxDp by mutableStateOf(300.dp)
    private var groups by mutableStateOf<List<OpponentGroup>>(emptyList())
    // Kept here, not in remember, so the card comes back unchanged after a suspected battle hides it.
    private var openCard by mutableStateOf<OpenCard?>(null)
    private var cardRow by mutableStateOf<Int?>(null)
    private var cardWidthDp by mutableStateOf(400.dp)
    private var cardMaxHeightDp by mutableStateOf(300.dp)
    private var panelMaxDp by mutableStateOf(DpSize(150.dp, 300.dp))

    private var current: ScreenState = ScreenState.Idle
    private var battleSuspected = false
    private var disposed = false

    private var drawerView: ComposeView? = null
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
        if (areaOf(prev) != areaOf(s)) drawerShowAll = false
        // A route change or a confirmed battle closes the card; the drawer stays as it was.
        if (areaOf(prev) != areaOf(s) || prev::class != s::class) closeCard()
        render()
    }

    private fun onSuspected(v: Boolean) = guarded {
        if (battleSuspected == v) return@guarded
        battleSuspected = v
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

    private fun newView(content: @androidx.compose.runtime.Composable () -> Unit): ComposeView =
        ComposeView(context).also {
            it.setViewTreeLifecycleOwner(owner)
            it.setViewTreeSavedStateRegistryOwner(owner)
            it.setContent(content)
        }

    // isAttachedToWindow lags addView by a traversal, so track adds explicitly.
    private val added = HashSet<View>()

    // Measured widths of the centred windows; used to compute x ourselves (see centredX).
    private var drawerWidthPx = 0
    private var drawerHeightPx = 0
    private var drawerX = 0

    // Keep this init block AFTER every field above. The collector runs on Dispatchers.Main.immediate,
    // so while the object is still being constructed on Main it renders the current Idle state
    // straight away. Fields declared below this block are still null then, which throws an NPE
    // (swallowed by guarded), and StateFlow never re-emits an equal Idle value, so the drawer would
    // never appear at start-up.
    init {
        context.registerComponentCallbacks(callbacks)
        scope.launch { OverlayStateBus.state.collect { onState(it) } }
        scope.launch { OverlayStateBus.battleSuspected.collect { onSuspected(it) } }
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

        val vis = visibility(s, battleSuspected, drawerOpen, openCard != null)

        // Route drawer: top centre, hanging from the top edge.
        if (vis.drawer) {
            val rect = ScreenRegions.DRAWER_AREA.toPixels(m.widthPixels, m.heightPixels)
            iconDp = (iconSizePx(m.widthPixels, m.heightPixels) / density).dp
            drawerMaxDp = (rect.width / density).dp
            drawerBodyMaxDp = (rect.height / density).dp - iconDp
            drawerModel = buildDrawer((s as? ScreenState.Overworld)?.area, repo)
            val view = drawerView ?: newView {
                DrawerView(
                    model = drawerModel,
                    open = drawerOpen,
                    selectedId = openCard?.id,
                    panel = true,
                    icons = icons,
                    iconSize = iconDp,
                    maxWidth = drawerMaxDp,
                    showAll = drawerShowAll,
                    maxBodyHeight = drawerBodyMaxDp,
                    onTab = { onTab() },
                    onItem = { onDrawerItem(it) },
                    onOverflow = {
                        drawerShowAll = true
                        closeCard()
                        render()
                    },
                )
            }.also {
                drawerView = it
                it.addOnLayoutChangeListener { _, l, t, r, b, _, _, _, _ ->
                    val w = r - l
                    val h = b - t
                    if (w > 0 && (w != drawerWidthPx || h != drawerHeightPx)) {
                        drawerWidthPx = w
                        drawerHeightPx = h
                        render()
                    }
                }
            }
            val p = baseParams(0, WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
            p.x = centredX((rect.left + rect.right) / 2, drawerWidthPx)
            p.y = 0
            drawerX = p.x
            show(view, p)
        } else {
            hide(drawerView)
        }

        // Battle panel.
        if (vis.panel && s is ScreenState.Battle && s.groups.isNotEmpty()) {
            groups = s.groups
            val rect = ScreenRegions.BATTLE_PANEL.toPixels(m.widthPixels, m.heightPixels)
            panelMaxDp = DpSize((rect.width / density).dp, (rect.height / density).dp)
            val view = panelView ?: newView {
                BattlePanelView(
                    groups = groups,
                    repo = repo,
                    icons = icons,
                    maxWidth = panelMaxDp.width,
                    maxHeight = panelMaxDp.height,
                    onGroup = {},
                )
            }.also { panelView = it }
            val p = baseParams(0, WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
            p.x = rect.left
            p.y = rect.top
            show(view, p)
        } else {
            hide(panelView)
        }

        if (vis.card) renderCard(m) else hide(cardView)
    }

    /** The card hangs under the drawer window with the same x and width. */
    private fun renderCard(m: DisplayMetrics) {
        val oc = openCard
        if (oc == null || drawerWidthPx == 0 || drawerHeightPx == 0) {
            hide(cardView)
            return
        }
        val density = m.density
        val area = ScreenRegions.DRAWER_AREA.toPixels(m.widthPixels, m.heightPixels)
        val place = cardPlacement(
            com.pokemmo.tool.overlay.capture.IntRect(drawerX, 0, drawerX + drawerWidthPx, drawerHeightPx),
            m.heightPixels, area.bottom,
        )
        cardWidthDp = (place.width / density).dp
        cardMaxHeightDp = (place.maxHeight / density).dp
        val view = cardView ?: newView {
            val c = openCard
            if (c != null) {
                DetailCardView(
                    card = c.card,
                    id = c.id,
                    icons = icons,
                    panel = true,
                    width = cardWidthDp,
                    maxHeight = cardMaxHeightDp,
                    iconSize = iconDp,
                    expandedRow = cardRow,
                    onRow = { i -> cardRow = if (cardRow == i) null else i },
                )
            }
        }.also { cardView = it }
        val p = baseParams(0, WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
        p.x = place.x
        p.y = place.y
        show(view, p)
    }

    private fun onTab() {
        drawerOpen = !drawerOpen
        if (!drawerOpen) {
            drawerShowAll = false
            closeCard()
        }
        render()
    }

    private fun onDrawerItem(id: Int) {
        if (openCard?.id == id) {
            closeCard()
            render()
            return
        }
        val area = (current as? ScreenState.Overworld)?.area ?: return
        val spawn = area.spawns.firstOrNull { it.id == id }
        val horde = spawn?.encounters?.mapNotNull { it.hordeSize }?.maxOrNull()
        openCard = OpenCard(id, buildCard(id, repo, spawn, area, horde))
        cardRow = null // every row starts closed
        render()
    }

    private fun closeCard() {
        openCard = null
        cardRow = null
        hide(cardView)
    }

    /** Removes all windows and releases everything. Call on Main. */
    fun dispose() {
        if (disposed) return
        disposed = true
        scope.cancel()
        context.unregisterComponentCallbacks(callbacks)
        hide(cardView); hide(panelView); hide(drawerView)
        cardView = null; panelView = null; drawerView = null
        owner.stop()
    }

}
