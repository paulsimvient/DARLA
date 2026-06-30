#include "darla/reasoning/BeliefState.hpp"

namespace darla::reasoning {

void BeliefState::set(const std::string& key, double value) {
    values_[key] = value;
}

double BeliefState::get(const std::string& key, double fallback) const {
    const auto it = values_.find(key);
    return it == values_.end() ? fallback : it->second;
}

void BeliefState::update(
    int tick,
    const std::string& source,
    const std::string& key,
    double posterior,
    const std::string& rationale) {
    const double prior = get(key, 0.0);
    values_[key] = posterior;
    history_.push_back(BeliefUpdate{tick, source, key, prior, posterior, rationale});
}

const std::map<std::string, double>& BeliefState::values() const {
    return values_;
}

const std::vector<BeliefUpdate>& BeliefState::history() const {
    return history_;
}

} // namespace darla::reasoning
