#pragma once

#include "WorldState.h"
#include "sim-causal/CausalClaim.h"

#include <map>
#include <set>
#include <string>
#include <utility>
#include <vector>

namespace darla {

// Result of running do-calculus identification for a single estimand cause -> effect.
struct IdentificationResult {
    ClaimStatus status = ClaimStatus::NotIdentifiable;
    bool point_identifiable = false;            // true if a valid backdoor adjustment set exists
    std::vector<std::string> adjustment_set;    // admissible backdoor set (empty == no adjustment needed)
    std::vector<std::string> latent_confounders; // unobserved confounders that block point identification
    std::vector<std::string> open_backdoor_paths;
    std::string estimand;                        // e.g. "E[effect | do(cause=hi)] - E[effect | do(cause=lo)]"
    std::string rationale;
};

// Encodes the structural DAG (from planted causal truth + optional latent confounders)
// and answers identification queries via d-separation and the back-door criterion.
class CausalIdentifier {
public:
    explicit CausalIdentifier(
        const std::vector<PlantedCausalEdge>& planted,
        const std::vector<std::pair<std::string, std::string>>& latent_confounders = {});

    IdentificationResult identify(const std::string& cause_variable, const std::string& effect_variable) const;

    // Map a claim/planted variable token to its canonical structural-graph node id.
    static std::string canonical(const std::string& token);

    const std::set<std::string>& nodes() const { return nodes_; }

private:
    std::set<std::string> nodes_;
    std::map<std::string, std::set<std::string>> children_;
    std::map<std::string, std::set<std::string>> parents_;
    std::set<std::pair<std::string, std::string>> latent_; // canonicalized unordered pairs

    void addEdge(const std::string& from, const std::string& to);
    std::set<std::string> neighbors(const std::string& node) const;
    bool hasDirectedPath(const std::string& from, const std::string& to) const;
    std::set<std::string> descendants(const std::string& node) const;
    void enumerateSimplePaths(
        const std::string& current,
        const std::string& target,
        std::set<std::string>& visited,
        std::vector<std::string>& path,
        std::vector<std::vector<std::string>>& out) const;
    bool isCollider(const std::string& prev, const std::string& mid, const std::string& next) const;
    bool pathActive(const std::vector<std::string>& path, const std::set<std::string>& z) const;
    bool isBackdoorPath(const std::vector<std::string>& path) const;
    bool backdoorCriterion(
        const std::string& cause,
        const std::string& effect,
        const std::set<std::string>& z,
        std::vector<std::string>* open_paths) const;
    bool latentBetween(const std::string& a, const std::string& b) const;
    static bool isActionNode(const std::string& node);
};

} // namespace darla
