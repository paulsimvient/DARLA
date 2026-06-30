#pragma once

#include <string>
#include <vector>

namespace darla {

enum class CalibrationBasis {
    Synthetic,
    OpenData,
    SmeEstimate,
    ClassifiedProxy,
    Unknown
};

struct ModelValidityEnvelope {
    std::string model_id;
    std::string domain;
    std::vector<std::string> valid_for;
    std::vector<std::string> not_valid_for;
    std::vector<std::string> assumptions;
    CalibrationBasis calibration_basis = CalibrationBasis::Synthetic;
    double confidence = 0.5;
};

inline const char* toString(CalibrationBasis basis) {
    switch (basis) {
    case CalibrationBasis::Synthetic: return "synthetic";
    case CalibrationBasis::OpenData: return "open_data";
    case CalibrationBasis::SmeEstimate: return "sme_estimate";
    case CalibrationBasis::ClassifiedProxy: return "classified_proxy";
    case CalibrationBasis::Unknown: return "unknown";
    }
    return "unknown";
}

} // namespace darla
