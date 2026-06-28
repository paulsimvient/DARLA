#pragma once

#include "sim-causal/CausalClaim.h"
#include "sim-credibility/CredibilityEngine.h"

#include <filesystem>
#include <vector>

namespace darla {

class CredibilityContractLoader {
public:
    explicit CredibilityContractLoader(const std::filesystem::path& models_dir);

    CredibilityContract contractForClaim(const CausalClaim& claim) const;
    const std::vector<CredibilityContract>& contracts() const { return contracts_; }

private:
    std::vector<CredibilityContract> contracts_;
};

} // namespace darla
