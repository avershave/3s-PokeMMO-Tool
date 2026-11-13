package com.pokemmo.tool.overlay

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.pokemmo.tool.overlay.capture.CaptureService
import com.pokemmo.tool.overlay.state.OverlayStateBus
import com.pokemmo.tool.overlay.ui.SetupChecklist
import com.pokemmo.tool.overlay.ui.SetupState

// Dark scheme tuned for rgba(18,20,28): bright filled/text buttons, muted but visible when disabled.
private val OverlayColors = darkColorScheme(
    primary = Color(0xFF7FB2FF),
    onPrimary = Color(0xFF0B1220),
    primaryContainer = Color(0xFF2E6FD8),
    onPrimaryContainer = Color.White,
    surface = Color(18, 20, 28),
    onSurface = Color(0xFFE8EAF0),
    onSurfaceVariant = Color(0xFFB8BDC9),
)

class MainActivity : ComponentActivity() {
    private var overlayGranted by mutableStateOf(false)
    private var notificationsGranted by mutableStateOf(false)

    private val notifLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { refresh() }

    private val projectionLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
            val data = r.data
            if (r.resultCode == RESULT_OK && data != null) {
                CaptureService.start(this, r.resultCode, data)
            }
        }

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        OverlaySettings.ensureInit(this)
        refresh()
        setContent {
            MaterialTheme(colorScheme = OverlayColors) { Screen() }
        }
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun refresh() {
        overlayGranted = Settings.canDrawOverlays(this)
        notificationsGranted = Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }

    @Composable
    private fun Screen() {
        val capturing by OverlayStateBus.capturing.collectAsState()
        val panelBackground by OverlaySettings.panelBackground.collectAsState()
        val s = SetupState(overlayGranted, notificationsGranted, capturing)
        val light = Color(0xFFE8EAF0)
        val buttonColors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFF7FB2FF),
            contentColor = Color(0xFF0B1220),
            disabledContainerColor = Color(0xFF2A2E3B),
            disabledContentColor = Color(0xFF8A90A0),
        )
        Column(
            Modifier
                .fillMaxSize()
                .background(Color(18, 20, 28))
                .safeDrawingPadding()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("PokeMMO Overlay", color = light, fontSize = 22.sp)
            SetupChecklist.items(s).forEach {
                Text((if (it.done) "✓ " else "• ") + it.label, color = light, fontSize = 16.sp)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = {
                    startActivity(
                        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                    )
                }, enabled = !s.overlayGranted) { Text("Grant overlay permission") }
                if (Build.VERSION.SDK_INT >= 33) {
                    TextButton(onClick = {
                        notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }, enabled = !s.notificationsGranted) { Text("Allow notifications") }
                }
            }
            if (Build.VERSION.SDK_INT >= 33 && !s.notificationsGranted) {
                Text(
                    "Without notifications you won't see the Stop button in the notification shade.",
                    color = Color(0xFFFFC27A), fontSize = 13.sp,
                )
            }
            Text(
                "When asked what to share, choose A single app → PokeMMO. " +
                    "Sharing only PokeMMO keeps the overlay out of what it reads.",
                color = light, fontSize = 14.sp,
            )
            Button(
                onClick = {
                    val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                    projectionLauncher.launch(mpm.createScreenCaptureIntent())
                },
                enabled = SetupChecklist.startEnabled(s),
                colors = buttonColors,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Start overlay") }
            Button(
                onClick = { CaptureService.stop(this@MainActivity) },
                enabled = SetupChecklist.stopEnabled(s),
                colors = buttonColors,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Stop overlay") }
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Background panel", color = light, fontSize = 16.sp)
                    Text(
                        "A dark see-through panel behind the overlay. Off: icons and text sit on the game with a soft shadow.",
                        color = Color(0xFFB8BDC9), fontSize = 13.sp,
                    )
                }
                Switch(
                    checked = panelBackground,
                    onCheckedChange = { OverlaySettings.setPanelBackground(it) },
                    colors = SwitchDefaults.colors(
                        checkedTrackColor = Color(0xFF7FB2FF),
                        checkedThumbColor = Color(0xFF0B1220),
                    ),
                )
            }
            Spacer(Modifier.height(8.dp))
            Text("Screen text is read on your phone only.", color = light, fontSize = 13.sp)
        }
    }
}
