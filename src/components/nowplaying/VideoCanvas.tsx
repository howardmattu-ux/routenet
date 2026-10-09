/**
 * Background canvas: always a muted, looped YouTube video. Uses the song's own
 * video first; otherwise picks a random real music video from a pool built by
 * searching "<artist(s)> official music video" (no song title, so static
 * cover-art uploads are avoided). Purely decorative and never receives taps.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { searchYouTubeVideos } from "@/services/musicApi";

const poolCache = new Map<string, string[]>();
const STATIC_RE = /\b(official audio|audio only|visuali[sz]er|lyric|lyrics|topic|full album|slowed|reverb|sped up|8d|nightcore|instrumental|karaoke|stream)\b/i;

export function splitArtists(artist: string): string[] {
  return artist
    .split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bfeaturing\b|\bx\b|\bwith\b|\/)\s*/i)
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function idOf(v: any): string {
  return v?.videoId || v?.id?.videoId || (typeof v?.id === "string" ? v.id : "") || v?.url?.split("v=")[1] || "";
}

async function artistPool(artist: string): Promise<string[]> {
  const names = splitArtists(artist);
  if (!names.length) return [];
  const key = names.join("|").toLowerCase();
  if (poolCache.has(key)) return poolCache.get(key)!;
  const queries = names.length > 1
    ? [`${names.join(" ")} official music video`, ...names.map((n) => `${n} official music video`)]
    : [`${names[0]} official music video`];
  const results = await Promise.all(queries.map((q) => searchYouTubeVideos(q, 12).catch(() => [] as any[])));
  const firsts = names.map((n) => n.toLowerCase().split(" ")[0]);
  const ids = new Set<string>();
  for (const v of results.flat() as any[]) {
    const t = `${v.title || v.snippet?.title || ""} ${v.channelTitle || v.uploader || v.snippet?.channelTitle || ""}`.toLowerCase();
    if (STATIC_RE.test(t)) continue;
    if (!firsts.some((f) => t.includes(f))) continue;
    const id = idOf(v);
    if (id) ids.add(id);
  }
  const pool = [...ids];
  if (pool.length) poolCache.set(key, pool);
  return pool;
}

const lastPicked = new Map<string, string>();
async function pickArtistVideo(artist: string): Promise<string> {
  const pool = await artistPool(artist);
  if (!pool.length) return "";
  const key = artist.toLowerCase();
  const options = pool.length > 1 ? pool.filter((id) => id !== lastPicked.get(key)) : pool;
  const id = options[Math.floor(Math.random() * options.length)];
  lastPicked.set(key, id);
  return id;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([][^)\]]*[)\]]/g, "")
    .replace(/\s*(?:feat\.?|ft\.?|featuring)\s.*$/i, "")
    .replace(/\s+-\s+.*$/, "")
    .trim() || title;
}

const songCache = new Map<string, string>();
/** First real (non-static) video matching the song and an artist name. */
async function firstMatch(query: string, songWords: string[], firsts: string[]): Promise<string> {
  const res = (await searchYouTubeVideos(query, 10).catch(() => [])) as any[];
  for (const v of res) {
    const t = `${v.title || v.snippet?.title || ""} ${v.channelTitle || v.uploader || v.snippet?.channelTitle || ""}`.toLowerCase();
    if (STATIC_RE.test(t)) continue;
    if (songWords.length && !songWords.some((w) => t.includes(w))) continue;
    if (!firsts.some((f) => t.includes(f))) continue;
    const id = idOf(v);
    if (id) return id;
  }
  return "";
}

/**
 * Video cascade: song music video -> fan-made video -> both artists' video ->
 * artist Vevo video -> random video from the artist's pool (last resort).
 */
async function pickVideo(title: string, artist: string): Promise<string> {
  const names = splitArtists(artist);
  if (!names.length) return "";
  const song = cleanTitle(title);
  const key = `${song}|${artist}`.toLowerCase();
  if (songCache.has(key)) return songCache.get(key)!;
  const firsts = names.map((n) => n.toLowerCase().split(" ")[0]);
  const words = song.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
  const steps: Array<[string, string[]]> = [];
  if (song) {
    steps.push([`${song} ${names[0]} music video`, words]);
    steps.push([`${song} ${names[0]} fan made video`, words]);
  }
  if (names.length > 1) steps.push([`${names.join(" ")} music video`, []]);
  steps.push([`${names[0]} vevo music video`, []]);
  for (const [q, w] of steps) {
    const id = await firstMatch(q, w, firsts);
    if (id) { songCache.set(key, id); return id; }
  }
  return pickArtistVideo(artist);
}

interface Props {
  trackId: string;
  artwork: string;
  videoId?: string;
  artist?: string;
  title?: string;
  enabled?: boolean;
  className?: string;
  onActiveChange?: (active: boolean) => void;
}

export function VideoCanvas({ trackId, artwork, artist = "", title = "", enabled = true, className, onActiveChange }: Props) {
  const [id, setId] = useState("");

  // Always use the artist's official music videos — never the audio stream ID,
  // which is usually a static/visualizer upload.
  useEffect(() => {
    let cancelled = false;
    setId("");
    if (artist && enabled) {
      pickVideo(title, artist).then((v) => { if (!cancelled) setId(v); });
    }
    return () => { cancelled = true; };
  }, [trackId, artist, title, enabled]);

  const active = enabled && !!id;
  // Hide the frame until YouTube's own start-up buttons have gone away.
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(false); if (!id) return; const t = window.setTimeout(() => setReady(true), 2600); return () => window.clearTimeout(t); }, [id]);
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden select-none", className)}>
      {active ? (
        <iframe
          key={id}
          title="canvas"
          tabIndex={-1}
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1&fs=0&start=30`}
          allow="autoplay; encrypted-media"
          className={cn("pointer-events-none absolute left-1/2 top-1/2 h-[max(118%,62.5vw)] w-[max(118%,210vh)] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-1000", ready ? "opacity-100" : "opacity-0")}
        />
      ) : artwork ? (
        <img src={artwork} alt="" className="h-full w-full scale-110 object-cover blur-2xl opacity-60" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/90" />
    </div>
  );
}
