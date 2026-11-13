package com.pokemmo.tool.overlay.data

import java.io.File
import java.time.Instant
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Picks the newest valid tags.json among the bundled asset, the on-disk cache and the remote
 * copy. This is the app's only network call; nothing is uploaded, only the file is fetched.
 * Never throws: any failure yields the best local copy.
 */
class TagUpdater(
    client: OkHttpClient,
    private val url: String,
    private val cacheFile: File,
    private val bundledTagsJson: String,
) {
    private val client = client.newBuilder()
        .connectTimeout(TIMEOUT_S, TimeUnit.SECONDS)
        .readTimeout(TIMEOUT_S, TimeUnit.SECONDS)
        .callTimeout(TIMEOUT_S, TimeUnit.SECONDS)
        .build()

    suspend fun current(): String = withContext(Dispatchers.IO) {
        val local = bestLocal()
        val localAt = local.second
        try {
            val remote = fetch()
            val remoteAt = remote?.let { instantOf(it) }
            if (remote != null && remoteAt != null && (localAt == null || remoteAt.isAfter(localAt))) {
                try {
                    cacheFile.parentFile?.mkdirs()
                    cacheFile.writeText(remote)
                } catch (_: Exception) {
                    // Cache is best effort; still use the fresh copy this run.
                }
                return@withContext remote
            }
        } catch (_: Exception) {
            // Network or other failure: fall back to the local copy.
        }
        local.first
    }

    /** Newest valid of bundled/cache; the bundled copy if neither is valid. */
    private fun bestLocal(): Pair<String, Instant?> {
        val bundledAt = instantOf(bundledTagsJson)
        val cached = try {
            if (cacheFile.isFile) cacheFile.readText() else null
        } catch (_: Exception) {
            null
        }
        val cachedAt = cached?.let { instantOf(it) }
        return if (cached != null && cachedAt != null && (bundledAt == null || cachedAt.isAfter(bundledAt))) {
            cached to cachedAt
        } else {
            bundledTagsJson to bundledAt
        }
    }

    private fun fetch(): String? {
        val request = Request.Builder().url(url).build()
        client.newCall(request).execute().use { resp ->
            if (resp.code != 200) return null
            return resp.body?.string()
        }
    }

    /** generatedAt when [text] is a valid schema-1 TagsFile with a parseable timestamp, else null. */
    private fun instantOf(text: String): Instant? = try {
        val f = json.decodeFromString<TagsFile>(text)
        if (f.schemaVersion != 1) null else Instant.parse(f.generatedAt)
    } catch (_: Exception) {
        null
    }

    companion object {
        const val DEFAULT_URL =
            "https://raw.githubusercontent.com/avershave/3s-PokeMMO-Tool/main/public/data/overlay/tags.json"
        private const val TIMEOUT_S = 5L
        private val json = Json { ignoreUnknownKeys = true }
    }
}
