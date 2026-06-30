#include "darla/reasoning/EvidencePackage.hpp"

#include <iomanip>
#include <sstream>

namespace darla::reasoning {
namespace {

std::string esc(const std::string& input) {
    std::ostringstream out;
    for (const char c : input) {
        switch (c) {
            case '"': out << "\\\""; break;
            case '\\': out << "\\\\"; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default: out << c; break;
        }
    }
    return out.str();
}

void write_string_array(std::ostringstream& out, const std::vector<std::string>& values) {
    out << "[";
    for (std::size_t i = 0; i < values.size(); ++i) {
        if (i) out << ",";
        out << "\"" << esc(values[i]) << "\"";
    }
    out << "]";
}

} // namespace

std::string to_string(ConfidenceBand band) {
    switch (band) {
        case ConfidenceBand::High: return "high";
        case ConfidenceBand::Medium: return "medium";
        case ConfidenceBand::Low: return "low";
    }
    return "low";
}

ConfidenceBand confidence_band_from_score(double score) {
    if (score >= 0.75) return ConfidenceBand::High;
    if (score >= 0.45) return ConfidenceBand::Medium;
    return ConfidenceBand::Low;
}

std::string to_json(const EvidencePackage& p) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(4);
    out << "{";
    out << "\"mission_id\":\"" << esc(p.mission_id) << "\",";
    out << "\"tick\":" << p.tick << ",";

    out << "\"observations\":";
    write_string_array(out, p.observations);
    out << ",";

    out << "\"causal_assumptions\":[";
    for (std::size_t i = 0; i < p.causal_assumptions.size(); ++i) {
        const auto& a = p.causal_assumptions[i];
        if (i) out << ",";
        out << "{"
            << "\"source\":\"" << esc(a.source) << "\","
            << "\"target\":\"" << esc(a.target) << "\","
            << "\"relation\":\"" << esc(a.relation) << "\","
            << "\"confidence\":" << a.confidence
            << "}";
    }
    out << "],";

    out << "\"candidate_actions\":[";
    for (std::size_t i = 0; i < p.candidate_actions.size(); ++i) {
        const auto& a = p.candidate_actions[i];
        if (i) out << ",";
        out << "{"
            << "\"id\":\"" << esc(a.id) << "\","
            << "\"label\":\"" << esc(a.label) << "\","
            << "\"expected_gain\":" << a.expected_gain << ","
            << "\"risk\":" << a.risk << ","
            << "\"authority_required\":" << (a.authority_required ? "true" : "false")
            << "}";
    }
    out << "],";

    out << "\"counterfactual_results\":[";
    for (std::size_t i = 0; i < p.counterfactual_results.size(); ++i) {
        const auto& c = p.counterfactual_results[i];
        if (i) out << ",";
        out << "{"
            << "\"action_id\":\"" << esc(c.action_id) << "\","
            << "\"baseline_outcome\":\"" << esc(c.baseline_outcome) << "\","
            << "\"intervention_outcome\":\"" << esc(c.intervention_outcome) << "\","
            << "\"effect_delta\":" << c.effect_delta << ","
            << "\"supports_action\":" << (c.supports_action ? "true" : "false")
            << "}";
    }
    out << "],";

    out << "\"selected_coa\":\"" << esc(p.selected_coa) << "\",";
    out << "\"confidence_score\":" << p.confidence_score << ",";
    out << "\"confidence_band\":\"" << to_string(p.confidence_band) << "\",";
    out << "\"caveats\":";
    write_string_array(out, p.caveats);
    out << ",";
    out << "\"replay_hash\":" << p.replay_hash;
    out << "}";
    return out.str();
}

} // namespace darla::reasoning
