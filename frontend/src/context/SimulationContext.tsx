import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createBranch,
  createRun,
  fetchDashboard,
  fetchRunStatus,
  runStreamUrl,
  sendRunCommand,
} from "../api";
import {
  eventsUpToTick,
  frameAtTick,
  type PlaybackData,
  type PlaybackFrame,
} from "../playback";
import type {
  BranchResult,
  CourseOfAction,
  DashboardData,
  MapEntity,
  RelationshipEdge,
  RunIdentity,
  SimCommandAck,
  SimEvent,
} from "../types";
import { coaApprovalKey, rankCoas } from "../utils/coaHelpers";
import { firstKeyEventAtTick } from "../utils/keyEvents";
import { scenarioTimelineDefaults } from "../utils/scenarioProfile";

export const SCENARIOS = [
  {
    id: "scenarios/uas-maritime-cyber/scenario.yaml",
    label: "UAS Maritime Cyber",
    subtitle: "Taiwan Strait micro-world",
  },
  {
    id: "scenarios/uas-maritime-cyber/fmu-stub.yaml",
    label: "FMU Co-Sim Stub",
    subtitle: "YAML-bound sensor FMU stepping",
  },
  {
    id: "scenarios/uas-maritime-cyber/comms-only.yaml",
    label: "Comms Degradation Only",
    subtitle: "Relay recovery intervention",
  },
  {
    id: "scenarios/taiwan-maritime-open-data/scenario.yaml",
    label: "Taiwan Open Data",
    subtitle: "AIS + Open-Meteo snapshot · provenance regression",
  },
] as const;

export type SimulationStatus = "idle" | "loading" | "live" | "ready" | "error";
export type ReplayView = "baseline" | "branch" | "compare";
export type TimelineMode = "follow" | "inspect";

export type ReviewHold = {
  tick: number;
  coa_ids: number[];
};

