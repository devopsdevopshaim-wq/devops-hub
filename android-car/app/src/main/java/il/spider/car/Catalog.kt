package il.spider.car

import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** What the car shows: the radio styles of the site (radio.json), and the headlines (news.json). */
object Catalog {
    private const val SITE = "https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/"
    const val ROOT = "root"
    const val NEWS = "news"

    class Station(val id: String, val name: String, val url: String)
    class Genre(val id: String, val style: String, val stations: List<Station>)

    @Volatile var genres: List<Genre> = fallback()
    @Volatile var headlines: List<String> = emptyList()
    @Volatile private var loadedAt = 0L

    private fun fallback(): List<Genre> {
        fun soma(id: String, name: String) = Station("s:https://ice2.somafm.com/$id-128-mp3", "SomaFM · $name", "https://ice2.somafm.com/$id-128-mp3")
        return listOf(
            Genre("g:chill", "צ׳ילאאוט", listOf(soma("groovesalad", "Groove Salad"), soma("fluid", "Fluid"))),
            Genre("g:lounge", "לאונג׳", listOf(soma("illstreet", "Illinois Street Lounge"), soma("secretagent", "Secret Agent"))),
            Genre("g:jazz", "ג׳אז", listOf(soma("sonicuniverse", "Sonic Universe"))),
            Genre("g:80s", "שנות ה־80", listOf(soma("u80s", "Underground 80s")))
        )
    }

    private fun fetch(path: String): JSONObject? = try {
        val c = URL(SITE + path).openConnection() as HttpURLConnection
        c.connectTimeout = 10000; c.readTimeout = 15000
        c.setRequestProperty("Cache-Control", "no-cache")
        val text = c.inputStream.bufferedReader().use { it.readText() }
        JSONObject(text)
    } catch (e: Exception) { null }

    /** Blocking: call from a background thread. Refreshes at most every 20 minutes. */
    @Synchronized fun load() {
        if (System.currentTimeMillis() - loadedAt < 20 * 60 * 1000) return
        fetch("radio.json")?.optJSONArray("genres")?.let { arr ->
            val out = ArrayList<Genre>()
            for (i in 0 until arr.length()) {
                val g = arr.getJSONObject(i)
                val st = g.optJSONArray("stations") ?: continue
                val list = ArrayList<Station>()
                for (k in 0 until st.length()) {
                    val s = st.getJSONObject(k)
                    val url = s.optString("url")
                    if (url.startsWith("https://")) list.add(Station("s:$url", s.optString("name", g.optString("style")), url))
                }
                if (list.isNotEmpty()) out.add(Genre("g:" + g.optString("id", i.toString()), g.optString("style"), list))
            }
            if (out.isNotEmpty()) genres = out
        }
        fetch("news.json")?.optJSONObject("feeds")?.let { f ->
            val out = ArrayList<String>()
            for (key in listOf("main", "tech")) f.optJSONArray(key)?.let { a -> for (i in 0 until minOf(a.length(), 14)) a.getJSONObject(i).optString("title").takeIf { it.isNotBlank() }?.let(out::add) }
            if (out.isNotEmpty()) headlines = out
        }
        loadedAt = System.currentTimeMillis()
    }

    fun folder(id: String, title: String, subtitle: String? = null): MediaItem = MediaItem.Builder()
        .setMediaId(id)
        .setMediaMetadata(MediaMetadata.Builder().setTitle(title).setSubtitle(subtitle)
            .setIsBrowsable(true).setIsPlayable(false).setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED).build())
        .build()

    fun station(s: Station, style: String): MediaItem = MediaItem.Builder()
        .setMediaId(s.id).setUri(Uri.parse(s.url))
        .setMediaMetadata(MediaMetadata.Builder().setTitle(s.name).setArtist(style)
            .setIsBrowsable(false).setIsPlayable(true).setMediaType(MediaMetadata.MEDIA_TYPE_RADIO_STATION).build())
        .build()

    fun headline(i: Int, text: String): MediaItem = MediaItem.Builder()
        .setMediaId("h:$i")
        .setMediaMetadata(MediaMetadata.Builder().setTitle(text).setIsBrowsable(false).setIsPlayable(false).build())
        .build()

    fun find(mediaId: String): MediaItem? {
        for (g in genres) for (s in g.stations) if (s.id == mediaId) return station(s, g.style)
        return null
    }
}
