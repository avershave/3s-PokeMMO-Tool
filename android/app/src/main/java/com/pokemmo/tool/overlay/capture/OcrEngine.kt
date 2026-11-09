package com.pokemmo.tool.overlay.capture

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.pokemmo.tool.overlay.battle.OcrLine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

/** On-device ML Kit (bundled Latin model) text recognition. Nothing leaves the phone. */
class OcrEngine {
    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    /**
     * Reads [bitmap] and returns one [OcrLine] per recognized line. [offsetX]/[offsetY] are the
     * bitmap's origin in the full screen, so the returned boxes are in full-screen pixels.
     */
    suspend fun read(bitmap: Bitmap, offsetX: Int = 0, offsetY: Int = 0): List<OcrLine> =
        suspendCancellableCoroutine { cont ->
            recognizer.process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener { text ->
                    val lines = text.textBlocks.flatMap { it.lines }.mapNotNull { line ->
                        val box = line.boundingBox ?: return@mapNotNull null
                        OcrLine(
                            line.text,
                            box.left + offsetX,
                            box.top + offsetY,
                            box.right + offsetX,
                            box.bottom + offsetY,
                        )
                    }
                    cont.resume(lines)
                }
                .addOnFailureListener { cont.resumeWithException(it) }
        }

    fun close() = recognizer.close()
}
