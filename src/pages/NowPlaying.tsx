import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownCircle, CheckCircle2, ChevronDown, MonitorPlay, MonitorSpeaker, PlusCircle, Heart, Loader2, ListMusic, MessageSquareQuote, Mic2, MoreHorizontal, Pause, Play, Plus, Repeat, Repeat1, Share2, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AddToPlaylistDialog } from "@/components/AddToPlaylistDialog";
import { ShareSheet } from "@/components/ShareSheet";
import { getCachedYouTubeId, getGlobalVolume, seekGlobalAudio, setGlobalVolume } from "@/components/player/GlobalAudioPlayer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/context/PlayerContext";
import { cn } from "@/lib/utils";
import { SyncedVideoPanel } from "@/components/nowplaying/SyncedVideoPanel";
import { VideoCanvas } from "@/components/nowplaying/VideoCanvas";
import { LyricsStream, parseSyncedLyrics } from "@/components/nowplaying/LyricsStream";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lookupMeta, peekMeta, type DeezerMeta } from "@/services/metadataEnrichment";

import { toTitleCase } from "@/utils/toTitleCase";
import { getDominantColor, gradientFromRGB } from "@/utils/dominantColor";

/** Progress ring geometry (viewBox is 100x100). */
const RING_R = 47;
const RING_C = 2 * Math.PI * RING_R;

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}


