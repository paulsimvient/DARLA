#pragma once

#include "sim-events/SimEvent.h"

#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <string>
#include <string_view>
#include <vector>

namespace darla {

class EventLedger {
public:
    EventId append(SimEvent event);
    const std::vector<SimEvent>& events() const { return events_; }
    const SimEvent* find(EventId id) const;
    bool validateIntegrity(std::string* error = nullptr) const;
    std::string serialize() const;
    std::string serializeWithHeader() const;
    std::uint64_t stableHash() const;
    void saveToFile(const std::filesystem::path& path) const;
    static std::uint64_t stableHashForSerialized(std::string_view data);
    std::size_t size() const { return events_.size(); }

private:
    std::vector<SimEvent> events_;
    EventId next_id_ = 1;
};

} // namespace darla
