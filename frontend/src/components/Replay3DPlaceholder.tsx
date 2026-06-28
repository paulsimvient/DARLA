import { Box, Pause, Play, SkipBack, SkipForward } from "lucide-react";

export default function Replay3DPlaceholder() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="rounded-lg border border-darla-border bg-darla-panel p-4">
        <h2 className="text-sm font-semibold text-darla-text">3D Replay — High-Fidelity Visualization</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-darla-text-secondary">
          3D Replay is an optional high-fidelity visualization layer. The authoritative simulation
          remains in the DARLA backend. This view can later connect to Unreal, Cesium, or a streamed
          3D client.
        </p>
      </div>

      <div className="relative flex min-h-[400px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-darla-border bg-darla-bg">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `
              radial-gradient(ellipse 60% 50% at 50% 50%, rgba(77,163,255,0.15) 0%, transparent 70%),
              linear-gradient(180deg, #0a1628 0%, #07111f 100%)
            `,
          }}
        />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <Box size={48} className="text-darla-blue/50" />
          <span className="text-sm text-darla-text-secondary">3D Viewport Placeholder</span>
          <span className="text-xs text-darla-text-secondary/70">
            Connect Unreal Pixel Streaming or Cesium here
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 rounded-lg border border-darla-border bg-darla-panel px-4 py-3">
        <button type="button" className="rounded p-2 text-darla-text-secondary hover:bg-darla-border/30 hover:text-darla-text">
          <SkipBack size={18} />
        </button>
        <button type="button" className="rounded bg-darla-blue p-2 text-white hover:bg-darla-blue/90">
          <Play size={18} />
        </button>
        <button type="button" className="rounded p-2 text-darla-text-secondary hover:bg-darla-border/30 hover:text-darla-text">
          <Pause size={18} />
        </button>
        <button type="button" className="rounded p-2 text-darla-text-secondary hover:bg-darla-border/30 hover:text-darla-text">
          <SkipForward size={18} />
        </button>
        <div className="ml-4 h-1.5 w-64 rounded-full bg-darla-border">
          <div className="h-full w-1/3 rounded-full bg-darla-blue" />
        </div>
        <span className="font-mono text-xs text-darla-text-secondary">01:24 / 02:14</span>
      </div>
    </div>
  );
}
