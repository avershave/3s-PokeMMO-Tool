package com.pokemmo.tool.overlay.data

import java.io.File
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class TagUpdaterTest {
    @get:Rule val tmp = TemporaryFolder()
    private lateinit var server: MockWebServer
    private lateinit var cache: File

    private fun tags(at: String, schema: Int = 1) =
        """{"schemaVersion":$schema,"generatedAt":"$at","explanations":{},"pokemon":{},"tips":{}}"""

    private val bundled = tags("2026-01-01T00:00:00Z")

    @Before fun setUp() {
        server = MockWebServer().also { it.start() }
        cache = File(tmp.root, "tags-cache.json")
    }

    @After fun tearDown() = server.shutdown()

    private fun updater(url: String = server.url("/tags.json").toString()) =
        TagUpdater(OkHttpClient(), url, cache, bundled)

    @Test fun `newer remote wins and is cached`() = runBlocking {
        val remote = tags("2026-06-01T00:00:00Z")
        server.enqueue(MockResponse().setBody(remote))
        assertEquals(remote, updater().current())
        assertEquals(remote, cache.readText())
    }

    @Test fun `older remote ignored`() = runBlocking {
        server.enqueue(MockResponse().setBody(tags("2025-01-01T00:00:00Z")))
        assertEquals(bundled, updater().current())
        assertFalse(cache.exists())
    }

    @Test fun `malformed JSON falls back`() = runBlocking {
        server.enqueue(MockResponse().setBody("{not json"))
        assertEquals(bundled, updater().current())
        assertFalse(cache.exists())
    }

    @Test fun `schemaVersion 2 falls back`() = runBlocking {
        server.enqueue(MockResponse().setBody(tags("2027-01-01T00:00:00Z", schema = 2)))
        assertEquals(bundled, updater().current())
        assertFalse(cache.exists())
    }

    @Test fun `HTTP 500 falls back`() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(500).setBody(tags("2027-01-01T00:00:00Z")))
        assertEquals(bundled, updater().current())
    }

    @Test fun `missing generatedAt remote is invalid`() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"schemaVersion":1}"""))
        assertEquals(bundled, updater().current())
    }

    @Test fun `offline uses cache over bundled when cache is newer`() = runBlocking {
        val cached = tags("2026-03-01T00:00:00Z")
        cache.writeText(cached)
        val url = server.url("/tags.json").toString()
        server.shutdown() // connection refused
        assertEquals(cached, TagUpdater(OkHttpClient(), url, cache, bundled).current())
    }

    @Test fun `offline ignores corrupt or older cache`() = runBlocking {
        cache.writeText("garbage")
        val url = server.url("/tags.json").toString()
        server.shutdown()
        assertEquals(bundled, TagUpdater(OkHttpClient(), url, cache, bundled).current())
        cache.writeText(tags("2020-01-01T00:00:00Z"))
        assertEquals(bundled, TagUpdater(OkHttpClient(), url, cache, bundled).current())
    }

    @Test fun `instants are compared by value not string`() = runBlocking {
        // Lexically smaller string, but later instant (+00:00 offset form with fractional secs).
        val remote = tags("2026-01-01T00:00:00.500Z")
        server.enqueue(MockResponse().setBody(remote))
        assertEquals(remote, updater().current())
        assertTrue(cache.exists())
    }
}
