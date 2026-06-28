#include "sim-fmi/FmuMasterClock.h"

#include "sim-fmi/FmuBinding.h"
#include "sim-fmi/FmuEventAdapter.h"
#include "sim-fmi/FmiMaster.h"
#include "sim-fmi/FmuRegistry.h"

#include <iomanip>
#include <sstream>
#include <string>

namespace darla {
namespace {

std::string fixed(double value) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(6) << value;
    return out.str();
}

} // namespace

void FmuMasterClock::stepConfiguredFmus(WorldState& world, EventLedger& ledger) {
    if (world.fmu_configs.empty()) return;

    FmuRegistry registry;
    registry.restoreFromWorld(world);
    const double current_time = static_cast<double>(world.tick);

    for (auto& component : registry.components()) {
        std::vector<StateDelta> deltas;

        for (const auto& port : component.ports()) {
            if (port.direction != FmuPortDirection::Input) continue;
            double value = 0.0;
            if (FmuBinding::readWorldValue(world, port.world_path, &value)) {
                component.setInput(port.name, value);
            }
        }

        for (const auto& port : component.ports()) {
            if (port.direction != FmuPortDirection::Output) continue;
            double before = 0.0;
            if (FmuBinding::readWorldValue(world, port.world_path, &before)) {
                deltas.push_back({port.world_path, fixed(before), fixed(before)});
            }
        }

        FmiMaster::doStep(component, current_time);

        for (const auto& port : component.ports()) {
            if (port.direction != FmuPortDirection::Output) continue;
            double value = 0.0;
            if (!component.getOutput(port.name, &value)) continue;

            double before_value = value;
            for (const auto& delta : deltas) {
                if (delta.field == port.world_path) {
                    before_value = std::stod(delta.before);
                    break;
                }
            }

            if (port.world_path.find("sensor.confidence") != std::string::npos) {
                value = std::min(value, before_value);
            }

            FmuBinding::writeWorldValue(world, port.world_path, value);
            for (auto& delta : deltas) {
                if (delta.field == port.world_path) {
                    delta.after = fixed(value);
                    break;
                }
            }
        }

        registry.syncRuntimeToWorld(world);

        std::ostringstream summary;
        summary << "FMU step " << component.config().id << " (" << component.loadMode() << ")";
        FmuEventAdapter::emitStepEvent(ledger, world.tick, component, deltas, summary.str());
    }
}

} // namespace darla
