#pragma once

#include "Types.h"

#include <cstdint>
#include <string>
#include <vector>

namespace darla {

struct EvidenceArtifactRef {
    std::string name;
    std::string path;
    std::string sha256;
};

struct EvidenceBundleManifest {
    std::string run_id;
    std::string branch_id;
    std::string parent_run_id;
    std::string scenario_id;
    std::uint64_t seed = 0;
    std::string authorization_mode;
    Tick final_tick = 0;
    std::string replay_hash;
    std::string scenario_sha256;
    std::string event_ledger_sha256;
    std::string frames_sha256;
    std::string created_at_utc;
    std::vector<EvidenceArtifactRef> artifacts;
};

} // namespace darla
