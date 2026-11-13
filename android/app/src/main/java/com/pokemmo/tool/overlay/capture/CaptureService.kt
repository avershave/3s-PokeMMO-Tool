package com.pokemmo.tool.overlay.capture

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import android.view.Display
import com.pokemmo.tool.overlay.battle.BattleParser
import com.pokemmo.tool.overlay.battle.HpBar
import com.pokemmo.tool.overlay.battle.CaughtDetector
import com.pokemmo.tool.overlay.battle.OcrLine
import com.pokemmo.tool.overlay.battle.OpponentGroup
import com.pokemmo.tool.overlay.data.Area
import com.pokemmo.tool.overlay.data.OverlayRepository
import com.pokemmo.tool.overlay.match.RouteMatcher
import com.pokemmo.tool.overlay.match.Season
import com.pokemmo.tool.overlay.state.OverlayStateBus
import com.pokemmo.tool.overlay.state.ScreenState
import com.pokemmo.tool.overlay.state.ScreenStateMachine
import com.pokemmo.tool.overlay.state.forSeason
import com.pokemmo.tool.overlay.ui.OverlayWindows
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import java.io.File
import com.pokemmo.tool.overlay.data.TagUpdater

/**
 * Foreground service: MediaProjection -> VirtualDisplay -> ImageReader, then every
 * [TICK_MS] OCR the route and battle regions and publish the resulting [ScreenState]
 * to [OverlayStateBus]. Frames and text stay in memory on the phone.
 */
