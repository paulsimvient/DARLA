import type { AuthorityStatus, CourseOfAction } from "./types";

interface CoaPanelProps {
  recommendations: CourseOfAction[];
  activeCoa: CourseOfAction | null;
  authorityStatus: AuthorityStatus | null;
  currentTick: number;
  authorizationMode: string;
  onApprove: (coa: CourseOfAction) => void;
  onReject: (coa: CourseOfAction) => void;
  onModeChange: (mode: string) => void;
}

function statusClass(status: string) {
  return status.replace(/_/g, "-");
}

export default function CoaPanel({
  recommendations,
  activeCoa,
  authorityStatus,
  currentTick,
  authorizationMode,
  onApprove,
  onReject,
  onModeChange,
}: CoaPanelProps) {
  return (
    <div className="panel coa-panel">
      <div className="coa-panel-header">
        <h2>Continuous COA Feed</h2>
        <label className="coa-mode-select">
          <input
            type="checkbox"
            checked={authorizationMode === "human_hold"}
            onChange={(e) => onModeChange(e.target.checked ? "human_hold" : "policy_auto")}
          />
          Human hold
        </label>
      </div>

      {authorityStatus ? (
        <div className="authority-banner">
          <span>{authorityStatus.mode}</span>
          <span>{authorityStatus.pending_recommendations} pending</span>
          {authorityStatus.primary_decision_recorded ? (
            <span className="good">decision recorded</span>
          ) : (
            <span className="warn">awaiting authorization</span>
          )}
        </div>
      ) : null}

      {activeCoa ? (
        <div className="coa-active-card">
          <div className="coa-card-header">
            <span className="coa-action">{activeCoa.action}</span>
            <span className={`status-pill ${statusClass(activeCoa.status)}`}>{activeCoa.status}</span>
          </div>
          <div className="coa-meta">
            Active COA #{activeCoa.id} · scheduled T+{activeCoa.scheduled_at_tick} · proposed T+
            {activeCoa.proposed_tick}
          </div>
        </div>
      ) : null}

      <div className="coa-feed">
        {recommendations.length === 0 ? (
          <div className="coa-empty">No ranked COAs at T+{currentTick}</div>
        ) : (
          recommendations.map((coa) => (
            <div
              key={coa.id}
              className={`coa-card${coa.proposed_tick === currentTick ? " coa-card-current" : ""}`}
            >
              <div className="coa-card-header">
                <span className="coa-action">{coa.action}</span>
                <span className={`status-pill ${statusClass(coa.status)}`}>{coa.status}</span>
              </div>
              <div className="coa-scores">
                <span>score {coa.score.toFixed(3)}</span>
                <span>gain {coa.expected_mission_gain.toFixed(3)}</span>
                <span>conf {coa.causal_confidence.toFixed(3)}</span>
                <span>risk {coa.risk.toFixed(3)}</span>
              </div>
              <div className="coa-meta">
                #{coa.id} · T+{coa.proposed_tick} → execute T+{coa.scheduled_at_tick}
              </div>
              <div className="coa-rationale">{coa.rationale}</div>
              {coa.status === "recommended" || coa.status === "proposed" ? (
                <div className="coa-actions">
                  <button type="button" onClick={() => onApprove(coa)}>
                    Approve
                  </button>
                  <button type="button" className="secondary" onClick={() => onReject(coa)}>
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