type SimulationContextValue = {
  scenario: string;
  seed: number;
  authorizationMode: string;
  runIdentity: RunIdentity | null;
  branchResults: BranchResult[];
  commandAcks: SimCommandAck[];
  status: SimulationStatus;
  error: string | null;
  dashboard: DashboardData | null;
  playback: PlaybackData | null;
  branchPlayback: PlaybackData | null;
  playbackRefinement: PlaybackData | null;
  currentTick: number;
  liveTick: number;
  timelineMode: TimelineMode;
  reviewHold: ReviewHold | null;
  isPlaying: boolean;
  playbackSpeed: number;
  liveMode: boolean;
  replayView: ReplayView;
  compareBranch: BranchResult | null;
  activeBranch: BranchResult | null;
  currentFrame: PlaybackFrame | null;
  branchCurrentFrame: PlaybackFrame | null;
  compareBranchFrame: PlaybackFrame | null;
  displayPlayback: PlaybackData | null;
  displayRunIdentity: RunIdentity | null;
  displayCurrentFrame: PlaybackFrame | null;
  coasAtCurrentTick: CourseOfAction[];
  activeCoa: CourseOfAction | null;
  entities: MapEntity[];
  branchEntities: MapEntity[];
  displayEntities: MapEntity[];
  relationships: RelationshipEdge[];
  events: SimEvent[];
  /** Full run ledger for timeline rendering (not clipped to scrub playhead). */
  timelineEvents: SimEvent[];
  approvedCoaIds: number[];
  setScenario: (scenario: string) => void;
  setSeed: (seed: number) => void;
  setAuthorizationMode: (mode: string) => void;
  setCurrentTick: (tick: number) => void;
  setViewTick: (tick: number) => void;
  setTimelineMode: (mode: TimelineMode) => void;
  followLive: () => void;
  clearReviewHold: () => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  runSimulation: () => void;
  stopSimulation: () => void;
  approveCoa: (coa: CourseOfAction) => Promise<void>;
  rejectCoa: (coa: CourseOfAction, reason?: string) => Promise<void>;
  simulateWhatIf: (coa: CourseOfAction, fromTick?: number) => Promise<void>;
  continueReview: () => Promise<void>;
  openBranchReplay: (branch: BranchResult) => void;
  returnToBaseline: () => void;
  startBranchCompare: (branch: BranchResult) => void;
  stopBranchCompare: () => void;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

function mergeEventsUpToTick(
  dashboardEvents: SimEvent[],
  playbackEvents: SimEvent[],
  cutoffTick: number,
): SimEvent[] {
  const merged = new Map<number, SimEvent>();
  for (const event of dashboardEvents) {
    if (event.tick <= cutoffTick) merged.set(event.event_id, event);
  }
  for (const event of playbackEvents) {
    if (event.tick > cutoffTick) continue;
    const existing = merged.get(event.event_id);
    merged.set(
      event.event_id,
      existing
        ? {
            ...existing,
            ...event,
            deltas: event.deltas.length > 0 ? event.deltas : existing.deltas,
            causal_parent_events:
              event.causal_parent_events ?? existing.causal_parent_events,
          }
        : event,
    );
  }
  return [...merged.values()].sort((a, b) => a.tick - b.tick || a.event_id - b.event_id);
}

function mergeEvents(
  dashboardEvents: SimEvent[],
  playbackEvents: SimEvent[],
  currentTick: number,
): SimEvent[] {
  return mergeEventsUpToTick(dashboardEvents, playbackEvents, currentTick);
}

function timelineHorizonTick(
  scenarioPath: string,
  dashboard: DashboardData | null,
  playback: PlaybackData | null,
  liveTick: number,
): number {
  const defaults = scenarioTimelineDefaults(scenarioPath);
  const dashboardEvents = dashboard?.events ?? [];
  const dashboardMaxTick = dashboardEvents.reduce((max, event) => Math.max(max, event.tick), 0);
  return Math.max(
    defaults.max_ticks,
    dashboard?.max_ticks ?? 0,
    playback?.max_ticks ?? 0,
    playback?.final_tick ?? 0,
    liveTick,
    dashboardMaxTick,
  );
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<string>(SCENARIOS[0].id);
  const [seed, setSeed] = useState(42);
  const [authorizationMode, setAuthorizationMode] = useState("human_hold");
  const [runIdentity, setRunIdentity] = useState<RunIdentity | null>(null);
  const [branchResults, setBranchResults] = useState<BranchResult[]>([]);
  const [commandAcks, setCommandAcks] = useState<SimCommandAck[]>([]);
  const [approvedCoaIds, setApprovedCoaIds] = useState<number[]>([]);
  const [status, setStatus] = useState<SimulationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [playback, setPlayback] = useState<PlaybackData | null>(null);
  const [branchPlayback, setBranchPlayback] = useState<PlaybackData | null>(null);
  const [branchRunIdentity, setBranchRunIdentity] = useState<RunIdentity | null>(null);
  const [playbackRefinement, setPlaybackRefinement] = useState<PlaybackData | null>(null);
  const [currentTick, setCurrentTickState] = useState(0);
  const [liveTick, setLiveTick] = useState(0);
  const [timelineMode, setTimelineModeState] = useState<TimelineMode>("follow");
  const [reviewHold, setReviewHold] = useState<ReviewHold | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(10);
  const [liveMode, setLiveMode] = useState(true);
  const [replayView, setReplayView] = useState<ReplayView>("baseline");
  const [compareBranch, setCompareBranch] = useState<BranchResult | null>(null);
  const [activeBranch, setActiveBranch] = useState<BranchResult | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const branchStreamRef = useRef<EventSource | null>(null);
  const framesRef = useRef<PlaybackFrame[]>([]);
  const branchFramesRef = useRef<PlaybackFrame[]>([]);
  const runIdRef = useRef(0);
  const activeRunIdRef = useRef<string | null>(null);
  const baselineRunIdRef = useRef<string | null>(null);
  const branchStreamRunIdRef = useRef<string | null>(null);
  const branchPollersRef = useRef<number[]>([]);
  const timelineModeRef = useRef<TimelineMode>("follow");
  const statusRef = useRef<SimulationStatus>("idle");
  const liveTickRef = useRef(0);
  const timelineEventsRef = useRef<SimEvent[]>([]);
  const playbackSpeedRef = useRef(playbackSpeed);
  const isPlayingRef = useRef(false);
  const currentTickRef = useRef(0);
  const playheadAnchorRef = useRef(0);
  const pendingScrubRef = useRef(false);
  const prevIsPlayingRef = useRef(false);

  useEffect(() => {
    liveTickRef.current = liveTick;
  }, [liveTick]);

  useEffect(() => {
    currentTickRef.current = currentTick;
  }, [currentTick]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying && !prevIsPlayingRef.current) {
      playheadAnchorRef.current = currentTickRef.current;
      pendingScrubRef.current = true;
    }
    prevIsPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const setTimelineMode = useCallback((mode: TimelineMode) => {
    timelineModeRef.current = mode;
    setTimelineModeState(mode);
  }, []);

  const setViewTick = useCallback(
    (tick: number) => {
      const clamped = Math.max(0, Math.floor(tick));
      playheadAnchorRef.current = clamped;
      currentTickRef.current = clamped;
      pendingScrubRef.current = true;
      isPlayingRef.current = false;
      setTimelineMode("inspect");
      setIsPlaying(false);
      setCurrentTickState(clamped);
    },
    [setTimelineMode],
  );

  const followLive = useCallback(() => {
    playheadAnchorRef.current = currentTickRef.current;
    pendingScrubRef.current = true;
    setTimelineMode("follow");
    if (status === "live" || status === "ready") {
      setIsPlaying(true);
    }
    if (reviewHold && activeRunIdRef.current) {
      void sendRunCommand(activeRunIdRef.current, { type: "continue_review" })
        .then(() => {
          setReviewHold(null);
        })
        .catch(() => {
          // Keep review hold visible if the sim cannot resume yet.
        });
    }
  }, [reviewHold, setTimelineMode, status]);

  const clearReviewHold = useCallback(() => {
    setReviewHold(null);
  }, []);

  const setCurrentTick = useCallback(
    (tick: number) => {
      setViewTick(tick);
    },
    [setViewTick],
  );

  const stopBranchStream = useCallback(() => {
    branchStreamRef.current?.close();
    branchStreamRef.current = null;
    branchStreamRunIdRef.current = null;
    branchFramesRef.current = [];
  }, []);

  const stopSimulation = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    stopBranchStream();
    for (const poller of branchPollersRef.current) {
      window.clearInterval(poller);
    }
    branchPollersRef.current = [];
    setIsPlaying(false);
    setReplayView("baseline");
    setCompareBranch(null);
    setActiveBranch(null);
    setBranchPlayback(null);
    setBranchRunIdentity(null);
  }, [stopBranchStream]);

  const runSimulation = useCallback(() => {
    stopSimulation();
    const runId = ++runIdRef.current;

    setStatus("loading");
    setError(null);
    setDashboard(null);
    setPlayback(null);
    setPlaybackRefinement(null);
    setCurrentTickState(0);
    setLiveTick(0);
    playheadAnchorRef.current = 0;
    currentTickRef.current = 0;
    pendingScrubRef.current = false;
    isPlayingRef.current = false;
    prevIsPlayingRef.current = false;
    setTimelineMode("follow");
    setReviewHold(null);
    setApprovedCoaIds([]);
    setBranchResults([]);
    setCommandAcks([]);
    setReplayView("baseline");
    setCompareBranch(null);
    setActiveBranch(null);
    setBranchPlayback(null);
    setBranchRunIdentity(null);
    framesRef.current = [];
    branchFramesRef.current = [];
    activeRunIdRef.current = null;
    baselineRunIdRef.current = null;
    branchStreamRunIdRef.current = null;

    void createRun({
      scenario,
      seed,
      authorizationMode,
      branchId: "baseline",
    })
      .then((run) => {
        if (runId !== runIdRef.current) return;
        activeRunIdRef.current = run.run_id;
        baselineRunIdRef.current = run.run_id;
        setRunIdentity({
          run_id: run.run_id,
          branch_id: run.branch_id ?? "baseline",
          parent_run_id: run.parent_run_id ?? null,
          seed: run.seed ?? seed,
          scenario_id: scenario,
          current_tick: 0,
          authorization_mode: run.authorization_mode ?? authorizationMode,
        });
        if (run.authorization_mode) {
          setAuthorizationMode(run.authorization_mode);
        }

        void fetchDashboard(scenario, seed, { authorizationMode })
          .then((data) => {
            if (runId !== runIdRef.current) return;
            setDashboard(data);
          })
          .catch(() => {
            // Timeline falls back to streamed events only when export is unavailable.
          });

        const source = new EventSource(runStreamUrl(run.run_id));
        eventSourceRef.current = source;
        setLiveMode(true);
        setStatus("live");
        setIsPlaying(true);

        let meta: Partial<PlaybackData> = {
          scenario_id: scenario,
          seed,
          authorization_mode: authorizationMode,
          max_ticks: 0,
          tick_seconds: 1,
          mission_cutoff: 0,
          final_tick: 0,
          frames: [],
        };

        source.addEventListener("meta", (event) => {
          if (runId !== runIdRef.current) return;
          const payload = JSON.parse((event as MessageEvent).data);
          meta = {
            ...meta,
            scenario_id: payload.scenario_id ?? scenario,
            seed: payload.seed ?? seed,
            authorization_mode: payload.authorization_mode ?? authorizationMode,
            max_ticks: payload.max_ticks ?? 0,
            mission_cutoff: payload.mission_cutoff ?? 0,
            tick_seconds: payload.tick_seconds ?? 1,
          };
          setPlayback({
            ...(meta as PlaybackData),
            frames: framesRef.current,
            final_tick: framesRef.current.at(-1)?.tick ?? 0,
          });
          setRunIdentity((prev) =>
            prev
              ? {
                  ...prev,
                  scenario_id: payload.scenario_id ?? prev.scenario_id,
                  seed: payload.seed ?? prev.seed,
                  authorization_mode: payload.authorization_mode ?? prev.authorization_mode,
                  replay_hash: payload.replay_hash ?? prev.replay_hash,
                }
              : prev,
          );
          if (payload.authorization_mode) {
            setAuthorizationMode(payload.authorization_mode);
          }
        });

        source.addEventListener("tick", (event) => {
          if (runId !== runIdRef.current) return;
          const frame = JSON.parse((event as MessageEvent).data) as PlaybackFrame;
          framesRef.current = [...framesRef.current, frame];
          setLiveTick(frame.tick);
          setPlayback({
            ...(meta as PlaybackData),
            frames: framesRef.current,
            final_tick: frame.tick,
          });
          setRunIdentity((prev) =>
            prev
              ? {
                  ...prev,
                  current_tick: frame.tick,
                  replay_hash: frame.replay_hash ?? prev.replay_hash,
                  run_id: frame.run_id ?? prev.run_id,
                  branch_id: frame.branch_id ?? prev.branch_id,
                }
              : prev,
          );
        });

        source.addEventListener("command", (event) => {
          if (runId !== runIdRef.current) return;
          const payload = JSON.parse((event as MessageEvent).data) as Omit<SimCommandAck, "received_at">;
          if (payload.type === "approve_coa" || payload.type === "reject_coa" || payload.type === "continue_review") {
            setReviewHold(null);
          }
          setCommandAcks((prev) => [
            ...prev.slice(-4),
            {
              ok: payload.ok,
              message: payload.message,
              event_id: payload.event_id,
              tick: payload.tick,
              type: payload.type,
              received_at: Date.now(),
            },
          ]);
        });

        source.addEventListener("review_hold", (event) => {
          if (runId !== runIdRef.current) return;
          const payload = JSON.parse((event as MessageEvent).data) as ReviewHold;
          setReviewHold(payload);
          setTimelineMode("inspect");
          setIsPlaying(false);
          isPlayingRef.current = false;
          playheadAnchorRef.current = payload.tick;
          currentTickRef.current = payload.tick;
          pendingScrubRef.current = true;
          setCurrentTickState(payload.tick);
        });

        source.addEventListener("done", (event) => {
          if (runId !== runIdRef.current) return;
          const payload = JSON.parse((event as MessageEvent).data);
          const finalTick = payload.final_tick ?? framesRef.current.at(-1)?.tick ?? 0;
          setPlayback({
            ...(meta as PlaybackData),
            frames: framesRef.current,
            final_tick: finalTick,
          });
          setStatus("ready");
          setIsPlaying(false);
          setTimelineMode("inspect");
          source.close();
          eventSourceRef.current = null;

          void fetchDashboard(scenario, seed, { authorizationMode })
            .then((data) => {
              if (runId !== runIdRef.current) return;
              setDashboard(data);
            })
            .catch(() => {
              // Dashboard export remains optional after live run completes.
            });
        });

        source.addEventListener("error", (event) => {
          if (runId !== runIdRef.current) return;
          if (source.readyState === EventSource.CLOSED) return;
          const message =
            event instanceof MessageEvent && event.data
              ? String(event.data)
              : "Live simulation stream failed";
          setError(message);
          setStatus("error");
          setIsPlaying(false);
          source.close();
          eventSourceRef.current = null;
        });
      })
      .catch((err: unknown) => {
        if (runId !== runIdRef.current) return;
        const message = err instanceof Error ? err.message : "Failed to start simulation run";
        setError(message);
        setStatus("error");
      });

  }, [authorizationMode, scenario, seed, stopSimulation]);

  useEffect(() => {
    runSimulation();
    return () => {
      runIdRef.current += 1;
      stopSimulation();
    };
  }, [runSimulation, stopSimulation]);

  const currentFrame = useMemo(() => {
    if (!playback?.frames.length) return null;
    return frameAtTick(playback.frames, currentTick);
  }, [playback, currentTick]);

  const branchCurrentFrame = useMemo(() => {
    if (!branchPlayback?.frames.length) return null;
    return frameAtTick(branchPlayback.frames, currentTick);
  }, [branchPlayback, currentTick]);

  const compareBranchFrame = useMemo(() => {
    if (!compareBranch || !branchPlayback?.frames.length) return null;
    return frameAtTick(branchPlayback.frames, currentTick);
  }, [compareBranch, branchPlayback, currentTick]);

  const displayPlayback = replayView === "branch" ? branchPlayback ?? playback : playback;
  const displayRunIdentity =
    replayView === "branch" ? branchRunIdentity ?? runIdentity : runIdentity;
  const displayCurrentFrame =
    replayView === "branch" ? branchCurrentFrame ?? currentFrame : currentFrame;

  const coaLog = dashboard?.coa_log ?? [];
  const coasAtCurrentTick = useMemo(
    () =>
      rankCoas(
        displayCurrentFrame?.coa_recommendations ?? [],
        coaLog,
        currentTick,
      ),
    [displayCurrentFrame, coaLog, currentTick],
  );

  const activeCoa = useMemo(() => {
    if (displayCurrentFrame?.active_coa) return displayCurrentFrame.active_coa;
    return (
      coaLog.find((coa) => coa.status === "executing") ??
      coaLog.find((coa) => coa.status === "approved") ??
      null
    );
  }, [displayCurrentFrame, coaLog]);

  const entities = currentFrame?.entities ?? dashboard?.entities ?? [];
  const branchEntities = branchCurrentFrame?.entities ?? [];
  const displayEntities = displayCurrentFrame?.entities ?? entities;
  const relationships = dashboard?.relationships ?? [];

  const events = useMemo(() => {
    const dashboardEvents = dashboard?.events ?? [];
    const playbackEvents = playback?.frames.length
      ? eventsUpToTick(playback.frames, currentTick)
      : [];
    if (dashboardEvents.length === 0 && playbackEvents.length === 0) return [];
    return mergeEvents(dashboardEvents, playbackEvents, currentTick);
  }, [dashboard, playback, currentTick]);

  const timelineEvents = useMemo(() => {
    const dashboardEvents = dashboard?.events ?? [];
    const horizonTick = timelineHorizonTick(scenario, dashboard, playback, liveTick);
    const playbackEvents = playback?.frames.length
      ? eventsUpToTick(playback.frames, horizonTick)
      : [];
    if (dashboardEvents.length === 0 && playbackEvents.length === 0) return [];
    return mergeEventsUpToTick(dashboardEvents, playbackEvents, horizonTick);
  }, [dashboard, playback, liveTick, scenario]);

  useEffect(() => {
    timelineEventsRef.current = timelineEvents;
  }, [timelineEvents]);

  useEffect(() => {
    if (!isPlaying || !playback) return;

    const id = window.setInterval(() => {
      if (!isPlayingRef.current) return;

      const runStatus = statusRef.current;
      if (runStatus !== "live" && runStatus !== "ready") return;
      if (runStatus === "live" && timelineModeRef.current !== "follow") return;

      setCurrentTickState((prev) => {
        let from = prev;
        if (pendingScrubRef.current) {
          from = playheadAnchorRef.current;
          pendingScrubRef.current = false;
        }

        const target =
          runStatus === "live"
            ? liveTickRef.current
            : Math.max(playback.final_tick, liveTickRef.current);
        if (from >= target) return from;

        const next = from + 1;
        if (firstKeyEventAtTick(timelineEventsRef.current, next)) {
          window.queueMicrotask(() => {
            isPlayingRef.current = false;
            setIsPlaying(false);
            setTimelineMode("inspect");
          });
        }
        return next;
      });
    }, Math.max(16, 1000 / Math.max(1, playbackSpeedRef.current)));

    return () => window.clearInterval(id);
  }, [isPlaying, playback, playbackSpeed, setTimelineMode]);

  const approveCoa = useCallback(async (coa: CourseOfAction) => {
    const runId = activeRunIdRef.current;
    if (!runId) {
      throw new Error("No active simulation run");
    }
    await sendRunCommand(runId, {
      type: "approve_coa",
      coa_id: coa.id,
      action: coa.action,
      target: coa.target,
      scheduled_at_tick: coa.scheduled_at_tick,
      issued_at_tick: currentTick,
      authority: "human",
    });
    setApprovedCoaIds((prev) => (prev.includes(coa.id) ? prev : [...prev, coa.id]));
  }, [currentTick]);

  const rejectCoa = useCallback(async (coa: CourseOfAction, reason?: string) => {
    const runId = activeRunIdRef.current;
    if (!runId) {
      throw new Error("No active simulation run");
    }
    await sendRunCommand(runId, {
      type: "reject_coa",
      coa_id: coa.id,
      reason,
    });
  }, []);

  const continueReview = useCallback(async () => {
    const runId = activeRunIdRef.current;
    if (!runId) {
      throw new Error("No active simulation run");
    }
    await sendRunCommand(runId, { type: "continue_review" });
    clearReviewHold();
  }, [clearReviewHold]);

  const pollBranchRun = useCallback((branchRunId: string, branchKey: string) => {
    const poller = window.setInterval(() => {
      void fetchRunStatus(branchRunId)
        .then((status) => {
          setBranchResults((prev) =>
            prev.map((branch) =>
              branch.branch_run_id === branchRunId || branch.branch_id === branchKey
                ? {
                    ...branch,
                    branch_status: status.status,
                    branch_metrics: status.metrics ?? branch.branch_metrics,
                    replay_hash: status.replay_hash ?? branch.replay_hash,
                  }
                : branch,
            ),
          );
          if (status.status === "completed") {
            window.clearInterval(poller);
            branchPollersRef.current = branchPollersRef.current.filter((id) => id !== poller);
          }
        })
        .catch(() => {
          window.clearInterval(poller);
          branchPollersRef.current = branchPollersRef.current.filter((id) => id !== poller);
        });
    }, 1500);
    branchPollersRef.current.push(poller);
  }, []);

  const ensureBranchStream = useCallback((branch: BranchResult) => {
    const branchRunId = branch.branch_run_id;
    if (!branchRunId) return;
    if (branchStreamRunIdRef.current === branchRunId && branchStreamRef.current) return;

    stopBranchStream();
    branchStreamRunIdRef.current = branchRunId;

    let meta: Partial<PlaybackData> = {
      scenario_id: scenario,
      seed,
      authorization_mode: authorizationMode,
      max_ticks: 0,
      tick_seconds: 1,
      mission_cutoff: 0,
      final_tick: 0,
      frames: [],
    };

    const source = new EventSource(runStreamUrl(branchRunId));
    branchStreamRef.current = source;

    source.addEventListener("meta", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      meta = {
        ...meta,
        scenario_id: payload.scenario_id ?? scenario,
        seed: payload.seed ?? seed,
        authorization_mode: payload.authorization_mode ?? authorizationMode,
        max_ticks: payload.max_ticks ?? 0,
        mission_cutoff: payload.mission_cutoff ?? 0,
        tick_seconds: payload.tick_seconds ?? 1,
      };
      setBranchRunIdentity({
        run_id: branchRunId,
        branch_id: branch.branch_id,
        parent_run_id: branch.parent_run_id ?? baselineRunIdRef.current,
        seed: payload.seed ?? seed,
        scenario_id: payload.scenario_id ?? scenario,
        current_tick: 0,
        authorization_mode: payload.authorization_mode ?? authorizationMode,
        replay_hash: payload.replay_hash,
      });
    });

    source.addEventListener("tick", (event) => {
      const frame = JSON.parse((event as MessageEvent).data) as PlaybackFrame;
      branchFramesRef.current = [...branchFramesRef.current, frame];
      setBranchPlayback({
        ...(meta as PlaybackData),
        frames: branchFramesRef.current,
        final_tick: frame.tick,
      });
      setBranchRunIdentity((prev) =>
        prev
          ? {
              ...prev,
              current_tick: frame.tick,
              replay_hash: frame.replay_hash ?? prev.replay_hash,
              run_id: frame.run_id ?? prev.run_id,
              branch_id: frame.branch_id ?? prev.branch_id,
            }
          : prev,
      );
    });

    source.addEventListener("done", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      const finalTick = payload.final_tick ?? branchFramesRef.current.at(-1)?.tick ?? 0;
      setBranchPlayback({
        ...(meta as PlaybackData),
        frames: branchFramesRef.current,
        final_tick: finalTick,
      });
      source.close();
      if (branchStreamRef.current === source) {
        branchStreamRef.current = null;
      }
    });

    source.addEventListener("error", () => {
      if (source.readyState === EventSource.CLOSED) return;
      source.close();
      if (branchStreamRef.current === source) {
        branchStreamRef.current = null;
      }
    });
  }, [authorizationMode, scenario, seed, stopBranchStream]);

  const openBranchReplay = useCallback(
    (branch: BranchResult) => {
      if (!branch.branch_run_id) return;
      ensureBranchStream(branch);
      setActiveBranch(branch);
      setCompareBranch(null);
      setReplayView("branch");
      activeRunIdRef.current = branch.branch_run_id;
      setIsPlaying(false);
    },
    [ensureBranchStream],
  );

  const returnToBaseline = useCallback(() => {
    setReplayView("baseline");
    setActiveBranch(null);
    setCompareBranch(null);
    activeRunIdRef.current = baselineRunIdRef.current;
  }, []);

  const startBranchCompare = useCallback(
    (branch: BranchResult) => {
      if (!branch.branch_run_id) return;
      ensureBranchStream(branch);
      setCompareBranch(branch);
      setActiveBranch(null);
      setReplayView("compare");
      activeRunIdRef.current = baselineRunIdRef.current;
    },
    [ensureBranchStream],
  );

  const stopBranchCompare = useCallback(() => {
    setReplayView("baseline");
    setCompareBranch(null);
    activeRunIdRef.current = baselineRunIdRef.current;
  }, []);

  const simulateWhatIf = useCallback(async (coa: CourseOfAction, fromTick?: number) => {
    const runId = activeRunIdRef.current;
    if (!runId) {
      throw new Error("No active simulation run");
    }
    const branchTick = fromTick ?? currentTick;
    const branch = await createBranch(runId, {
      from_tick: branchTick,
      intervention: {
        action: coa.action,
        target: coa.target,
        scheduled_at_tick: coa.scheduled_at_tick,
      },
    });
    setBranchResults((prev) => [
      ...prev,
      {
        ...branch,
        from_tick: branchTick,
        coa_id: coa.id,
        action: coa.action,
        target: coa.target,
        scheduled_at_tick: coa.scheduled_at_tick,
        branch_run_id: branch.branch_run_id,
        branch_status: branch.branch_status ?? "starting",
      },
    ]);
    if (branch.branch_run_id) {
      pollBranchRun(branch.branch_run_id, branch.branch_id);
    }
  }, [currentTick, pollBranchRun]);

  const value = useMemo<SimulationContextValue>(
    () => ({
      scenario,
      seed,
      authorizationMode,
      runIdentity,
      branchResults,
      commandAcks,
      status,
      error,
      dashboard,
      playback,
      branchPlayback,
      playbackRefinement,
      currentTick,
      liveTick,
      timelineMode,
      reviewHold,
      isPlaying,
      playbackSpeed,
      liveMode,
      replayView,
      compareBranch,
      activeBranch,
      currentFrame,
      branchCurrentFrame,
      compareBranchFrame,
      displayPlayback,
      displayRunIdentity,
      displayCurrentFrame,
      coasAtCurrentTick,
      activeCoa,
      entities,
      branchEntities,
      displayEntities,
      relationships,
      events,
      timelineEvents,
      approvedCoaIds,
      setScenario,
      setSeed,
      setAuthorizationMode,
      setCurrentTick,
      setViewTick,
      setTimelineMode,
      followLive,
      clearReviewHold,
      setIsPlaying,
      setPlaybackSpeed,
      runSimulation,
      stopSimulation,
      approveCoa,
      rejectCoa,
      continueReview,
      simulateWhatIf,
      openBranchReplay,
      returnToBaseline,
      startBranchCompare,
      stopBranchCompare,
    }),
    [
      scenario,
      seed,
      authorizationMode,
      runIdentity,
      branchResults,
      commandAcks,
      status,
      error,
      dashboard,
      playback,
      branchPlayback,
      playbackRefinement,
      currentTick,
      liveTick,
      timelineMode,
      reviewHold,
      isPlaying,
      playbackSpeed,
      liveMode,
      replayView,
      compareBranch,
      activeBranch,
      currentFrame,
      branchCurrentFrame,
      compareBranchFrame,
      displayPlayback,
      displayRunIdentity,
      displayCurrentFrame,
      coasAtCurrentTick,
      activeCoa,
      entities,
      branchEntities,
      displayEntities,
      relationships,
      events,
      timelineEvents,
      approvedCoaIds,
      setCurrentTick,
      setViewTick,
      setTimelineMode,
      followLive,
      clearReviewHold,
      runSimulation,
      stopSimulation,
      approveCoa,
      rejectCoa,
      continueReview,
      simulateWhatIf,
      openBranchReplay,
      returnToBaseline,
      startBranchCompare,
      stopBranchCompare,
    ],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error("useSimulation must be used within SimulationProvider");
  }
  return ctx;
}

export function useCoaApprovalKey(coa: CourseOfAction): string {
  return coaApprovalKey(coa);
}
