#include "StructuralCausalModel.h"

#include <algorithm>
#include <cmath>

namespace darla {
namespace {

constexpr double kPi = 3.14159265358979323846;

std::uint64_t splitmix64(std::uint64_t x) {
    x += 0x9E3779B97F4A7C15ull;
    x = (x ^ (x >> 30)) * 0xBF58476D1CE4E5B9ull;
    x = (x ^ (x >> 27)) * 0x94D049BB133111EBull;
    return x ^ (x >> 31);
}

double uniform01(std::uint64_t bits) {
    // Use the top 53 bits for a double in [0, 1).
    return static_cast<double>(bits >> 11) * (1.0 / 9007199254740992.0);
}

double clip01(double value) {
    return std::clamp(value, 0.0, 1.0);
}

} // namespace

double scmGaussian(std::uint64_t seed, std::uint64_t stream) {
    const std::uint64_t mixed = splitmix64(seed + 0x9E3779B97F4A7C15ull * (stream + 1));
    const std::uint64_t a = splitmix64(mixed);
    const std::uint64_t b = splitmix64(a);
    double u1 = uniform01(a);
    const double u2 = uniform01(b);
    if (u1 < 1e-12) u1 = 1e-12;
    return std::sqrt(-2.0 * std::log(u1)) * std::cos(2.0 * kPi * u2);
}

double normalCdf(double z) {
    return 0.5 * std::erfc(-z * 0.7071067811865476);
}

Tick StructuralCausalModel::detectionTickMean(const DetectionInputs& in) const {
    if (in.isolated && in.autonomous) return static_cast<Tick>(params_.detection_isolated_autonomous);
    if (in.isolated) return static_cast<Tick>(params_.detection_isolated);
    if (in.degraded && in.autonomous) return static_cast<Tick>(params_.detection_degraded_autonomous);
    if (in.degraded) return static_cast<Tick>(params_.detection_degraded);
    if (in.comms_blocking) return static_cast<Tick>(params_.detection_comms_blocking);
    return static_cast<Tick>(params_.detection_nominal);
}

double StructuralCausalModel::missionScoreMean(const MissionInputs& in) const {
    if (!in.success) return params_.mission_fail_score;
    double score = (in.autonomous && in.isolated)
        ? params_.mission_success_autonomous_isolated
        : params_.mission_success_score;
    if (in.preauthorized && in.high_confidence) {
        score = std::max(score, params_.mission_preauth_floor);
    }
    return score;
}

Tick StructuralCausalModel::detectionTick(const DetectionInputs& in, std::uint64_t noise_seed, std::uint64_t stream) const {
    const double mean = static_cast<double>(detectionTickMean(in));
    const double sampled = mean + params_.detection_sigma * scmGaussian(noise_seed, stream);
    return static_cast<Tick>(std::llround(std::max(1.0, sampled)));
}

double StructuralCausalModel::missionScore(const MissionInputs& in, std::uint64_t noise_seed, std::uint64_t stream) const {
    const double mean = missionScoreMean(in);
    return clip01(mean + params_.mission_sigma * scmGaussian(noise_seed, stream));
}

double StructuralCausalModel::probabilityDetectBeforeCutoff(const DetectionInputs& in, Tick cutoff) const {
    const double mean = static_cast<double>(detectionTickMean(in));
    if (params_.detection_sigma <= 0.0) {
        return mean <= static_cast<double>(cutoff) ? 1.0 : 0.0;
    }
    return normalCdf((static_cast<double>(cutoff) - mean) / params_.detection_sigma);
}

double StructuralCausalModel::expectedMissionScore(const MissionInputs& inputs, double success_probability) const {
    const double p = clip01(success_probability);
    MissionInputs success = inputs;
    success.success = true;
    MissionInputs failure = inputs;
    failure.success = false;
    return p * missionScoreMean(success) + (1.0 - p) * missionScoreMean(failure);
}

} // namespace darla
