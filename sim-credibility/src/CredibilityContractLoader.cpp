#include "sim-credibility/CredibilityContractLoader.h"

#include <cctype>
#include <fstream>
#include <stdexcept>

namespace darla {
namespace {

std::string trim(std::string value) {
    while (!value.empty() && std::isspace(static_cast<unsigned char>(value.front()))) value.erase(value.begin());
    while (!value.empty() && std::isspace(static_cast<unsigned char>(value.back()))) value.pop_back();
    return value;
}

std::string afterColon(const std::string& line) {
    const auto pos = line.find(':');
    if (pos == std::string::npos) return {};
    std::string value = line.substr(pos + 1);
    if (!value.empty() && value.front() == ' ') value.erase(0, 1);
    return trim(value);
}

bool matchesClaim(const CredibilityContract& contract, const CausalClaim& claim) {
    if (contract.model_name.find("sensor confidence") != std::string::npos &&
        (claim.cause_variable.find("sensor") != std::string::npos || claim.effect_variable.find("sensor") != std::string::npos)) {
        return true;
    }
    if (contract.model_name.find("mission effects") != std::string::npos &&
        (claim.effect_variable.find("mission_success_score") != std::string::npos || claim.label.find("mission") != std::string::npos)) {
        return true;
    }
    if (contract.model_name.find("comms effects") != std::string::npos &&
        claim.effect_variable.find("comms") != std::string::npos) {
        return true;
    }
    if (contract.model_name.find("logistics") != std::string::npos &&
        claim.cause_variable.find("logistics") != std::string::npos) {
        return true;
    }
    if (contract.model_name.find("commander policy") != std::string::npos &&
        claim.label.find("delayed_detection") != std::string::npos) {
        return true;
    }
    return false;
}

} // namespace

CredibilityContractLoader::CredibilityContractLoader(const std::filesystem::path& models_dir) {
    if (!std::filesystem::exists(models_dir)) {
        throw std::runtime_error("models directory not found: " + models_dir.string());
    }

    for (const auto& entry : std::filesystem::directory_iterator(models_dir)) {
        if (entry.path().extension() != ".yaml") continue;

        CredibilityContract contract;
        std::ifstream in(entry.path());
        if (!in) continue;

        bool in_list = false;
        std::string list_field;
        std::string raw;
        while (std::getline(in, raw)) {
            const std::string line = trim(raw);
            if (line.empty() || line[0] == '#') continue;

            if (line.rfind("- ", 0) == 0 && in_list) {
                const std::string item = trim(line.substr(2));
                if (list_field == "valid_conditions") contract.valid_conditions.push_back(item);
                else if (list_field == "invalid_conditions") contract.invalid_conditions.push_back(item);
                else if (list_field == "assumptions") contract.assumptions.push_back(item);
                else if (list_field == "required_inputs") contract.required_inputs.push_back(item);
                else if (list_field == "known_failure_modes") contract.known_failure_modes.push_back(item);
                continue;
            }

            in_list = false;
            if (line.rfind("model_name:", 0) == 0) contract.model_name = afterColon(line);
            else if (line.rfind("intended_use:", 0) == 0) contract.intended_use = afterColon(line);
            else if (line.rfind("verification_score:", 0) == 0) contract.verification_score = std::stod(afterColon(line));
            else if (line.rfind("validation_score:", 0) == 0) contract.validation_score = std::stod(afterColon(line));
            else if (line.rfind("uncertainty_score:", 0) == 0) contract.uncertainty_score = std::stod(afterColon(line));
            else if (line.rfind("calibration_error:", 0) == 0) contract.calibration_error = std::stod(afterColon(line));
            else if (line == "valid_conditions:") { in_list = true; list_field = "valid_conditions"; }
            else if (line == "invalid_conditions:") { in_list = true; list_field = "invalid_conditions"; }
            else if (line == "assumptions:") { in_list = true; list_field = "assumptions"; }
            else if (line == "required_inputs:") { in_list = true; list_field = "required_inputs"; }
            else if (line == "known_failure_modes:") { in_list = true; list_field = "known_failure_modes"; }
        }

        if (!contract.model_name.empty()) contracts_.push_back(contract);
    }
}

CredibilityContract CredibilityContractLoader::contractForClaim(const CausalClaim& claim) const {
    for (const auto& contract : contracts_) {
        if (matchesClaim(contract, claim)) return contract;
    }

    CredibilityContract fallback;
    fallback.model_name = "causal claim discipline model";
    fallback.intended_use = "causal explanation over deterministic UAS maritime ISR micro-world";
    fallback.verification_score = 0.82;
    fallback.validation_score = 0.72;
    fallback.uncertainty_score = 0.24;
    fallback.calibration_error = 0.12;
    fallback.known_failure_modes = {"alternate causal structure not represented"};
    return fallback;
}

} // namespace darla
