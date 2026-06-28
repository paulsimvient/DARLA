#include "sim-causal/CausalVariable.h"

namespace darla {

std::string CausalVariableKey::toString() const {
    if (component.empty()) return entity + "." + field;
    return entity + "." + component + "." + field;
}

std::optional<CausalVariableKey> CausalVariableKey::parse(const std::string& dotted_path) {
    const auto first = dotted_path.find('.');
    if (first == std::string::npos) return std::nullopt;
    const auto second = dotted_path.find('.', first + 1);

    CausalVariableKey key;
    key.entity = dotted_path.substr(0, first);
    if (second == std::string::npos) {
        key.field = dotted_path.substr(first + 1);
        return key;
    }
    key.component = dotted_path.substr(first + 1, second - first - 1);
    key.field = dotted_path.substr(second + 1);
    return key;
}

} // namespace darla
