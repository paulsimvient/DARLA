#pragma once

#include <map>
#include <string>
#include <vector>

namespace darla::reasoning {

struct BeliefUpdate {
    int tick = 0;
    std::string source;
    std::string key;
    double prior = 0.0;
    double posterior = 0.0;
    std::string rationale;
};

class BeliefState {
public:
    void set(const std::string& key, double value);
    double get(const std::string& key, double fallback = 0.0) const;

    void update(
        int tick,
        const std::string& source,
        const std::string& key,
        double posterior,
        const std::string& rationale);

    const std::map<std::string, double>& values() const;
    const std::vector<BeliefUpdate>& history() const;

private:
    std::map<std::string, double> values_;
    std::vector<BeliefUpdate> history_;
};

} // namespace darla::reasoning
