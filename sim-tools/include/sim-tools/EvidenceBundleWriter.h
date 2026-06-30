#pragma once

#include "EvidenceBundle.h"
#include "ScenarioLoader.h"
#include "sim-events/EventLedger.h"

#include <filesystem>
#include <string>

namespace darla {

struct EvidenceBundleInputs {
    EvidenceBundleManifest manifest;
    const Scenario* scenario = nullptr;
    const EventLedger* ledger = nullptr;
    std::string claims_json;
    std::string frames_jsonl;
};

class EvidenceBundleWriter {
public:
    void write(const std::filesystem::path& directory, const EvidenceBundleInputs& inputs) const;
};

std::string renderEvidenceManifestJson(const EvidenceBundleManifest& manifest);
std::string utcNowIso8601();

} // namespace darla
