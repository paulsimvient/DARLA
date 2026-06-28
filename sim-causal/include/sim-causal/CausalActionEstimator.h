#pragma once

#include "AgentAction.h"
#include "DecisionHorizon.h"
#include "sim-causal/InterventionEngine.h"

#include <map>
#include <optional>
#include <tuple>

namespace darla {

class CausalActionEstimator : public ActionEffectEstimator {
public:
    ActionEffectEstimate estimate(
        const Snapshot& snapshot,
        const MissionMetrics& baseline,
        ActionType action,
        EntityId actor,
        const std::vector<EntityId>& targets,
        Tick at_tick,
        Tick horizon_ticks) const override;

    ActionEffectEstimate estimateActionEffect(
        WorldState& world,
        EventLedger& ledger,
        const Snapshot& snapshot,
        const MissionMetrics& baseline,
        ActionType action,
        EntityId actor,
        const std::vector<EntityId>& targets,
        DecisionHorizon horizon) const;

    MissionMetrics projectBaseline(const Snapshot& snapshot, Tick horizon_ticks) const override;

    void clearBranchCache() { branch_cache_.clear(); }
    std::size_t branchCacheSize() const { return branch_cache_.size(); }

    void setBranchCacheEntry(
        ActionType action,
        EntityId actor,
        Tick at_tick,
        Tick horizon_ticks,
        ActionEffectEstimate estimate) const;

private:
    struct BranchCacheKey {
        ActionType action = ActionType::HoldCurrentCOA;
        EntityId actor = 0;
        Tick at_tick = 0;
        Tick horizon_ticks = 0;

        bool operator<(const BranchCacheKey& other) const {
            return std::tie(action, actor, at_tick, horizon_ticks) <
                std::tie(other.action, other.actor, other.at_tick, other.horizon_ticks);
        }
    };

    ActionEffectEstimate estimateInternal(
        const Snapshot& snapshot,
        const MissionMetrics& baseline,
        ActionType action,
        EntityId actor,
        const std::vector<EntityId>& targets,
        Tick at_tick,
        Tick horizon_ticks) const;

    InterventionEngine engine_;
    mutable std::map<BranchCacheKey, ActionEffectEstimate> branch_cache_;
};

} // namespace darla