export default function NowPlaying() {
  const navigate = useNavigate();
  const { currentTrack, duration, isPlaying, next, nextTrack, previous, progress, queue, repeat, seek, shuffle, togglePlay, toggleRepeat, toggleShuffle } = usePlayer();
  const [liked, setLiked] = useState(false);
  const [localProgress, setLocalProgress] = useState(progress);
  const [showMore, setShowMore] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading" | "done" | "failed">("idle");
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const [volume, setVolume] = useState(() => getGlobalVolume());
  /** Deezer metadata for the current song (title / artist / album / hi-res art). */
  const [meta, setMeta] = useState<DeezerMeta | null>(null);

  useEffect(() => setLocalProgress(progress), [progress]);
  // Re-apply the saved volume whenever the playback backend swaps tracks.
  useEffect(() => { setGlobalVolume(volume); }, [currentTrack?.id, volume]);
  // Snap the ring back to zero the instant the user skips forward/back.
  useEffect(() => setLocalProgress(0), [currentTrack?.id]);

  // Now Playing shows Deezer metadata when it resolves; YouTube data is the fallback.
  useEffect(() => {
    if (!currentTrack) { setMeta(null); return; }
    let alive = true;
    setMeta(peekMeta(currentTrack.title, currentTrack.artist) ?? null);
    lookupMeta(currentTrack.title, currentTrack.artist)
      .then((m) => { if (alive) setMeta(m); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [currentTrack?.title, currentTrack?.artist]);

  const display = useMemo(() => ({
    title: meta?.title || currentTrack?.title || "",
    artist: meta?.artist || currentTrack?.artist || "",
    album: meta?.album || currentTrack?.album || "",
    artwork: meta?.artwork || currentTrack?.artwork || "",
  }), [meta, currentTrack]);

  // Plain colour backdrop derived from the cover — no artwork image behind the page.
  const [bgColor, setBgColor] = useState("linear-gradient(180deg, #2a2030 0%, #14121a 45%, #0a0a0a 100%)");
  useEffect(() => {
    let alive = true;
    const art = display.artwork;
    if (!art) return;
    getDominantColor(art).then((c) => { if (alive) setBgColor(gradientFromRGB(c)); }).catch(() => undefined);
    return () => { alive = false; };
  }, [display.artwork]);



  useEffect(() => {
    const compute = () => {
      if (!currentTrack) {
        setLiked(false);
        return;
      }
      try {
        const likedSongs = JSON.parse(localStorage.getItem("tunestream_liked_songs") || "[]");
        setLiked(likedSongs.some((song: any) => song.title === currentTrack.title && song.artist === currentTrack.artist));
      } catch {
        setLiked(false);
      }
    };
    compute();
    window.addEventListener("liked-updated", compute);
    return () => window.removeEventListener("liked-updated", compute);
  }, [currentTrack?.artist, currentTrack?.title]);

  const isResolving = useMemo(() => !!currentTrack && !currentTrack.youtubeId && !getCachedYouTubeId(currentTrack.title, currentTrack.artist), [currentTrack]);
  const videoId = useMemo(
    () => currentTrack?.youtubeId || getCachedYouTubeId(currentTrack?.title || "", currentTrack?.artist || "") || "",
    [currentTrack],
  );
  const actualDuration = duration || currentTrack?.duration || 0;
  const currentTime = Math.floor(localProgress * actualDuration);

  const handleSeek = useCallback((newProgress: number) => {
    seek(newProgress);
    setLocalProgress(newProgress);
    if (actualDuration > 0) seekGlobalAudio(newProgress * actualDuration);
  }, [actualDuration, seek]);

  const handleToggleLike = useCallback(() => {
    if (!currentTrack) return;
    import("@/pages/Library").then(({ toggleLikedSong }) => setLiked(toggleLikedSong(currentTrack)));
  }, [currentTrack]);

  const handleDownload = useCallback(async () => {
    if (!currentTrack || downloadStatus === "downloading") return;
    setDownloadStatus("downloading");
    setDownloadPercent(0);
    const mod = await import("@/services/downloadService");
    const ok = await mod.downloadTrack(currentTrack, (p) => setDownloadPercent(p));
    setDownloadStatus(ok ? "done" : "failed");
    if (ok) toast.success("Downloaded to offline library");
    else toast.error(mod.lastDownloadError || "Download failed");
  }, [currentTrack, downloadStatus]);

  if (!currentTrack) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <p className="text-lg font-extrabold text-foreground">No track playing</p>
          <Button onClick={() => navigate("/")} className="mt-4 rounded-full">Go Home</Button>
        </div>
      </main>
    );
  }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-20 flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-background text-foreground">
      <AnimatePresence mode="wait">
        <motion.div
          key={bgColor}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="pointer-events-none absolute inset-0"
          style={{ background: bgColor }}
        />
      </AnimatePresence>
      <VideoCanvas trackId={currentTrack.id} artwork={display.artwork} videoId={videoId} artist={currentTrack.artist} title={currentTrack.title} onActiveChange={setVideoActive} />

      {/* Desktop: bent artwork left, rolling lyrics right */}
      <div className="relative z-10 hidden min-h-0 flex-1 grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-12 px-14 pb-28 pt-10 lg:grid">
        <div className="flex min-h-0 flex-col justify-center [perspective:1200px]">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back" className="mb-6 rounded-full text-foreground/70 hover:bg-foreground/10">
            <ChevronDown className="h-5 w-5" />
          </Button>
          <div className={`relative flex w-full max-w-[min(34vw,58vh)] flex-col items-center transition-opacity duration-700 ${videoActive ? "pointer-events-none opacity-0" : "opacity-100"}`}>
            <div className="pointer-events-none absolute -inset-16 rounded-full bg-primary/20 blur-[90px]" />
            <motion.div
              key={currentTrack.id}
              initial={{ opacity: 0, y: 30, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 110, damping: 18 }}
              className="rn-suspend relative z-10 aspect-square w-full overflow-hidden rounded-xl shadow-[0_0_60px_-10px_hsl(var(--foreground)/0.35),0_60px_80px_-40px_hsl(0_0%_0%/0.9)]"
            >
              <img src={display.artwork} alt={display.title} className="h-full w-full object-cover" />
            </motion.div>
            {/* light beam holding the cover in the air */}
            <div className="pointer-events-none mt-2 h-24 w-1/2 bg-gradient-to-b from-foreground/25 to-transparent blur-md [clip-path:polygon(20%_0,80%_0,55%_100%,45%_100%)]" />
          </div>
          <h1 className="mt-8 truncate text-3xl font-bold text-foreground">{toTitleCase(display.title)}</h1>
          <button onClick={() => navigate(`/artist/${encodeURIComponent(display.artist)}`)} className="truncate text-left text-lg text-foreground/60 hover:text-foreground">
            {toTitleCase(display.artist)}
          </button>
        </div>
        <LyricsStream
          title={currentTrack.title}
          artist={currentTrack.artist}
          currentTime={currentTime}
          onSeek={(t) => actualDuration > 0 && handleSeek(t / actualDuration)}
        />
      </div>

      {/* Phone: Spotify-style — video fills the screen, controls sit at the bottom */}
      <header className="relative z-10 flex shrink-0 items-center justify-between px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] lg:hidden">
        <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-10 w-10 items-center justify-center text-foreground">
          <ChevronDown className="h-6 w-6" />
        </button>
        <span className="truncate px-2 text-[13px] font-bold text-foreground">{toTitleCase(display.artist)}</span>
        <button onClick={() => setShowMore(true)} aria-label="More" className="flex h-10 w-10 items-center justify-center text-foreground">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-6 lg:hidden">
        {!videoActive && (
          <div className="flex flex-1 items-center justify-center py-6">
            <motion.div
              key={currentTrack.id}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="aspect-square w-full max-w-[min(80vw,42dvh)] overflow-hidden rounded-md shadow-[0_18px_50px_-12px_hsl(0_0%_0%/0.7)]"
            >
              {isResolving ? (
                <div className="flex h-full w-full items-center justify-center bg-secondary"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
              ) : (
                <img src={display.artwork} alt={display.title} className="h-full w-full object-cover" />
              )}
            </motion.div>
          </div>
        )}
        {videoActive && <div className="flex-1" />}

        <PhoneLyricLine title={currentTrack.title} artist={currentTrack.artist} currentTime={currentTime} onOpen={() => navigate("/lyrics")} />
        {videoId && (
          <button onClick={() => setShowVideo(true)} className="mb-4 flex w-fit items-center gap-1.5 rounded-md bg-background/50 px-2.5 py-1.5 text-[12px] font-bold text-foreground backdrop-blur-sm">
            <MonitorPlay className="h-3.5 w-3.5" /> Switch to video
          </button>
        )}

        <div className="flex items-center gap-3">
          <img src={display.artwork} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[20px] font-bold leading-tight text-foreground">{toTitleCase(display.title)}</h1>
            <button onClick={() => navigate(`/artist/${encodeURIComponent(display.artist)}`)} className="block max-w-full truncate text-[15px] text-foreground/70">
              {toTitleCase(display.artist)}
            </button>
          </div>
          <button onClick={handleToggleLike} aria-label="Like" className={cn("flex h-10 w-10 items-center justify-center text-foreground", liked && "text-primary")}>
            {liked ? <CheckCircle2 className="h-7 w-7" fill="currentColor" stroke="hsl(var(--background))" /> : <PlusCircle className="h-7 w-7" />}
          </button>
        </div>

        <div className="mt-4">
          <Slider
            value={[localProgress * 100]}
            max={100}
            step={0.05}
            aria-label="Seek"
            onValueChange={([value]) => handleSeek(value / 100)}
            className="py-1 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-foreground [&>span]:h-[3px]"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-foreground/60">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(Math.max(0, actualDuration - currentTime))}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button onClick={toggleShuffle} aria-pressed={shuffle} aria-label="Shuffle" className={cn("text-foreground", shuffle && "text-primary")}>
            <Shuffle className="h-6 w-6" />
          </button>
          <button onClick={previous} aria-label="Previous track" className="text-foreground active:scale-95">
            <SkipBack className="h-8 w-8" fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            disabled={isResolving}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-background active:scale-95 disabled:opacity-60"
          >
            {isResolving ? <Loader2 className="h-7 w-7 animate-spin" /> : isPlaying ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="ml-1 h-7 w-7" fill="currentColor" />}
          </button>
          <button onClick={next} aria-label="Next track" className="text-foreground active:scale-95">
            <SkipForward className="h-8 w-8" fill="currentColor" />
          </button>
          <button onClick={toggleRepeat} aria-label={`Repeat: ${repeat}`} className={cn("text-foreground", repeat !== "off" && "text-primary")}>
            {repeat === "one" ? <Repeat1 className="h-6 w-6" /> : <Repeat className="h-6 w-6" />}
          </button>
        </div>

        {showVolume && (
          <div className="mt-4 flex items-center gap-3">
            <Volume2 className="h-4 w-4 shrink-0 text-foreground/60" />
            <Slider value={[volume * 100]} max={100} step={1} aria-label="Volume" onValueChange={([value]) => { setVolume(value / 100); setGlobalVolume(value / 100); }} className="flex-1 [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5 [&_[role=slider]]:border-0 [&>span]:h-[3px]" />
          </div>
        )}
      </div>

      <section className="relative z-10 flex shrink-0 items-center justify-between px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 lg:hidden">
        <button onClick={() => setShowVolume((v) => !v)} aria-label="Device and volume" className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
          <MonitorSpeaker className="h-4 w-4" /> This device
        </button>
        <div className="flex items-center gap-6">
          <button onClick={() => setShowShareSheet(true)} aria-label="Share" className="text-foreground"><Share2 className="h-5 w-5" /></button>
          <button onClick={() => navigate("/queue")} aria-label="Queue" className="text-foreground"><ListMusic className="h-5 w-5" /></button>
        </div>
      </section>

      <AnimatePresence>
        {showMore && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" onClick={() => setShowMore(false)} />
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-card p-4 shadow-elevated">
              <div className="mb-4 flex items-center gap-3">
                <img src={currentTrack.artwork} alt={currentTrack.title} className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-foreground">{toTitleCase(currentTrack.title)}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">{toTitleCase(currentTrack.artist)}</p>
                </div>
              </div>
              <div className="grid gap-2">
                {[
                  { icon: Plus, label: "Add to Playlist", action: () => setShowPlaylistDialog(true) },
                  { icon: ListMusic, label: "Open Queue", action: () => navigate("/queue") },
                  { icon: ArrowDownCircle, label: downloadStatus === "done" ? "Downloaded" : "Download", action: handleDownload },
                  { icon: Share2, label: "Share", action: () => setShowShareSheet(true) },
                ].map(({ icon: Icon, label, action }) => (
                  <Button key={label} variant="ghost" onClick={() => { action(); setShowMore(false); }} className="justify-start rounded-xl px-3 text-sm font-bold">
                    <Icon className="h-4 w-4 text-primary" />{label}
                  </Button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVideo && videoId && (
          <SyncedVideoPanel
            videoId={videoId}
            title={display.title}
            startSeconds={currentTime}
            onClose={() => setShowVideo(false)}
          />
        )}
      </AnimatePresence>

      <ShareSheet isOpen={showShareSheet} onClose={() => setShowShareSheet(false)} item={{ type: "track", title: currentTrack.title, subtitle: currentTrack.artist, image: currentTrack.artwork, id: currentTrack.id }} />
      <AddToPlaylistDialog isOpen={showPlaylistDialog} onClose={() => setShowPlaylistDialog(false)} track={{ title: currentTrack.title, artist: currentTrack.artist, album: currentTrack.album, artwork: currentTrack.artwork, duration: currentTrack.duration }} />
    </motion.main>
  );
}


/** One synced lyric line shown above the song title on phones. */
function PhoneLyricLine({ title, artist, currentTime, onOpen }: { title: string; artist: string; currentTime: number; onOpen: () => void }) {
  const { data } = useQuery({
    queryKey: ["lyrics", title, artist],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("lyrics", { body: { title, artist } });
      if (error) throw error;
      return data as { lyrics: string | null; syncedLyrics?: string | null };
    },
    enabled: !!title && !!artist,
    staleTime: 30 * 60 * 1000,
  });
  const lines = useMemo(() => (data?.syncedLyrics ? parseSyncedLyrics(data.syncedLyrics) : []), [data?.syncedLyrics]);
  let text = "";
  for (const l of lines) { if (l.time <= currentTime) text = l.text; else break; }
  if (!text && lines.length) text = lines[0].text;
  if (!text) return null;
  return (
    <button onClick={onOpen} className="mb-2 text-left text-[19px] font-bold leading-snug text-foreground [text-shadow:0_2px_12px_hsl(0_0%_0%/0.6)]">
      <motion.span key={text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="line-clamp-2">{text}</motion.span>
    </button>
  );
}
