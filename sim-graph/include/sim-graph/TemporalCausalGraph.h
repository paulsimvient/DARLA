#pragma once

#include "Types.h"
#include "sim-events/SimEvent.h"

#include <string>
#include <vector>

namespace darla {

enum class CausalEdgeType {
    Enables,
    Degrades,
    Delays,
    Suppresses,
    Confounds,
    Observes,
    Commands,
    DependsOn,
    CausesMissionEffect
};

struct TemporalCausalEdge {
    NodeId source = 0;
    NodeId target = 0;
    CausalEdgeType type = CausalEdgeType::Enables;
    double strength = 0.0;
    double confidence = 0.0;
    Tick valid_from = 0;
    Tick valid_to = 0;
    bool stale = false;
    bool deception_suspected = false;
    std::string label;
};

class TemporalCausalGraph {
public:
    void addEdge(const SimEvent& source, const SimEvent& target, CausalEdgeType type, double strength, double confidence, const std::string& label);
    const std::vector<TemporalCausalEdge>& edges() const { return edges_; }
    std::vector<std::string> dominantPathLabels() const;

private:
    std::vector<TemporalCausalEdge> edges_;
};

std::string toString(CausalEdgeType type);

} // namespace darla
