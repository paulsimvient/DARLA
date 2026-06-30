#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <string>

namespace darla {

struct ConfidenceBand {
    double mean = 0.0;
    double stddev = 0.0;
    double lower90 = 0.0;
    double upper90 = 0.0;
    double confidence = 0.0;
    std::size_t evidence_count = 0;
};

inline double clamp01(double value) {
    return std::max(0.0, std::min(1.0, value));
}

inline ConfidenceBand makeConfidenceBand(double mean, double spread90, std::size_t evidence_count) {
    ConfidenceBand band;
    band.mean = mean;
    band.stddev = spread90 / 1.6448536269514722;
    band.lower90 = mean - spread90;
    band.upper90 = mean + spread90;
    band.evidence_count = evidence_count;
    band.confidence = clamp01(0.45 + static_cast<double>(evidence_count) * 0.08 - spread90 * 0.2);
    return band;
}

struct UncertainValue {
    std::string variable;
    ConfidenceBand value;
    std::string source;
    std::string validity_context;
};

} // namespace darla
