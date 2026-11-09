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
import android.view.WindowManager
import com.pokemmo.tool.overlay.battle.BattleParser
import com.pokemmo.tool.overlay.battle.CaughtDetector
import com.pokemmo.tool.overlay.battle.OcrLine
import com.pokemmo.tool.overlay.data.OverlayRepository
import com.pokemmo.tool.overlay.match.RouteMatcher
import com.pokemmo.tool.overlay.state.OverlayStateBus
import com.pokemmo.tool.overlay.state.ScreenState
import com.pokemmo.tool.overlay.state.ScreenStateMachine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Foreground service: MediaProjection -> VirtualDisplay -> ImageReader, then every
 * [TICK_MS] OCR the route and battle regions and publish the resulting [ScreenState]
 * to [OverlayStateBus]. Frames and text stay in memory on the phone.
 */
class CaptureService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var loop: Job? = null

    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private var reader: ImageReader? = null
    private var ocr: OcrEngine? = null
    private var stopping = false

    private var width = 0
    private var height = 0

    /** Region of the last confirmed overworld area; passed to the matcher as a tie-break hint. */
    @Volatile private var currentRegion: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            shutdown()
            return START_NOT_STICKY
        }
        if (projection != null) return START_NOT_STICKY

        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
            ?: Activity.RESULT_CANCELED
        val consent: Intent? = if (Build.VERSION.SDK_INT >= 33) {
            intent?.getParcelableExtra(EXTRA_CONSENT, Intent::class.java)
        } else {
            @Suppress("DEPRECATION") intent?.getParcelableExtra(EXTRA_CONSENT)
        }
        if (resultCode != Activity.RESULT_OK || consent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        // Android 14+: the mediaProjection foreground service must be running before
        // getMediaProjection is called.
        startForeground(
            NOTIFICATION_ID,
            buildNotification(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
        )

        try {
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

        val metrics = realMetrics()
        width = metrics.widthPixels
        height = metrics.heightPixels
        if (height > width) Log.w(TAG, "portrait display ${width}x$height; regions assume landscape")

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
        val engine = OcrEngine().also { ocr = it }
        OverlayStateBus.setCapturing(true)
        loop = scope.launch { runLoop(repo, engine, r) }
    }

    private suspend fun runLoop(repo: OverlayRepository, engine: OcrEngine, r: ImageReader) {
        val matcher = RouteMatcher(repo.areas)
        val parser = BattleParser(repo)
        val machine = ScreenStateMachine()
        while (scope.isActive) {
            val started = System.currentTimeMillis()
            try {
                tick(r, engine, matcher, parser, machine)
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "tick failed", e)
            }
            delay((TICK_MS - (System.currentTimeMillis() - started)).coerceAtLeast(50))
        }
    }

    private suspend fun tick(
        r: ImageReader,
        engine: OcrEngine,
        matcher: RouteMatcher,
        parser: BattleParser,
        machine: ScreenStateMachine,
    ) {
        val frame = r.acquireLatestImage()?.use { toBitmap(it) } ?: return
        try {
            val routeRect = ScreenRegions.ROUTE.toPixels(width, height)
            val battleRect = ScreenRegions.BATTLE.toPixels(width, height)
            val routeBmp = crop(frame, routeRect)
            val battleBmp = crop(frame, battleRect)
            try {
                val routeLines = engine.read(routeBmp, routeRect.left, routeRect.top)
                val battleLines = engine.read(battleBmp, battleRect.left, battleRect.top)

                val route = routeLines.firstNotNullOfOrNull { matcher.match(it.text, currentRegion) }
                val opponents = parser.parse(battleLines)
                val groups = if (opponents.isEmpty()) {
                    emptyList()
                } else {
                    // Caught detection reads pixels of the battle crop only (cheaper than the
                    // full frame); line boxes are shifted into crop coordinates.
                    val pixels = IntArray(battleBmp.width * battleBmp.height)
                    battleBmp.getPixels(pixels, 0, battleBmp.width, 0, 0, battleBmp.width, battleBmp.height)
                    parser.group(opponents) { o ->
                        CaughtDetector.isCaught(
                            pixels, battleBmp.width, battleBmp.height,
                            o.box.shifted(-battleRect.left, -battleRect.top),
                        )
                    }
                }

                val state = machine.onTick(route, groups)
                when (state) {
                    is ScreenState.Overworld -> currentRegion = state.area.region
                    is ScreenState.Battle -> state.area?.let { currentRegion = it.region }
                    ScreenState.Idle -> Unit
                }
                OverlayStateBus.publish(state)
            } finally {
                routeBmp.recycle()
                battleBmp.recycle()
            }
        } finally {
            frame.recycle()
        }
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
        val wm = getSystemService(WindowManager::class.java)
        val m = DisplayMetrics()
        if (Build.VERSION.SDK_INT >= 30) {
            val b = wm.maximumWindowMetrics.bounds
            m.widthPixels = b.width()
            m.heightPixels = b.height()
            m.densityDpi = resources.displayMetrics.densityDpi
        } else {
            wm.defaultDisplay.getRealMetrics(m)
        }
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
        loop?.cancel()
        display?.release(); display = null
        reader?.close(); reader = null
        projection?.stop(); projection = null
        ocr?.close(); ocr = null
        OverlayStateBus.setCapturing(false)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
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
