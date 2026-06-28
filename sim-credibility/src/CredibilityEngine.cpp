#include "sim-credibility/CredibilityEngine.h"
#include "sim-credibility/CredibilityContractLoader.h"

#include "sim-causal/InterventionEngine.h"

#include <algorithm>

namespace darla {
namespace {

bool hasEvidence(const EventLedger& ledger, const CausalClaim& claim) {
    return std::all_of(claim.evidence.begin(), claim.evidence.end(), [&ledger](EventId id) {
        return ledger.find(id) != nullptr;
    });
}

bool isRejectedCorrelation(const CausalClaim& claim) {
    return claim.status == ClaimStatus::Confounded || claim.status == ClaimStatus::Falsified;
}

} // namespace

CredibilityEngine::CredibilityEngine(const std::filesystem::path& models_dir) {
    if (!models_dir.empty() && std::filesystem::exists(models_dir)) {
        contract_loader_ = std::make_unique<CredibilityContractLoader>(models_dir);
    }
}

CredibilityEngine::~CredibilityEngine() = default;

std::string rigorForRisk(double risk_score) {
    if (risk_score >= 0.60) return "SME validation + counterfactual tests";
    if (risk_score >= 0.36) return "calibration + regression tests";
    return "basic verification";
}

std::vector<CredibilityAssessment> CredibilityEngine::assessClaims(const std::vector<CausalClaim>& claims, const EventLedger& ledger) const {
    std::vector<CredibilityAssessment> assessments;
    assessments.reserve(claims.size());
    for (const auto& claim : claims) {
        assessments.push_back(assessClaim(claim, ledger));
    }
    return assessments;
}

std::vector<CredibilityAssessment> CredibilityEngine::assessClaims(
    const std::vector<CausalClaim>& claims,
    const EventLedger& ledger,
    const Snapshot& snapshot,
    const MissionMetrics& baseline,
    Tick horizon_ticks) const {
    std::vector<CredibilityAssessment> assessments;
    assessments.reserve(claims.size());
    for (const auto& claim : claims) {
        assessments.push_back(assessClaim(claim, ledger, snapshot, baseline, horizon_ticks));
    }
    return assessments;
}

CredibilityAssessment CredibilityEngine::assessClaim(const CausalClaim& claim, const EventLedger& ledger) const {
    CredibilityAssessment assessment;
    assessment.claim = claim;
    assessment.contract = contractForClaim(claim);
    assessment.risk = riskForClaim(claim);
    assessment.falsification = falsifyClaim(claim, ledger);

    const bool evidence_ok = !claim.evidence.empty() && hasEvidence(ledger, claim);
    const double evidence_score = evidence_ok ? 0.25 : 0.0;
    const double confidence_score = 0.35 * claim.confidence;
    const double contract_score = 0.20 * ((assessment.contract.verification_score + assessment.contract.validation_score) / 2.0);
    const double falsification_score = assessment.falsification.survived ? 0.20 : 0.0;
    assessment.credibility_score = evidence_score + confidence_score + contract_score + falsification_score;

    if (isRejectedCorrelation(claim)) {
        assessment.reportable = true;
        assessment.validity = "rejected as causal under maritime ISR cyber/comms scenario";
    } else {
        assessment.reportable = evidence_ok && assessment.falsification.survived && assessment.credibility_score >= 0.65;
        assessment.validity = "maritime ISR cyber/comms scenario only";
    }
    return assessment;
}

CredibilityAssessment CredibilityEngine::assessClaim(
    const CausalClaim& claim,
    const EventLedger& ledger,
    const Snapshot& snapshot,
    const MissionMetrics& baseline,
    Tick horizon_ticks) const {
    CredibilityAssessment assessment;
    assessment.claim = claim;
    assessment.contract = contractForClaim(claim);
    assessment.risk = riskForClaim(claim);
    assessment.falsification = falsifyClaimExecutable(claim, ledger, snapshot, baseline, horizon_ticks);

    const bool evidence_ok = !claim.evidence.empty() && hasEvidence(ledger, claim);
    const double evidence_score = evidence_ok ? 0.25 : 0.0;
    const double confidence_score = 0.35 * claim.confidence;
    const double contract_score = 0.20 * ((assessment.contract.verification_score + assessment.contract.validation_score) / 2.0);
    const double falsification_score = assessment.falsification.survived ? 0.20 : 0.0;
    assessment.credibility_score = evidence_score + confidence_score + contract_score + falsification_score;

    if (isRejectedCorrelation(claim)) {
        assessment.reportable = true;
        assessment.validity = "rejected as causal under executable falsification branches";
    } else {
        assessment.reportable = evidence_ok && assessment.falsification.survived && assessment.credibility_score >= 0.65;
        assessment.validity = "maritime ISR cyber/comms scenario only";
    }
    return assessment;
}

CredibilityContract CredibilityEngine::contractForClaim(const CausalClaim& claim) const {
    if (contract_loader_) {
        return contract_loader_->contractForClaim(claim);
    }

    CredibilityContract contract;
    contract.intended_use = "causal explanation over deterministic UAS maritime ISR micro-world";
    contract.valid_conditions = {"maritime ISR", "modeled RF/cyber degradation", "constructive deterministic agents"};
    contract.invalid_conditions = {"dense urban terrain", "unmodeled space ISR", "live LVC federation truth arbitration"};
    contract.assumptions = {"scripted cyber degradation timing", "rule-based commander policy", "single maritime target"};
    contract.required_inputs = {"event ledger", "causal parent event IDs", "counterfactual branch result"};

    if (claim.cause_variable.find("sensor") != std::string::npos ||
        claim.effect_variable.find("sensor") != std::string::npos ||
        claim.label.find("sensor_confidence") != std::string::npos) {
        contract.model_name = "UAS sensor confidence model";
        contract.verification_score = 0.86;
        contract.validation_score = 0.78;
        contract.uncertainty_score = 0.17;
        contract.calibration_error = 0.09;
        contract.known_failure_modes = {"adversary spoofing not represented", "weather not represented"};
    } else if (claim.cause_variable.find("logistics") != std::string::npos) {
        contract.model_name = "logistics correlation model";
        contract.verification_score = 0.74;
        contract.validation_score = 0.65;
        contract.uncertainty_score = 0.30;
        contract.calibration_error = 0.16;
        contract.known_failure_modes = {"real logistics causality not modeled"};
    } else if (claim.effect_variable.find("mission_success_score") != std::string::npos ||
               claim.label.find("mission_failure") != std::string::npos) {
        contract.model_name = "mission effects model";
        contract.verification_score = 0.79;
        contract.validation_score = 0.68;
        contract.uncertainty_score = 0.28;
        contract.calibration_error = 0.14;
        contract.known_failure_modes = {"commander doctrine simplified", "engagement authority simplified"};
    } else {
        contract.model_name = "causal claim discipline model";
        contract.verification_score = 0.82;
        contract.validation_score = 0.72;
        contract.uncertainty_score = 0.24;
        contract.calibration_error = 0.12;
        contract.known_failure_modes = {"alternate causal structure not represented"};
    }
    return contract;
}

ModelRisk CredibilityEngine::riskForClaim(const CausalClaim& claim) const {
    ModelRisk risk;
    risk.model_name = contractForClaim(claim).model_name;
    if (claim.status == ClaimStatus::DirectlyAdjudicated) {
        risk.decision_influence = 0.55;
        risk.consequence_of_error = 0.55;
    } else if (claim.status == ClaimStatus::Identifiable) {
        risk.decision_influence = 0.82;
        risk.consequence_of_error = 0.78;
    } else if (claim.status == ClaimStatus::WeaklyIdentifiable) {
        risk.decision_influence = 0.72;
        risk.consequence_of_error = 0.84;
    } else {
        risk.decision_influence = 0.35;
        risk.consequence_of_error = 0.70;
    }
    risk.required_rigor = rigorForRisk(risk.score());
    return risk;
}

FalsificationResult CredibilityEngine::falsifyClaim(const CausalClaim& claim, const EventLedger& ledger) const {
    FalsificationResult result;
    result.claim_label = claim.label;
    result.tests_run = claim.falsification_tests;
    const bool evidence_ok = !claim.evidence.empty() && hasEvidence(ledger, claim);

    if (claim.status == ClaimStatus::Confounded) {
        result.survived = false;
        result.overturned = true;
        result.summary = "alternate cyber/sensor explanation dominates correlated logistics delay";
        return result;
    }
    if (claim.status == ClaimStatus::Falsified || !evidence_ok) {
        result.survived = false;
        result.overturned = true;
        result.summary = "claim lacks sufficient event evidence";
        return result;
    }

    result.survived = !claim.falsification_tests.empty();
    result.overturned = !result.survived;
    result.summary = result.survived
        ? "claim survived registered falsification checks for this micro-world"
        : "claim has no registered falsification checks";
    return result;
}

FalsificationResult CredibilityEngine::falsifyClaimExecutable(
    const CausalClaim& claim,
    const EventLedger& ledger,
    const Snapshot& snapshot,
    const MissionMetrics& baseline,
    Tick horizon_ticks) const {
    FalsificationResult result;
    result.claim_label = claim.label;
    result.tests_run = claim.falsification_tests;
    const bool evidence_ok = !claim.evidence.empty() && hasEvidence(ledger, claim);
    if (!evidence_ok) {
        result.survived = false;
        result.overturned = true;
        result.summary = "claim lacks sufficient event evidence";
        return result;
    }

    InterventionEngine engine;
    const auto restore_sensor = engine.run(
        snapshot,
        baseline,
        Intervention{InterventionType::IsolateCompromisedSensorFeed, 760, "blue_uas_1"},
        horizon_ticks);
    const auto restore_comms = engine.run(
        snapshot,
        baseline,
        Intervention{InterventionType::RestoreCommsRelay, 760, "blue_relay_1"},
        horizon_ticks);
    const auto remove_logistics = engine.run(
        snapshot,
        baseline,
        Intervention{InterventionType::RemoveLogisticsDelay, 760, "logistics_support_node"},
        horizon_ticks);

    result.branch_outcomes.push_back("restore_sensor score_delta=" + std::to_string(restore_sensor.estimated_effect));
    result.branch_outcomes.push_back("restore_comms score_delta=" + std::to_string(restore_comms.estimated_effect));
    result.branch_outcomes.push_back("remove_logistics score_delta=" + std::to_string(remove_logistics.estimated_effect));

    const bool sensor_recovers = restore_sensor.estimated_effect > 0.10 && restore_sensor.counterfactual.detection_time < baseline.detection_time;
    const bool comms_not_sufficient = restore_comms.estimated_effect < 0.05 && !restore_comms.counterfactual.mission_success;
    const bool logistics_not_sufficient = remove_logistics.estimated_effect < 0.05 && !remove_logistics.counterfactual.mission_success;

    if (claim.status == ClaimStatus::Confounded ||
        claim.cause_variable.find("logistics") != std::string::npos ||
        claim.label.find("logistics_delay") != std::string::npos) {
        result.survived = false;
        result.overturned = logistics_not_sufficient;
        result.summary = logistics_not_sufficient
            ? "remove_logistics_delay branch did not recover mission; logistics remains correlated only"
            : "logistics branch changed mission outcome and requires reclassification";
        return result;
    }

    if (claim.cause_variable == "blue_uas_1.sensor.confidence" ||
        claim.label.find("sensor_confidence_loss -> delayed_detection") != std::string::npos) {
        result.survived = sensor_recovers && comms_not_sufficient;
        result.overturned = !result.survived;
        result.summary = result.survived
            ? "restore_sensor recovered detection while restore_comms alone did not"
            : "alternate branch outcomes failed to isolate sensor confidence as the driver";
        return result;
    }

    if (claim.cause_variable == "detection_time" ||
        claim.label.find("delayed_detection -> mission_failure") != std::string::npos) {
        result.survived = sensor_recovers && logistics_not_sufficient;
        result.overturned = !result.survived;
        result.summary = result.survived
            ? "early detection recovery changed mission outcome while logistics removal did not"
            : "mission failure was not stable under executable falsification";
        return result;
    }

    result.survived = !claim.falsification_tests.empty();
    result.overturned = !result.survived;
    result.summary = result.survived
        ? "direct evidence survived executable branch sanity checks"
        : "claim has no registered falsification checks";
    return result;
}

} // namespace darla
