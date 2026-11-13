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
import android.widget.FrameLayout
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
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
import com.pokemmo.tool.overlay.OverlaySettings
import com.pokemmo.tool.overlay.capture.IntRect
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

/**
 * Root of each overlay window. Android first measures a wrap-content window at 320 dp wide
 * (config_prefDialogWidth) and keeps that unless the content reports it is too small; Compose
 * never does, so wide content (the card, a full drawer) was cut to 720 px on a 2244 px screen.
 * The content is measured here against the whole screen and its real size reported.
 */
private class WideWindowFrame(context: Context, val compose: ComposeView) : FrameLayout(context) {
    init {
        addView(compose)
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val mode = MeasureSpec.getMode(widthMeasureSpec)
        val size = MeasureSpec.getSize(widthMeasureSpec)
        val screen = resources.displayMetrics.let { maxOf(it.widthPixels, it.heightPixels) }
        val childWidth = if (mode == MeasureSpec.AT_MOST) {
            MeasureSpec.makeMeasureSpec(maxOf(size, screen), MeasureSpec.AT_MOST)
        } else {
            widthMeasureSpec
        }
        compose.measure(childWidth, heightMeasureSpec)
        setMeasuredDimension(
            resolveSizeAndState(compose.measuredWidth, widthMeasureSpec, compose.measuredState),
            resolveSizeAndState(
                compose.measuredHeight, heightMeasureSpec,
                compose.measuredState shl MEASURED_HEIGHT_STATE_SHIFT,
            ),
        )
    }
}

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
    private var panelRow by mutableStateOf<PanelRow?>(null)
    private var panelCollapsed by mutableStateOf(false)
    private var panelSafari by mutableStateOf(false)

    // Where the player dragged the panel, from its default spot (BATTLE_PANEL's corner); saved.
    private var panelDx = OverlaySettings.panelOffset.first
    private var panelDy = OverlaySettings.panelOffset.second
    private var panelParams: WindowManager.LayoutParams? = null
    private val panelDrag = object : PanelDrag {
        private var fromX = 0
        private var fromY = 0
        override fun start() { fromX = panelDx; fromY = panelDy }
        override fun moveBy(dx: Float, dy: Float) = guarded {
            panelDx = fromX + dx.toInt()
            panelDy = fromY + dy.toInt()
            placePanel()
        }
        override fun end() = OverlaySettings.setPanelOffset(panelDx, panelDy)
    }

    private var panelBg by mutableStateOf(true) // OverlaySettings.panelBackground, applied live
    private var current: ScreenState = ScreenState.Idle
    private var battleSuspected = false
    private var disposed = false

    private var drawerView: View? = null
    private var panelView: View? = null
    private var cardView: View? = null

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
        // A season read changes the area's spawns but not the place, so it closes nothing.
        val moved = !samePlace(areaOf(prev), areaOf(s))
        if (moved) drawerShowAll = false
        // A route change or a confirmed battle closes the card; the drawer stays as it was.
        if (moved || prev::class != s::class) closeCard()
        if (prev::class != s::class) {
            panelRow = null // each battle starts with every row closed
            panelCollapsed = false // and with the panel open, even if the last one was folded
        }
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

    /** Hosts [content] drawn at [ScreenRegions.UI_SCALE]: every dp and sp inside is that much bigger. */
    private fun newView(content: @androidx.compose.runtime.Composable () -> Unit): View =
        WideWindowFrame(context, ComposeView(context)).also {
            it.setViewTreeLifecycleOwner(owner)
            it.setViewTreeSavedStateRegistryOwner(owner)
            it.compose.setContent {
                val d = LocalDensity.current
                CompositionLocalProvider(
                    LocalDensity provides Density(d.density * ScreenRegions.UI_SCALE, d.fontScale),
                    content = content,
                )
            }
        }

    // isAttachedToWindow lags addView by a traversal, so track adds explicitly.
    private val added = HashSet<View>()

    // Measured widths of the centred windows; used to compute x ourselves (see centredX).
    private var drawerWidthPx = 0
    private var drawerHeightPx = 0
    private var drawerXPx = 0

    // Keep this init block AFTER every field above. The collector runs on Dispatchers.Main.immediate,
    // so while the object is still being constructed on Main it renders the current Idle state
    // straight away. Fields declared below this block are still null then, which throws an NPE
    // (swallowed by guarded), and StateFlow never re-emits an equal Idle value, so the drawer would
    // never appear at start-up.
    init {
        context.registerComponentCallbacks(callbacks)
        scope.launch { OverlayStateBus.state.collect { onState(it) } }
        scope.launch { OverlayStateBus.battleSuspected.collect { onSuspected(it) } }
        scope.launch { OverlaySettings.panelBackground.collect { panelBg = it } }
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
        // Px to dp inside the windows, which draw at UI_SCALE (see newView). Icons are sized in px
        // already (whole multiples of the art), so they convert with the same density.
        val density = m.density * ScreenRegions.UI_SCALE
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
                    panel = panelBg,
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
            drawerXPx = p.x
            show(view, p)
        } else {
            hide(drawerView)
        }

        // Battle panel.
        if (vis.panel && s is ScreenState.Battle && s.groups.isNotEmpty()) {
            groups = s.groups
            panelSafari = s.area?.name?.contains("Safari", ignoreCase = true) == true
            iconDp = (iconSizePx(m.widthPixels, m.heightPixels) / density).dp
            val rect = ScreenRegions.BATTLE_PANEL.toPixels(m.widthPixels, m.heightPixels)
            panelMaxDp = DpSize((rect.width / density).dp, (rect.height / density).dp)
            val view = panelView ?: newView {
                BattlePanelView(
                    groups = groups,
                    repo = repo,
                    icons = icons,
                    panel = panelBg,
                    width = panelMaxDp.width,
                    maxHeight = panelMaxDp.height,
                    iconSize = iconDp,
                    expanded = panelRow,
                    onRow = { r -> panelRow = if (panelRow == r) null else r },
                    collapsed = panelCollapsed,
                    onCollapse = { panelCollapsed = it },
                    safari = panelSafari,
                    drag = panelDrag,
                )
            }.also { panelView = it }
            panelParams = baseParams(0, WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
            placePanel()
        } else {
            hide(panelView)
        }

        if (vis.card) renderCard(m) else hide(cardView)
    }

    /** Puts the panel window at its default spot plus the drag offset, kept wholly on screen. */
    private fun placePanel() {
        val v = panelView ?: return
        val p = panelParams ?: return
        val m = metrics()
        val rect = ScreenRegions.BATTLE_PANEL.toPixels(m.widthPixels, m.heightPixels)
        p.x = (rect.left + panelDx).coerceIn(0, (m.widthPixels - v.width).coerceAtLeast(0))
        p.y = (rect.top + panelDy).coerceIn(0, (m.heightPixels - v.height).coerceAtLeast(0))
        panelDx = p.x - rect.left
        panelDy = p.y - rect.top
        show(v, p)
    }

    /** The card hangs under the drawer window with the same x and width. */
    private fun renderCard(m: DisplayMetrics) {
        val oc = openCard
        if (oc == null || drawerWidthPx == 0 || drawerHeightPx == 0) {
            hide(cardView)
            return
        }
        val density = m.density * ScreenRegions.UI_SCALE
        val area = ScreenRegions.CARD_AREA.toPixels(m.widthPixels, m.heightPixels)
        val place = cardPlacement(
            drawerBottom = drawerHeightPx,
            area = area,
            screenH = m.heightPixels,
            maxBottom = (ScreenRegions.CARD_MAX_BOTTOM * m.heightPixels).toInt(),
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
                    panel = panelBg,
                    width = cardWidthDp,
                    maxHeight = cardMaxHeightDp,
                    iconSize = iconDp,
                    expandedRow = cardRow,
                    onRow = { i -> cardRow = if (cardRow == i) null else i },
                )
            }
        }.also {
            cardView = it
            // A tap anywhere but the card or the drawer closes the card. The tap still reaches the
            // game as well: the overlay only hears that it happened.
            it.setOnTouchListener { _, e ->
                if (e.actionMasked != MotionEvent.ACTION_OUTSIDE) return@setOnTouchListener false
                guarded {
                    val drawer = if (drawerView?.let { v -> v in added } == true) {
                        IntRect(drawerXPx, 0, drawerXPx + drawerWidthPx, drawerHeightPx)
                    } else {
                        null
                    }
                    if (openCard != null && outsideTapClosesCard(e.rawX, e.rawY, drawer)) {
                        closeCard()
                        render()
                    }
                }
                true
            }
        }
        val p = baseParams(
            WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
        )
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
