import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useCrossfade } from "@/lib/crossfadePrefs";

/** Crossfade on/off, length (1–15s) and tempo sync — shared by Settings and EQ. */
export function CrossfadeControls() {
  const [xf, setXf] = useCrossfade();
  return (
    <div className="space-y-4 rounded-lg bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Crossfade</p>
          <p className="text-xs text-muted-foreground">{xf.enabled ? `Songs blend for ${xf.seconds}s` : "Off"}</p>
        </div>
        <Switch checked={xf.enabled} onCheckedChange={(v) => setXf({ enabled: v })} aria-label="Crossfade" />
      </div>
      <div className={xf.enabled ? "" : "pointer-events-none opacity-40"}>
        <div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>1s</span><span>{xf.seconds}s</span><span>15s</span></div>
        <Slider value={[xf.seconds]} min={1} max={15} step={1} onValueChange={([v]) => setXf({ seconds: v })} />
      </div>
      <div className={"flex items-center justify-between " + (xf.enabled ? "" : "pointer-events-none opacity-40")}>
        <div>
          <p className="text-sm font-semibold text-foreground">Tempo sync</p>
          <p className="text-xs text-muted-foreground">Lines the next song up during the blend, then eases back to normal over 10s</p>
        </div>
        <Switch checked={xf.sync} onCheckedChange={(v) => setXf({ sync: v })} aria-label="Tempo sync" />
      </div>
    </div>
  );
}
