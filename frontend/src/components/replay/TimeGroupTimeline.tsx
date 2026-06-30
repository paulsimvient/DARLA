import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { PlaybackData } from "../../playback";
import type { SimEvent } from "../../types";

type TimelineMode = "follow" | "inspect";
import { useSimulation } from "../../context/SimulationContext";
import { countRoutineEvents, filterKeyEvents } from "../../utils/keyEvents";
import { scenarioTimelineDefaults } from "../../utils/scenarioProfile";
import { milestoneBadgeTops, type TimelineMilestone } from "../../utils/timelineMilestones";
import { laneMarkersForDisplay, snapSeekToNearestMarker } from "../../utils/timelineMarkers";
import {
  buildAxisTicks,
  chooseAxisStepTicks,
  formatSimTime,
  formatSimTimeRange,
} from "../../utils/simTime";
import {
  DEFAULT_PX_PER_TICK,
  MAX_PX_PER_TICK,
  clampPxPerTick,
  eventInRange,
  isRangeActive,
  normalizeRange,
  pxPerTickToFit,
  rangeAroundTick,
  resolveTimelineMaxTick,
  TIMELINE_CONTENT_PAD_PX,
  TIMELINE_DISPLAY_LANES,
  TIMELINE_LABEL_GUTTER_PX,
  tickToPx,
  timelineContentWidth,
  pxToTick,
  type TickRange,
  zoomPxPerTick,
} from "../../utils/timelineGroupSelection";
import TimelineLaneMarker from "./TimelineLaneMarker";

const DRAG_THRESHOLD_PX = 5;
const LANE_HEIGHT_PX = 32;
const AXIS_HEIGHT_PX = 36;

const LANE_HINTS: Record<(typeof TIMELINE_DISPLAY_LANES)[number]["id"], string> = {
  cyber: "Problems — attacks, degradations, causal warnings (click to inspect evidence & impact)",
  detect: "Detection changes — sensor/track confidence shifts",
  coa: "Decisions — COA reviews when options or ranking changed",
  exec: "Execution — approvals and commanded actions taken",
};

type TimeGroupTimelineProps = {
  playback: PlaybackData;
  events: SimEvent[];
  currentTick: number;
  liveTick?: number;
  timelineMode?: "follow" | "inspect";
  range: TickRange | null;
  onRangeChange: (range: TickRange | null) => void;
  selectedEventId?: number | null;
  onTickChange: (tick: number) => void;
  onEventSelect: (event: SimEvent) => void;
  onTimelineModeChange?: (mode: TimelineMode) => void;
  onPlayingChange?: (playing: boolean) => void;
  onFollowLive?: () => void;
  liveMode?: boolean;
  rangeModeLabel: string;
  selectedEventCount: number;
};

