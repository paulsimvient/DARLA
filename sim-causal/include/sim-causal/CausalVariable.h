#pragma once

#include "Types.h"

#include <optional>
#include <string>

namespace darla {

struct CausalVariableKey {
    std::string entity;
    std::string component;
    std::string field;

    std::string toString() const;
    static std::optional<CausalVariableKey> parse(const std::string& dotted_path);
};

struct CausalVariableValue {
    CausalVariableKey key;
    Tick at_tick = 0;
    double numeric_value = 0.0;
    std::string text_value;
    bool is_numeric = true;
};

} // namespace darla