class CaptureService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** Runs teardown; deliberately not cancelled with [scope], since it waits for the loop. */
    private val cleanupScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    @Volatile private var loop: Job? = null

    @Volatile private var projection: MediaProjection? = null
    @Volatile private var display: VirtualDisplay? = null

    // reader/width/height are only touched by the tick loop (and by startCapture before it
    // starts), so a resize swap cannot race with a tick.
    @Volatile private var reader: ImageReader? = null
    @Volatile private var ocr: OcrEngine? = null
    @Volatile private var stopping = false
    private var overlay: OverlayWindows? = null // Main thread only

    private var width = 0
    private var height = 0
    private var dpi = 0
    private var skipNextTick = false

    /** Region of the last confirmed overworld area; passed to the matcher as a tie-break hint. */
    @Volatile private var currentRegion: String? = null

    /** Last season read from the clock line; null (every season's spawns) until one is. */
    private var currentSeason: Season? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            shutdown()
            return START_NOT_STICKY
        }
        if (projection != null || stopping) return START_NOT_STICKY

        try {
            // We were launched with startForegroundService, so always enter the foreground
            // first (also on bad consent), and before getMediaProjection (Android 14+).
            startForeground(
                NOTIFICATION_ID,
                buildNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
            )

            val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
                ?: Activity.RESULT_CANCELED
            val consent: Intent? = if (Build.VERSION.SDK_INT >= 33) {
                intent?.getParcelableExtra(EXTRA_CONSENT, Intent::class.java)
            } else {
                @Suppress("DEPRECATION") intent?.getParcelableExtra(EXTRA_CONSENT)
            }
            check(resultCode == Activity.RESULT_OK && consent != null) { "projection consent denied" }
            startCapture(resultCode, consent)
        } catch (e: Exception) {
            Log.e(TAG, "capture start failed", e)
            shutdown()
        }
        return START_NOT_STICKY
    }

    private fun startCapture(resultCode: Int, consent: Intent) {
        val mgr = getSystemService(MediaProjectionManager::class.java)
        val proj: MediaProjection = mgr.getMediaProjection(resultCode, consent)
            ?: error("MediaProjection unavailable")
        projection = proj

        // Android 14+: the callback must be registered before createVirtualDisplay.
        proj.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                shutdown()
            }
        }, Handler(Looper.getMainLooper()))

        // Always capture at the landscape size, even if started in portrait. Regions are only
        // read in landscape, and resizing the display on rotation stopped frames arriving
        // (Pixel 9 Pro XL, Android 16); the mirror scales portrait content to fit instead.
        val metrics = realMetrics()
        width = CaptureGeometry.landscapeWidth(metrics.widthPixels, metrics.heightPixels)
        height = CaptureGeometry.landscapeHeight(metrics.widthPixels, metrics.heightPixels)
        dpi = metrics.densityDpi

        val r = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        reader = r
        display = proj.createVirtualDisplay(
            "overlay-capture",
            width,
            height,
            metrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            r.surface,
            null,
            null,
        )

        val repo = OverlayRepository.fromAssets(applicationContext)
        com.pokemmo.tool.overlay.OverlaySettings.ensureInit(this)
        overlay = OverlayWindows(this, repo)
        val engine = OcrEngine().also { ocr = it }
        OverlayStateBus.setCapturing(true)
        loop = scope.launch { runLoop(repo, engine) }
        scope.launch { refreshTags(repo) }
    }

    /**
     * One remote tags check per service start, off the main thread. Capture already runs on the
     * bundled tags; only the overlay reads tags (matcher and parser use areas/pokemon), so the
     * updated repo is swapped into the overlay on Main. Never throws.
     */
    private suspend fun refreshTags(repo: OverlayRepository) {
        try {
            val bundled = applicationContext.assets.open("overlay/tags.json")
                .bufferedReader(Charsets.UTF_8).use { it.readText() }
            val updater = TagUpdater(
                OkHttpClient(),
                TagUpdater.DEFAULT_URL,
                File(applicationContext.cacheDir, "tags-remote.json"),
                bundled,
            )
            val json = updater.current()
            if (json == bundled) return
            val updated = repo.withTags(json)
            withContext(Dispatchers.Main) { if (!stopping) overlay?.updateRepo(updated) }
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w(TAG, "tag update skipped", e)
        }
    }

    private suspend fun runLoop(repo: OverlayRepository, engine: OcrEngine) {
        val matcher = RouteMatcher(repo.areas)
        val parser = BattleParser(repo)
        val machine = ScreenStateMachine()
        while (currentCoroutineContext().isActive) {
            val started = System.currentTimeMillis()
            try {
                tick(engine, matcher, parser, machine)
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "tick failed", e)
            }
            delay((TICK_MS - (System.currentTimeMillis() - started)).coerceAtLeast(50))
        }
    }

    /**
     * Follows a screen resolution change (not rotation: the capture stays landscape-sized):
     * resize the display and swap in a reader of the new size.
     */
    private fun syncSize(): Boolean {
        val m = realMetrics()
        val w = CaptureGeometry.landscapeWidth(m.widthPixels, m.heightPixels)
        val h = CaptureGeometry.landscapeHeight(m.widthPixels, m.heightPixels)
        if (!CaptureGeometry.needsResize(width, height, w, h)) return false
        val vd = display ?: return false
        val old = reader
        val fresh = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
        vd.resize(w, h, m.densityDpi)
        vd.surface = fresh.surface
        reader = fresh
        old?.close()
        width = w
        height = h
        dpi = m.densityDpi
        return true
    }

    private suspend fun tick(
        engine: OcrEngine,
        matcher: RouteMatcher,
        parser: BattleParser,
        machine: ScreenStateMachine,
    ) {
        if (syncSize()) {
            skipNextTick = true
            lastReading = null
            return
        }
        if (skipNextTick) {
            skipNextTick = false
            return
        }
        val r = reader ?: return
        val tickStart = System.currentTimeMillis()
        // Regions are fractions of the landscape screen; portrait frames are meaningless (the
        // capture is landscape-sized, so ask the real display which way it is turned).
        val m = realMetrics()
        if (!CaptureGeometry.isLandscape(m.widthPixels, m.heightPixels)) {
            // Drain the queue so the first landscape frame is fresh, and forget the last read.
            r.acquireLatestImage()?.close()
            lastReading = null
            return
        }
        // The mirror only delivers a frame when the screen changes, and PokeMMO does not redraw
        // while the player stands still. No new frame means the screen still shows what we last
        // read, so feed that again: the state machine needs repeated ticks to confirm a route.
        val reading = r.acquireLatestImage()?.use { toBitmap(it) }
            ?.let { frame -> try { read(frame, engine, matcher, parser) } finally { frame.recycle() } }
            ?: lastReading
            ?: return
        lastReading = reading

        currentCoroutineContext().ensureActive()
        val state = machine.onTick(reading.route, reading.groups, reading.routeExact)
        debugLog { "tick total=${System.currentTimeMillis() - tickStart}ms state=${state::class.simpleName}" }
        when (state) {
            is ScreenState.Overworld -> currentRegion = state.area.region
            is ScreenState.Battle -> state.area?.let { currentRegion = it.region }
            ScreenState.Idle -> Unit
        }
        // The clock line is hidden in battle; keep the last season read until another is.
        reading.season?.let { currentSeason = it }
        OverlayStateBus.setBattleSuspected(reading.groups.isNotEmpty())
        OverlayStateBus.publish(state.forSeason(currentSeason))
    }

    /** What one frame showed. */
    private class Reading(
        val route: Area?,
        val routeExact: Boolean,
        val season: Season?,
        val groups: List<OpponentGroup>,
    )

    /** Only touched by the tick loop. */
    private var lastReading: Reading? = null

    private suspend fun read(
        frame: Bitmap,
        engine: OcrEngine,
        matcher: RouteMatcher,
        parser: BattleParser,
    ): Reading {
        val routeRect = ScreenRegions.ROUTE.toPixels(width, height)
        val battleRect = ScreenRegions.BATTLE.toPixels(width, height)
        val routeBmp = crop(frame, routeRect)
        val battleBmp = crop(frame, battleRect)
        try {
            val t0 = System.nanoTime()
            val routeLines = engine.read(routeBmp, routeRect.left, routeRect.top)
            val battleLines = engine.read(battleBmp, battleRect.left, battleRect.top)
            val t1 = System.nanoTime()

            // The clock line names the season; it is never a place name.
            val season = routeLines.firstNotNullOfOrNull { Season.find(it.text) }
            val nameLines = routeLines.filter { Season.find(it.text) == null }
            val routeHit = nameLines.firstNotNullOfOrNull { line ->
                matcher.match(line.text, currentRegion)?.let { it to matcher.isExact(line.text, it) }
            }
            val route = routeHit?.first
            debugLog {
                "frame ocr=${(t1 - t0) / 1_000_000}ms " +
                    "route=${routeLines.map { it.text }} " +
                    "match=${route?.let { "${it.region}/${it.name}" }} exact=${routeHit?.second} season=$season battle=${battleLines.map { it.text }}"
            }
            val opponents = parser.parse(battleLines)
            val groups = if (opponents.isEmpty()) {
                emptyList()
            } else {
                // Caught detection reads pixels of the battle crop only (cheaper than the
                // full frame); line boxes are shifted into crop coordinates.
                val pixels = IntArray(battleBmp.width * battleBmp.height)
                battleBmp.getPixels(pixels, 0, battleBmp.width, 0, 0, battleBmp.width, battleBmp.height)
                val inCrop = { o: com.pokemmo.tool.overlay.battle.Opponent -> o.box.shifted(-battleRect.left, -battleRect.top) }
                parser.group(
                    opponents,
                    hp = { o -> HpBar.read(pixels, battleBmp.width, battleBmp.height, inCrop(o), width) },
                ) { o ->
                    CaughtDetector.isCaught(
                        pixels, battleBmp.width, battleBmp.height,
                        inCrop(o),
                    )
                }
            }
            return Reading(route, routeHit?.second == true, season, groups)
        } finally {
            routeBmp.recycle()
            battleBmp.recycle()
        }
    }

    // --- Debug builds only: tick log. ---

    private val debuggable by lazy {
        (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
    }

    private inline fun debugLog(msg: () -> String) {
        if (debuggable) Log.d(TAG, msg())
    }

    private fun OcrLine.shifted(dx: Int, dy: Int) = OcrLine(text, left + dx, top + dy, right + dx, bottom + dy)

    private fun crop(src: Bitmap, r: IntRect): Bitmap {
        val x = r.left.coerceIn(0, src.width - 1)
        val y = r.top.coerceIn(0, src.height - 1)
        val w = r.width.coerceAtMost(src.width - x).coerceAtLeast(1)
        val h = r.height.coerceAtMost(src.height - y).coerceAtLeast(1)
        return Bitmap.createBitmap(src, x, y, w, h)
    }

    /** ImageReader rows are padded; copy into a padded bitmap and trim to the real width. */
    private fun toBitmap(image: Image): Bitmap {
        val plane = image.planes[0]
        val rowPixels = plane.rowStride / plane.pixelStride
        val padded = Bitmap.createBitmap(rowPixels, image.height, Bitmap.Config.ARGB_8888)
        padded.copyPixelsFromBuffer(plane.buffer)
        if (rowPixels == image.width) return padded
        val trimmed = Bitmap.createBitmap(padded, 0, 0, image.width, image.height)
        padded.recycle()
        return trimmed
    }

    @Suppress("DEPRECATION")
    private fun realMetrics(): DisplayMetrics {
        // The default display reports the current rotation, unlike a non-visual context's
        // window metrics.
        val dm = getSystemService(DisplayManager::class.java)
        val m = DisplayMetrics()
        dm.getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(m)
        return m
    }

    private fun buildNotification(): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Overlay", NotificationManager.IMPORTANCE_LOW),
        )
        val stop = PendingIntent.getService(
            this, 0,
            Intent(this, CaptureService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("3s PokeMMO Overlay")
            .setContentText("Reading the screen")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null, "Stop", stop).build())
            .build()
    }

    private fun shutdown() {
        if (stopping) return
        stopping = true
        val job = loop
        cleanupScope.launch {
            // OcrEngine.read is not cancellable, so joining also waits out any in-flight
            // ML Kit call; only then is it safe to release what the tick uses.
            job?.cancelAndJoin()
            try {
                display?.release(); display = null
                reader?.close(); reader = null
                projection?.stop(); projection = null
                ocr?.close(); ocr = null
            } catch (e: Exception) {
                Log.w(TAG, "release failed", e)
            }
            withContext(Dispatchers.Main) {
                overlay?.dispose(); overlay = null
                OverlayStateBus.setCapturing(false) // publishes Idle, after the loop is gone
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
    }

    override fun onDestroy() {
        shutdown()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val TICK_MS = 700L
        private const val TAG = "CaptureService"
        private const val CHANNEL_ID = "overlay"
        private const val NOTIFICATION_ID = 1
        private const val ACTION_STOP = "com.pokemmo.tool.overlay.STOP"
        private const val EXTRA_RESULT_CODE = "resultCode"
        private const val EXTRA_CONSENT = "consent"

        /** Start with the result of the MediaProjection consent screen. */
        fun start(context: Context, resultCode: Int, consent: Intent) {
            val i = Intent(context, CaptureService::class.java)
                .putExtra(EXTRA_RESULT_CODE, resultCode)
                .putExtra(EXTRA_CONSENT, consent)
            context.startForegroundService(i)
        }

        fun stop(context: Context) {
            context.startService(Intent(context, CaptureService::class.java).setAction(ACTION_STOP))
        }
    }
}