export default function TimeGroupTimeline({
  playback,
  events,
  currentTick,
  liveTick = currentTick,
  timelineMode = "follow",
  range,
  onRangeChange,
  selectedEventId,
  onTickChange,
  onEventSelect,
  onTimelineModeChange,
  liveMode = false,
  rangeModeLabel,
  selectedEventCount,
}: TimeGroupTimelineProps) {
  const { dashboard, scenario } = useSimulation();
  const timelineDefaults = scenarioTimelineDefaults(scenario);
  const tickSeconds = playback.tick_seconds ?? 1;
  const missionCutoff =
    playback.mission_cutoff > 0
      ? playback.mission_cutoff
      : dashboard?.mission_cutoff ?? timelineDefaults.mission_cutoff;
  const scenarioMaxTick = Math.max(
    timelineDefaults.max_ticks,
    dashboard?.max_ticks ?? 0,
    playback.max_ticks ?? 0,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartTick = useRef<number | null>(null);
  const dragStartX = useRef<number | null>(null);
  const didDrag = useRef(false);
  const autoScrollingRef = useRef(false);
  const programmaticScrollUntilRef = useRef(0);
  const suppressInspectOnScrollRef = useRef(false);
  const suppressClickSeekRef = useRef(false);
  const pendingCenterTickRef = useRef<number | null>(null);
  const didInitialFitRef = useRef(false);
  const runFitKeyRef = useRef("");
  const [dragging, setDragging] = useState(false);
  const [hoverTick, setHoverTick] = useState<number | null>(null);
  const [pxPerTick, setPxPerTick] = useState(DEFAULT_PX_PER_TICK);
  const [scrollMetrics, setScrollMetrics] = useState({ left: 0, width: 0, client: 0 });

  const lastEventTick = useMemo(
    () => events.reduce((max, event) => Math.max(max, event.tick), 0),
    [events],
  );
  const maxTick = useMemo(
    () =>
      resolveTimelineMaxTick(playback, {
        liveMode,
        // liveTick intentionally excluded: no separate green live playhead.
        lastEventTick,
        scenarioMaxTick,
      }),
    [lastEventTick, liveMode, liveTick, playback, scenarioMaxTick],
  );

  const contentWidth = useMemo(
    () => timelineContentWidth(maxTick, pxPerTick),
    [maxTick, pxPerTick],
  );
  const timelineOuterWidth = TIMELINE_LABEL_GUTTER_PX + contentWidth;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onRangeChange(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onRangeChange]);

  const keyEvents = useMemo(() => filterKeyEvents(events), [events]);
  const inspectMarkerCount = useMemo(
    () =>
      TIMELINE_DISPLAY_LANES.reduce(
        (total, lane) => total + laneMarkersForDisplay(events, lane.id, pxPerTick).length,
        0,
      ),
    [events, pxPerTick],
  );
  const routineCount = countRoutineEvents(events);
  const pastCutoff = missionCutoff > 0 && currentTick >= missionCutoff;

  const pointerToTick = useCallback(
    (clientX: number) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return 0;
      const rect = scrollEl.getBoundingClientRect();
      const canvasX =
        clientX - rect.left + scrollEl.scrollLeft - TIMELINE_LABEL_GUTTER_PX;
      const tick = pxToTick(canvasX, pxPerTick);
      return Math.max(0, Math.min(maxTick, tick));
    },
    [maxTick, pxPerTick],
  );

  const followTick = currentTick;

  const lockProgrammaticScroll = useCallback((behavior: ScrollBehavior) => {
    const durationMs = behavior === "smooth" ? 900 : 150;
    programmaticScrollUntilRef.current = Date.now() + durationMs;
    autoScrollingRef.current = true;
    window.setTimeout(() => {
      autoScrollingRef.current = false;
    }, durationMs);
  }, []);

  const enterInspectMode = useCallback(() => {
    if (timelineMode !== "inspect") {
      onTimelineModeChange?.("inspect");
    }
  }, [onTimelineModeChange, timelineMode]);

  const scrollToTick = useCallback(
    (tick: number, behavior: ScrollBehavior = "smooth", align: "center" | "follow" = "center") => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      lockProgrammaticScroll(behavior);
      const safeTick = Math.max(0, Math.min(maxTick, tick));
      const playheadCanvasX = tickToPx(safeTick, pxPerTick);
      const canvasViewportWidth = Math.max(1, scrollEl.clientWidth - TIMELINE_LABEL_GUTTER_PX);
      const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
      const target =
        align === "follow"
          ? Math.min(
              maxScroll,
              Math.max(0, TIMELINE_LABEL_GUTTER_PX + playheadCanvasX - scrollEl.clientWidth * 0.35),
            )
          : Math.min(maxScroll, Math.max(0, playheadCanvasX - canvasViewportWidth / 2));
      scrollEl.scrollTo({ left: target, behavior });
    },
    [lockProgrammaticScroll, maxTick, pxPerTick],
  );

  const centerPlayhead = useCallback(() => {
    const tick = followTick;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const safeTick = Math.max(0, Math.min(maxTick, tick));
    const canZoom = maxTick > 0 && pxPerTick < MAX_PX_PER_TICK;
    const needsZoom = scrollEl.scrollWidth <= scrollEl.clientWidth + 1 && canZoom;

    if (needsZoom) {
      const minPxToOverflow =
        (scrollEl.clientWidth * 1.5 - TIMELINE_CONTENT_PAD_PX * 2) / Math.max(maxTick, 1);
      const nextPx = clampPxPerTick(Math.max(pxPerTick * 1.5, minPxToOverflow));
      if (nextPx > pxPerTick + 0.01) {
        pendingCenterTickRef.current = safeTick;
        setPxPerTick(nextPx);
        return;
      }
    }

    scrollToTick(safeTick, "auto", "center");
  }, [followTick, maxTick, pxPerTick, scrollToTick]);

  const updateScrollMetrics = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollMetrics({ left: el.scrollLeft, width: el.scrollWidth, client: el.clientWidth });
  }, []);

  const fitTimelineToViewport = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || maxTick <= 0) return;
    const nextPx = pxPerTickToFit(maxTick, scrollEl.clientWidth);
    setPxPerTick(nextPx);
    scrollEl.scrollTo({ left: 0, behavior: "auto" });
    updateScrollMetrics();
  }, [maxTick, updateScrollMetrics]);

  useEffect(() => {
    const runKey = `${playback.scenario_id}:${playback.seed}`;
    if (runKey !== runFitKeyRef.current) {
      runFitKeyRef.current = runKey;
      didInitialFitRef.current = false;
    }
  }, [playback.scenario_id, playback.seed]);

  useEffect(() => {
    if (liveMode || maxTick <= 0 || didInitialFitRef.current) return;
    didInitialFitRef.current = true;
    requestAnimationFrame(() => {
      fitTimelineToViewport();
    });
  }, [fitTimelineToViewport, liveMode, maxTick]);

  useEffect(() => {
    if (timelineMode !== "follow") return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const playheadPx = TIMELINE_LABEL_GUTTER_PX + tickToPx(followTick, pxPerTick);
    const viewLeft = scrollEl.scrollLeft;
    const viewRight = viewLeft + scrollEl.clientWidth;
    if (playheadPx < viewLeft + 96 || playheadPx > viewRight - 96) {
      scrollToTick(followTick, "auto", "follow");
    }
  }, [followTick, pxPerTick, scrollToTick, timelineMode]);

  useEffect(() => {
    if (pendingCenterTickRef.current == null) return;
    const tick = pendingCenterTickRef.current;
    pendingCenterTickRef.current = null;
    requestAnimationFrame(() => {
      scrollToTick(tick, "auto", "center");
      updateScrollMetrics();
    });
  }, [contentWidth, pxPerTick, scrollToTick, updateScrollMetrics]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const onScroll = () => {
      updateScrollMetrics();
      if (suppressInspectOnScrollRef.current) return;
      if (Date.now() < programmaticScrollUntilRef.current) return;
      if (autoScrollingRef.current) return;
      // Scrolling the timeline is a viewport action, not a playback action.
      // Keep playback/follow state stable; explicit scrubs/clicks enter inspect mode.
    };
    updateScrollMetrics();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScrollMetrics);
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScrollMetrics);
    };
  }, [onTimelineModeChange, timelineMode, updateScrollMetrics, contentWidth]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.05 : 0.95;
      setPxPerTick((prev) => zoomPxPerTick(prev, factor));
    };

    scrollEl.addEventListener("wheel", onWheel, { passive: false });
    return () => scrollEl.removeEventListener("wheel", onWheel);
  }, []);

  const finishDrag = useCallback(() => {
    if (didDrag.current && dragStartTick.current != null) {
      enterInspectMode();
    } else if (dragStartTick.current != null && !suppressClickSeekRef.current) {
      const rawTick = dragStartTick.current;
      const { tick: snapped, event } = snapSeekToNearestMarker(
        rawTick,
        events,
        pxPerTick,
        maxTick,
        { preferAtOrBefore: rawTick < currentTick },
      );
      enterInspectMode();
      onTickChange(snapped);
      if (event) {
        onEventSelect(event);
      }
      onRangeChange(rangeAroundTick(snapped, maxTick));
      scrollToTick(snapped);
    }
    suppressClickSeekRef.current = false;
    setDragging(false);
    dragStartTick.current = null;
    dragStartX.current = null;
    didDrag.current = false;
  }, [
    enterInspectMode,
    currentTick,
    events,
    maxTick,
    onEventSelect,
    onRangeChange,
    onTickChange,
    pxPerTick,
    scrollToTick,
  ]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: MouseEvent) => {
      if (dragStartTick.current == null || dragStartX.current == null) return;
      if (Math.abs(event.clientX - dragStartX.current) > DRAG_THRESHOLD_PX) {
        didDrag.current = true;
      }
      const tick = pointerToTick(event.clientX);
      setHoverTick(tick);
      if (didDrag.current) {
        onRangeChange(normalizeRange(dragStartTick.current, tick, maxTick));
      }
    };

    const onUp = () => finishDrag();

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, finishDrag, maxTick, onRangeChange, pointerToTick]);

  const handlePointerDown = (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStartX.current = e.clientX;
    dragStartTick.current = pointerToTick(e.clientX);
    didDrag.current = false;
    setHoverTick(dragStartTick.current);
  };

  const handlePointerMove = (e: ReactMouseEvent) => {
    setHoverTick(pointerToTick(e.clientX));
  };

  const handleScrollAreaWheel = (e: ReactWheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  };

  const bandLeft = isRangeActive(range) ? tickToPx(range.start, pxPerTick) : 0;
  const bandWidth = isRangeActive(range)
    ? Math.max(12, tickToPx(range.end, pxPerTick) - bandLeft)
    : 0;
  const playheadTick = Math.min(currentTick, maxTick);
  const cutoffLeft =
    missionCutoff > 0 ? tickToPx(Math.min(missionCutoff, maxTick), pxPerTick) : null;
  const scenarioEndLeft = tickToPx(maxTick, pxPerTick);
  const hoverLeft = hoverTick != null ? tickToPx(hoverTick, pxPerTick) : null;
  const preCutoffWidth =
    cutoffLeft != null ? cutoffLeft : scenarioEndLeft;

  const milestones = useMemo(() => {
    const items: TimelineMilestone[] = [];
    if (missionCutoff > 0 && missionCutoff <= maxTick) {
      items.push({
        id: "cutoff",
        tick: missionCutoff,
        lineClass: "bg-amber-400/90",
        badgeClass: "border-amber-700/50 bg-amber-950/90 text-amber-200",
        label: `Decision cutoff · ${formatSimTime(missionCutoff, tickSeconds, true)}`,
      });
    }
    if (maxTick > 0 && (missionCutoff <= 0 || maxTick !== missionCutoff)) {
      items.push({
        id: "scenario-end",
        tick: maxTick,
        lineClass: "border-l border-dashed border-slate-500/60",
        badgeClass: "border-slate-600/50 bg-slate-950/90 text-slate-300",
        label: `Scenario end · ${formatSimTime(maxTick, tickSeconds, true)}`,
      });
    }
    items.push({
      id: "playhead",
      tick: playheadTick,
      lineClass: "bg-blue-400",
      badgeClass: "border-blue-600 bg-blue-600 text-white",
      label: formatSimTime(currentTick, tickSeconds, true),
    });
    // Timeline V2 deliberately renders exactly one playhead. Backend/live progress
    // is shown as text status elsewhere so users do not see two competing cursors.
    return items;
  }, [
    currentTick,
    liveTick,
    maxTick,
    missionCutoff,
    playheadTick,
    tickSeconds,
    timelineMode,
  ]);

  const milestoneTops = useMemo(
    () => milestoneBadgeTops(milestones, pxPerTick),
    [milestones, pxPerTick],
  );

  const tickMarks = useMemo(() => {
    if (maxTick <= 0) return [];
    const step = chooseAxisStepTicks(tickSeconds, pxPerTick, 160);
    return buildAxisTicks(maxTick, step);
  }, [maxTick, pxPerTick, tickSeconds]);

  const lanesHeight = TIMELINE_DISPLAY_LANES.length * LANE_HEIGHT_PX;
  const canvasHeight = AXIS_HEIGHT_PX + lanesHeight;
  const viewportLeftPct =
    scrollMetrics.width > 0 ? (scrollMetrics.left / scrollMetrics.width) * 100 : 0;
  const viewportWidthPct =
    scrollMetrics.width > 0 ? (scrollMetrics.client / scrollMetrics.width) * 100 : 100;
  const playheadPct = maxTick > 0 ? (currentTick / maxTick) * 100 : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-darla-text">
            Replay timeline
          </h2>
          <p className="mt-0.5 text-xs text-darla-text-muted">
            {timelineMode === "inspect"
              ? `Inspecting T+${currentTick}`
              : `Replay playhead T+${currentTick} · backend buffered to T+${liveTick}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
              liveMode
                ? "border-blue-500/40 bg-blue-950/40 text-blue-200"
                : "border-slate-500/40 bg-slate-900/40 text-slate-300"
            }`}
          >
            Replay
          </span>
          <button
            type="button"
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold hover:bg-[#111827] ${
              "border-slate-600 bg-[#0b1220] text-blue-100"
            }`}
            onClick={() => {
              scrollToTick(currentTick, "smooth", "follow");
            }}
          >
            Center playhead
          </button>
          <div className="rounded-lg border border-[#263143] bg-[#0b1018] px-3 py-1.5 text-xs">
            <span className="text-darla-text-muted">Now </span>
            <strong className="font-mono text-blue-200">{formatSimTime(currentTick, tickSeconds)}</strong>
            <span className="mx-1.5 text-darla-text-muted">·</span>
            <span className="text-darla-text-muted">End </span>
            <span className="font-mono text-darla-text-secondary">
              {formatSimTime(maxTick, tickSeconds, true)}
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[#263143] bg-[#0b1018] p-1">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm font-bold text-darla-text hover:bg-[#1a2233]"
              aria-label="Zoom out"
              onClick={() => setPxPerTick((p) => zoomPxPerTick(p, 0.9))}
            >
              −
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] text-darla-text-secondary hover:bg-[#1a2233]"
              onClick={() => {
                pendingCenterTickRef.current = followTick;
                fitTimelineToViewport();
              }}
            >
              fit all
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm font-bold text-darla-text hover:bg-[#1a2233]"
              aria-label="Zoom in"
              onClick={() => setPxPerTick((p) => zoomPxPerTick(p, 1.1))}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-[#0b1220] px-2.5 py-1.5 text-[11px] font-bold text-blue-100 hover:bg-[#111827]"
            onClick={() => {
              centerPlayhead();
            }}
          >
            Center playhead
          </button>
          {isRangeActive(range) ? (
            <button
              type="button"
              className="rounded-lg border border-slate-600 bg-[#0b1220] px-2.5 py-1.5 text-[11px] font-bold text-blue-100 hover:bg-[#111827]"
              onClick={() => onRangeChange(null)}
            >
              Clear selection
            </button>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-3 rounded-lg border border-[#263143] bg-[#0a0e14] px-3 py-2 text-[10px] text-darla-text-muted">
        {TIMELINE_DISPLAY_LANES.map((lane) => (
          <span key={lane.id} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${lane.dotClass}`} />
            <strong className="text-darla-text-secondary">{lane.label}</strong>
            <span>— {LANE_HINTS[lane.id]}</span>
          </span>
        ))}
        <span className="ml-auto hidden sm:inline">
          {isRangeActive(range)
            ? `Selection: ${formatSimTimeRange(range.start, range.end, tickSeconds)} · ${selectedEventCount} events · ${rangeModeLabel}`
            : `${inspectMarkerCount} markers · ${keyEvents.length} key events · full scenario to ${formatSimTime(maxTick, tickSeconds, true)} · ${routineCount} routine hidden`}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-[#222a39] bg-[#0b1018]">
        <div
          ref={scrollRef}
          className="darla-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain"
          onWheel={handleScrollAreaWheel}
        >
          <div
            className="inline-flex flex-col"
            style={{ width: timelineOuterWidth, minHeight: canvasHeight }}
          >
            <div className="sticky top-0 z-20 flex border-b border-[#222a39]/80 bg-[#0a0e14]">
              <div
                className="sticky left-0 z-30 shrink-0 border-r border-[#222a39] bg-[#0a0e14] px-2 pt-2"
                style={{ width: TIMELINE_LABEL_GUTTER_PX, height: AXIS_HEIGHT_PX }}
              >
                <span className="text-[9px] uppercase tracking-wider text-darla-text-muted">Lane</span>
              </div>
              <div className="relative shrink-0" style={{ width: contentWidth, height: AXIS_HEIGHT_PX }}>
                {tickMarks.map((tick) => {
                  const left = tickToPx(tick, pxPerTick);
                  return (
                    <div key={tick} className="absolute bottom-0 top-0" style={{ left }}>
                      <div className="h-full w-px bg-[#253248]/80" />
                      <span className="absolute left-1 top-1 whitespace-nowrap font-mono text-[9px] text-darla-text-muted">
                        {tick === 0 ? "Start" : formatSimTime(tick, tickSeconds, true)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="flex shrink-0"
              style={{ minHeight: lanesHeight }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseLeave={() => {
                if (!dragging) setHoverTick(null);
              }}
            >
              <div
                className="sticky left-0 z-30 shrink-0 border-r border-[#222a39] bg-[#0b1018]"
                style={{ width: TIMELINE_LABEL_GUTTER_PX, height: lanesHeight }}
              >
                {TIMELINE_DISPLAY_LANES.map((lane, index) => (
                  <div
                    key={lane.id}
                    className={`flex flex-col justify-center border-b border-[#222a39]/50 px-2 ${
                      index % 2 === 0 ? "bg-[#0b1018]" : "bg-[#0d1219]"
                    }`}
                    style={{ height: LANE_HEIGHT_PX }}
                    title={LANE_HINTS[lane.id]}
                  >
                    <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-darla-text-secondary">
                      {lane.label}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="relative shrink-0 select-none"
                style={{ width: contentWidth, height: lanesHeight }}
              >
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className="absolute inset-y-0 bg-emerald-950/20"
                    style={{ left: 0, width: preCutoffWidth }}
                  />
                  {cutoffLeft != null && missionCutoff < maxTick ? (
                    <div
                      className="absolute inset-y-0 bg-amber-950/25"
                      style={{ left: cutoffLeft, right: 0 }}
                    />
                  ) : null}
                </div>

                {isRangeActive(range) ? (
                  <div
                    className="pointer-events-none absolute inset-y-0 z-[1] border-x-2 border-blue-400/90 bg-blue-500/15"
                    style={{ left: bandLeft, width: bandWidth }}
                  >
                    <span className="absolute left-1 top-1 rounded bg-blue-600/90 px-1 py-0.5 text-[9px] font-bold text-white">
                      {formatSimTime(range.start, tickSeconds, true)}
                    </span>
                    <span className="absolute right-1 top-1 rounded bg-blue-600/90 px-1 py-0.5 text-[9px] font-bold text-white">
                      {formatSimTime(range.end, tickSeconds, true)}
                    </span>
                  </div>
                ) : null}

                {milestones.map((milestone) => {
                  const left = tickToPx(milestone.tick, pxPerTick);
                  const top = milestoneTops.get(milestone.id) ?? 4;
                  const isPlayhead = milestone.id === "playhead";
                  return (
                    <div
                      key={milestone.id}
                      className={`pointer-events-none absolute inset-y-0 z-[2] w-0.5 ${milestone.lineClass}`}
                      style={{
                        left,
                        boxShadow: isPlayhead ? "0 0 12px rgba(96,165,250,0.55)" : undefined,
                      }}
                    >
                      <span
                        className={`absolute left-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${milestone.badgeClass}`}
                        style={{ top }}
                      >
                        {milestone.label}
                      </span>
                    </div>
                  );
                })}

                {hoverLeft != null && !dragging ? (
                  <div
                    className="pointer-events-none absolute inset-y-0 z-[2] w-px border-l border-dashed border-slate-400/50"
                    style={{ left: hoverLeft }}
                  />
                ) : null}

                <div className="absolute inset-x-0 top-0">
                  {TIMELINE_DISPLAY_LANES.map((lane, index) => {
                    const laneMarkers = laneMarkersForDisplay(events, lane.id, pxPerTick);
                    return (
                      <div
                        key={lane.id}
                        className={`relative border-b border-[#222a39]/40 ${
                          index % 2 === 0 ? "bg-transparent" : "bg-[#0d1219]/50"
                        }`}
                        style={{ height: LANE_HEIGHT_PX }}
                      >
                        <div
                          className={`absolute inset-x-0 top-1/2 h-px -translate-y-1/2 ${lane.lineClass}`}
                          style={{ left: TIMELINE_CONTENT_PAD_PX, right: TIMELINE_CONTENT_PAD_PX }}
                        />
                        {laneMarkers.map((marker) => (
                          <TimelineLaneMarker
                            key={marker.event.event_id}
                            marker={marker}
                            lane={lane}
                            pxPerTick={pxPerTick}
                            tickSeconds={tickSeconds}
                            inRange={eventInRange(marker.event, range)}
                            active={marker.event.event_id === selectedEventId}
                            future={marker.event.tick > currentTick}
                            onSelect={(selected) => {
                              suppressClickSeekRef.current = true;
                              onTickChange(selected.tick);
                              onEventSelect(selected);
                              onRangeChange(rangeAroundTick(selected.tick, maxTick));
                              scrollToTick(selected.tick);
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#222a39] bg-[#0a0e14] px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-[9px] text-darla-text-muted">
            <span>{formatSimTime(0, tickSeconds, true)}</span>
            {hoverTick != null ? (
              <span className="font-mono text-slate-300">
                Hover: {formatSimTime(hoverTick, tickSeconds)}
                {dragging && isRangeActive(range)
                  ? ` · selecting ${formatSimTimeRange(range.start, range.end, tickSeconds, true)}`
                  : ""}
              </span>
            ) : (
              <span>Drag lanes to select · scroll vertically for all lanes · Ctrl+wheel to zoom</span>
            )}
            <span>{formatSimTime(maxTick, tickSeconds, true)}</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-[#111827]">
            <div
              className="absolute inset-y-0 rounded-full bg-blue-500/25"
              style={{ left: `${viewportLeftPct}%`, width: `${Math.max(viewportWidthPct, 4)}%` }}
            />
            <div
              className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-blue-400"
              style={{ left: `${playheadPct}%` }}
            />
          </div>
        </div>
      </div>

      {pastCutoff ? (
        <p className="shrink-0 text-[11px] text-amber-300/90">
          Playhead is past the decision cutoff — new branches are what-if, not baseline history.
        </p>
      ) : null}
    </div>
  );
}
