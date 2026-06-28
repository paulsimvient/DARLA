#include "sim-causal/Identification.h"

#include <algorithm>

namespace darla {
namespace {

std::pair<std::string, std::string> orderedPair(const std::string& a, const std::string& b) {
    return a < b ? std::make_pair(a, b) : std::make_pair(b, a);
}

} // namespace

std::string CausalIdentifier::canonical(const std::string& token) {
    if (token == "blue_uas_1.sensor.confidence" ||
        token == "blue_uas_1.sensor_confidence_loss" ||
        token == "sensor_confidence_loss") {
        return "blue_uas_1.sensor_confidence_loss";
    }
    if (token == "detection_time" ||
        token == "delayed_target_detection" ||
        token == "delayed_detection") {
        return "delayed_target_detection";
    }
    if (token == "mission_success_score" ||
        token == "mission_failure_probability" ||
        token == "mission_failure" ||
        token == "mission_recovery") {
        return "mission_failure_probability";
    }
    return token;
}

bool CausalIdentifier::isActionNode(const std::string& node) {
    return node.find("degrade") != std::string::npos ||
           node.find(".do_") != std::string::npos ||
           node.find("intervention") != std::string::npos;
}

CausalIdentifier::CausalIdentifier(
    const std::vector<PlantedCausalEdge>& planted,
    const std::vector<std::pair<std::string, std::string>>& latent_confounders) {
    for (const auto& edge : planted) {
        addEdge(canonical(edge.cause), canonical(edge.effect));
    }
    for (const auto& pair : latent_confounders) {
        const auto a = canonical(pair.first);
        const auto b = canonical(pair.second);
        nodes_.insert(a);
        nodes_.insert(b);
        latent_.insert(orderedPair(a, b));
    }
}

void CausalIdentifier::addEdge(const std::string& from, const std::string& to) {
    nodes_.insert(from);
    nodes_.insert(to);
    children_[from].insert(to);
    parents_[to].insert(from);
}

std::set<std::string> CausalIdentifier::neighbors(const std::string& node) const {
    std::set<std::string> result;
    const auto c = children_.find(node);
    if (c != children_.end()) result.insert(c->second.begin(), c->second.end());
    const auto p = parents_.find(node);
    if (p != parents_.end()) result.insert(p->second.begin(), p->second.end());
    return result;
}

bool CausalIdentifier::hasDirectedPath(const std::string& from, const std::string& to) const {
    if (from == to) return true;
    std::set<std::string> visited{from};
    std::vector<std::string> stack{from};
    while (!stack.empty()) {
        const auto node = stack.back();
        stack.pop_back();
        const auto it = children_.find(node);
        if (it == children_.end()) continue;
        for (const auto& child : it->second) {
            if (child == to) return true;
            if (visited.insert(child).second) stack.push_back(child);
        }
    }
    return false;
}

std::set<std::string> CausalIdentifier::descendants(const std::string& node) const {
    std::set<std::string> result;
    std::vector<std::string> stack{node};
    while (!stack.empty()) {
        const auto current = stack.back();
        stack.pop_back();
        const auto it = children_.find(current);
        if (it == children_.end()) continue;
        for (const auto& child : it->second) {
            if (result.insert(child).second) stack.push_back(child);
        }
    }
    return result;
}

void CausalIdentifier::enumerateSimplePaths(
    const std::string& current,
    const std::string& target,
    std::set<std::string>& visited,
    std::vector<std::string>& path,
    std::vector<std::vector<std::string>>& out) const {
    if (current == target) {
        out.push_back(path);
        return;
    }
    for (const auto& next : neighbors(current)) {
        if (visited.count(next)) continue;
        visited.insert(next);
        path.push_back(next);
        enumerateSimplePaths(next, target, visited, path, out);
        path.pop_back();
        visited.erase(next);
    }
}

bool CausalIdentifier::isCollider(const std::string& prev, const std::string& mid, const std::string& next) const {
    const auto prev_children = children_.find(prev);
    const auto next_children = children_.find(next);
    const bool prev_into_mid = prev_children != children_.end() && prev_children->second.count(mid);
    const bool next_into_mid = next_children != children_.end() && next_children->second.count(mid);
    return prev_into_mid && next_into_mid;
}

bool CausalIdentifier::pathActive(const std::vector<std::string>& path, const std::set<std::string>& z) const {
    // A path is active (d-connected) given Z if every interior node is "open".
    for (std::size_t i = 1; i + 1 < path.size(); ++i) {
        const auto& prev = path[i - 1];
        const auto& mid = path[i];
        const auto& next = path[i + 1];
        if (isCollider(prev, mid, next)) {
            // Collider opens only if it (or a descendant) is in Z.
            bool conditioned = z.count(mid) > 0;
            if (!conditioned) {
                for (const auto& d : descendants(mid)) {
                    if (z.count(d)) { conditioned = true; break; }
                }
            }
            if (!conditioned) return false; // blocked
        } else {
            // Chain / fork: blocked iff the middle is conditioned on.
            if (z.count(mid)) return false;
        }
    }
    return true;
}

bool CausalIdentifier::isBackdoorPath(const std::vector<std::string>& path) const {
    if (path.size() < 2) return false;
    // Back-door path: the edge incident to the cause points INTO the cause,
    // i.e. path[1] -> path[0].
    const auto it = children_.find(path[1]);
    return it != children_.end() && it->second.count(path[0]) > 0;
}

bool CausalIdentifier::backdoorCriterion(
    const std::string& cause,
    const std::string& effect,
    const std::set<std::string>& z,
    std::vector<std::string>* open_paths) const {
    // Z must not contain any descendant of the cause.
    const auto cause_descendants = descendants(cause);
    for (const auto& node : z) {
        if (cause_descendants.count(node)) return false;
    }

    std::set<std::string> visited{cause};
    std::vector<std::string> path{cause};
    std::vector<std::vector<std::string>> paths;
    enumerateSimplePaths(cause, effect, visited, path, paths);

    bool satisfied = true;
    for (const auto& candidate : paths) {
        if (!isBackdoorPath(candidate)) continue;
        if (pathActive(candidate, z)) {
            satisfied = false;
            if (open_paths) {
                std::string rendered;
                for (std::size_t i = 0; i < candidate.size(); ++i) {
                    if (i > 0) rendered += " - ";
                    rendered += candidate[i];
                }
                open_paths->push_back(rendered);
            }
        }
    }
    return satisfied;
}

bool CausalIdentifier::latentBetween(const std::string& a, const std::string& b) const {
    return latent_.count(orderedPair(a, b)) > 0;
}

IdentificationResult CausalIdentifier::identify(
    const std::string& cause_variable,
    const std::string& effect_variable) const {
    const auto cause = canonical(cause_variable);
    const auto effect = canonical(effect_variable);

    IdentificationResult result;
    result.estimand = "E[" + effect + " | do(" + cause + "=high)] - E[" + effect + " | do(" + cause + "=low)]";

    if (cause == effect) {
        result.status = ClaimStatus::NotIdentifiable;
        result.rationale = "cause and effect resolve to the same structural variable";
        return result;
    }

    const bool directed_edge = children_.count(cause) && children_.at(cause).count(effect);
    const bool directed_path = hasDirectedPath(cause, effect);

    if (!directed_path) {
        result.status = ClaimStatus::Confounded;
        result.rationale =
            "no directed path from cause to effect in the structural DAG; the observed "
            "association is confounded / non-causal and no causal effect is identifiable";
        return result;
    }

    // Search for a minimal admissible back-door adjustment set among non-descendant nodes.
    const auto cause_descendants = descendants(cause);
    std::vector<std::string> candidates;
    for (const auto& node : nodes_) {
        if (node == cause || node == effect) continue;
        if (cause_descendants.count(node)) continue;
        candidates.push_back(node);
    }

    bool found_set = false;
    std::vector<std::string> admissible;
    std::vector<std::string> open_paths;
    const std::size_t max_subsets = static_cast<std::size_t>(1) << candidates.size();
    for (std::size_t mask = 0; mask < max_subsets && !found_set; ++mask) {
        std::set<std::string> z;
        for (std::size_t i = 0; i < candidates.size(); ++i) {
            if (mask & (static_cast<std::size_t>(1) << i)) z.insert(candidates[i]);
        }
        std::vector<std::string> probe_paths;
        if (backdoorCriterion(cause, effect, z, &probe_paths)) {
            found_set = true;
            admissible.assign(z.begin(), z.end());
        }
    }
    if (!found_set) {
        // Record the open back-door paths under the empty conditioning set for diagnostics.
        backdoorCriterion(cause, effect, {}, &open_paths);
    }

    const bool latent = latentBetween(cause, effect);
    result.adjustment_set = admissible;
    result.open_backdoor_paths = open_paths;

    if (latent) {
        result.status = ClaimStatus::WeaklyIdentifiable;
        result.point_identifiable = false;
        result.latent_confounders.push_back("unobserved common cause of " + cause + " and " + effect);
        result.rationale =
            "directed effect exists but an unobserved confounder opens a back-door path that "
            "cannot be closed; only partial (bounded) identification is possible";
        return result;
    }

    if (found_set) {
        result.point_identifiable = true;
        if (directed_edge && isActionNode(cause)) {
            result.status = ClaimStatus::DirectlyAdjudicated;
            result.rationale =
                "cause is a directly manipulated do()-variable with a directly observed structural "
                "edge and no open back-door path; effect is directly adjudicated";
        } else {
            result.status = ClaimStatus::Identifiable;
            result.rationale = admissible.empty()
                ? "no open back-door path; causal effect is identifiable with the empty adjustment set"
                : "causal effect is identifiable by back-door adjustment on the listed set";
        }
        return result;
    }

    result.status = ClaimStatus::NotIdentifiable;
    result.point_identifiable = false;
    result.rationale = "open back-door paths remain with no admissible adjustment set among observed variables";
    return result;
}

} // namespace darla
