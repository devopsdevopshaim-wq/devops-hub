package il.spider.car

import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import okhttp3.OkHttpClient
import java.util.concurrent.Executors

/**
 * The media service Android Auto talks to. The car's list shows the radio styles (folders) and a news folder; the station
 * that plays carries the latest headline in its "artist" line, which changes every few seconds.
 */
class SpiderService : MediaLibraryService() {
    private var session: MediaLibrarySession? = null
    private lateinit var player: ExoPlayer
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var hl = 0

    private val rotate = object : Runnable {
        override fun run() {
            val items = Catalog.headlines
            val cur = player.currentMediaItem
            if (items.isNotEmpty() && cur != null && cur.mediaId.startsWith("s:") && player.isPlaying) {
                hl = (hl + 1) % items.size
                val md = cur.mediaMetadata.buildUpon().setArtist(items[hl]).build()
                // only the metadata differs, so the sound is not interrupted
                player.replaceMediaItem(player.currentMediaItemIndex, cur.buildUpon().setMediaMetadata(md).build())
            }
            main.postDelayed(this, 12_000)
        }
    }

    override fun onCreate() {
        super.onCreate()
        val http = DefaultMediaSourceFactory(OkHttpDataSource.Factory(OkHttpClient()))
        player = ExoPlayer.Builder(this).setMediaSourceFactory(http)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
            .setHandleAudioBecomingNoisy(true).build()
        session = MediaLibrarySession.Builder(this, player, Callback()).build()
        io.execute { Catalog.load() }
        main.postDelayed(rotate, 12_000)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? = session

    override fun onTaskRemoved(rootIntent: android.content.Intent?) {
        if (!player.playWhenReady || player.mediaItemCount == 0) stopSelf()
    }

    override fun onDestroy() {
        main.removeCallbacks(rotate)
        session?.run { player.release(); release() }
        session = null
        io.shutdown()
        super.onDestroy()
    }

    private inner class Callback : MediaLibrarySession.Callback {
        override fun onGetLibraryRoot(session: MediaLibrarySession, browser: MediaSession.ControllerInfo, params: LibraryParams?): ListenableFuture<LibraryResult<MediaItem>> =
            Futures.immediateFuture(LibraryResult.ofItem(Catalog.folder(Catalog.ROOT, "SPIDER"), params))

        override fun onGetItem(session: MediaLibrarySession, browser: MediaSession.ControllerInfo, mediaId: String): ListenableFuture<LibraryResult<MediaItem>> {
            val item = Catalog.find(mediaId) ?: return Futures.immediateFuture(LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE))
            return Futures.immediateFuture(LibraryResult.ofItem(item, null))
        }

        override fun onGetChildren(session: MediaLibrarySession, browser: MediaSession.ControllerInfo, parentId: String, page: Int, pageSize: Int, params: LibraryParams?): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> =
            Futures.submit<LibraryResult<ImmutableList<MediaItem>>>({
                Catalog.load()
                val out = ImmutableList.builder<MediaItem>()
                when {
                    parentId == Catalog.ROOT -> {
                        out.add(Catalog.folder(Catalog.NEWS, "חדשות", Catalog.headlines.firstOrNull()))
                        Catalog.genres.forEach { out.add(Catalog.folder(it.id, it.style, "${it.stations.size} תחנות")) }
                    }
                    parentId == Catalog.NEWS -> Catalog.headlines.forEachIndexed { i, t -> out.add(Catalog.headline(i, t)) }
                    else -> Catalog.genres.firstOrNull { it.id == parentId }?.let { g -> g.stations.forEach { out.add(Catalog.station(it, g.style)) } }
                }
                LibraryResult.ofItemList(out.build(), params)
            }, io)

        // the controller (the car) sends only ids: the addresses are put back here
        override fun onAddMediaItems(mediaSession: MediaSession, controller: MediaSession.ControllerInfo, mediaItems: MutableList<MediaItem>): ListenableFuture<MutableList<MediaItem>> =
            Futures.immediateFuture(mediaItems.map { Catalog.find(it.mediaId) ?: it }.toMutableList())
    }
}
