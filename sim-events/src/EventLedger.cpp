#include "sim-events/EventLedger.h"

#include <algorithm>
#include <fstream>
#include <sstream>
#include <stdexcept>

namespace darla {

std::string toString(EventType type) {
    switch (type) {
    case EventType::Observe: return "Observe";
    case EventType::Move: return "Move";
    case EventType::Detect: return "Detect";
    case EventType::Communicate: return "Communicate";
    case EventType::DecideCOA: return "DecideCOA";
    case EventType::Engage: return "Engage";
    case EventType::Jam: return "Jam";
    case EventType::CyberDegrade: return "CyberDegrade";
    case EventType::Repair: return "Repair";
    case EventType::Resupply: return "Resupply";
    case EventType::LogisticsDelay: return "LogisticsDelay";
    case EventType::PolicyChangeProposed: return "PolicyChangeProposed";
    case EventType::PolicyChangeAccepted: return "PolicyChangeAccepted";
    case EventType::MissionEffect: return "MissionEffect";
    case EventType::EmergentBehaviorDetected: return "EmergentBehaviorDetected";
    case EventType::InterventionApplied: return "InterventionApplied";
    case EventType::SensorConfidenceLoss: return "SensorConfidenceLoss";
    case EventType::HumanApprovedCoa: return "HumanApprovedCoa";
    case EventType::HumanRejectedCoa: return "HumanRejectedCoa";
    case EventType::ManualIntervention: return "ManualIntervention";
    }
    return "Unknown";
}

EventId EventLedger::append(SimEvent event) {
    event.event_id = next_id_++;
    events_.push_back(std::move(event));
    return events_.back().event_id;
}

const SimEvent* EventLedger::find(EventId id) const {
    const auto it = std::find_if(events_.begin(), events_.end(), [id](const SimEvent& event) { return event.event_id == id; });
    return it == events_.end() ? nullptr : &*it;
}

bool EventLedger::validateIntegrity(std::string* error) const {
    EventId expected = 1;
    Tick previous_tick = 0;
    for (const auto& event : events_) {
        if (event.event_id != expected++) {
            if (error) *error = "non-monotonic event id";
            return false;
        }
        if (event.event_id > 1 && event.tick < previous_tick) {
            if (error) *error = "non-monotonic event tick";
            return false;
        }
        for (const auto parent : event.causal_parent_events) {
            const auto* parent_event = find(parent);
            if (parent >= event.event_id || parent_event == nullptr) {
                if (error) *error = "invalid causal parent reference";
                return false;
            }
            if (parent_event->tick > event.tick) {
                if (error) *error = "causal parent occurs after child event";
                return false;
            }
        }
        previous_tick = event.tick;
    }
    return true;
}

std::string EventLedger::serialize() const {
    std::ostringstream out;
    for (const auto& event : events_) {
        out << event.event_id << '|' << event.tick << '|' << event.actor << '|' << toString(event.type) << '|' << event.label << '|';
        for (auto target : event.targets) out << target << ',';
        out << '|';
        for (auto parent : event.causal_parent_events) out << parent << ',';
        out << '|';
        for (const auto& delta : event.deltas) out << delta.field << '=' << delta.before << "->" << delta.after << ',';
        out << '|' << event.confidence << '|' << event.aleatory_uncertainty << '|' << event.epistemic_uncertainty << '\n';
    }
    return out.str();
}

std::uint64_t EventLedger::stableHash() const {
    return stableHashForSerialized(serialize());
}

std::string EventLedger::serializeWithHeader() const {
    const auto body = serialize();
    std::ostringstream out;
    out << "DARLA_EVENT_LEDGER_V1 hash=" << stableHashForSerialized(body)
        << " events=" << events_.size() << '\n';
    out << body;
    return out.str();
}

void EventLedger::saveToFile(const std::filesystem::path& path) const {
    std::ofstream out(path);
    if (!out) {
        throw std::runtime_error("unable to write event ledger: " + path.string());
    }
    out << serializeWithHeader();
}

std::uint64_t EventLedger::stableHashForSerialized(std::string_view data) {
    std::uint64_t h = 1469598103934665603ull;
    for (unsigned char c : data) {
        h ^= c;
        h *= 1099511628211ull;
    }
    return h;
}

} // namespace darla
