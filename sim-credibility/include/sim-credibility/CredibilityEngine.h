#pragma once

#include "sim-causal/CausalClaim.h"
#include "Snapshot.h"
#include "sim-events/EventLedger.h"

#include <filesystem>
#include <memory>
#include <string>
#include <vector>

namespace darla {

struct CredibilityContract {
    std::string model_name;
    std::string intended_use;
    std::vector<std::string> valid_conditions;
    std::vector<std::string> invalid_conditions;
    double verification_score = 0.0;
    double validation_score = 0.0;
    double uncertainty_score = 0.0;
    double calibration_error = 0.0;
    std::vector<std::string> assumptions;
    std::vector<std::string> required_inputs;
    std::vector<std::string> known_failure_modes;
};

struct ModelRisk {
    std::string model_name;
    double decision_influence = 0.0;
    double consequence_of_error = 0.0;
    std::string required_rigor;

    double score() const { return decision_influence * consequence_of_error; }
};

struct FalsificationResult {
    std::string claim_label;
    std::vector<std::string> tests_run;
    std::vector<std::string> branch_outcomes;
    bool survived = false;
    bool overturned = false;
    std::string summary;
};

struct CredibilityAssessment {
    CausalClaim claim;
    CredibilityContract contract;
    ModelRisk risk;
    FalsificationResult falsification;
    double credibility_score = 0.0;
    bool reportable = false;
    std::string validity;
};

class CredibilityContractLoader;

class CredibilityEngine {
public:
    explicit CredibilityEngine(const std::filesystem::path& models_dir = {});
    ~CredibilityEngine();

    std::vector<CredibilityAssessment> assessClaims(const std::vector<CausalClaim>& claims, const EventLedger& ledger) const;
    std::vector<CredibilityAssessment> assessClaims(
        const std::vector<CausalClaim>& claims,
        const EventLedger& ledger,
        const Snapshot& snapshot,
        const MissionMetrics& baseline,
        Tick horizon_ticks) const;
    CredibilityAssessment assessClaim(const CausalClaim& claim, const EventLedger& ledger) const;
    CredibilityAssessment assessClaim(
        const CausalClaim& claim,
        const EventLedger& ledger,
        const Snapshot& snapshot,
        const MissionMetrics& baseline,
        Tick horizon_ticks) const;

private:
    std::unique_ptr<CredibilityContractLoader> contract_loader_;
    CredibilityContract contractForClaim(const CausalClaim& claim) const;
    ModelRisk riskForClaim(const CausalClaim& claim) const;
    FalsificationResult falsifyClaim(const CausalClaim& claim, const EventLedger& ledger) const;
    FalsificationResult falsifyClaimExecutable(
        const CausalClaim& claim,
        const EventLedger& ledger,
        const Snapshot& snapshot,
        const MissionMetrics& baseline,
        Tick horizon_ticks) const;
};

std::string rigorForRisk(double risk_score);

} // namespace darla
