cmake_minimum_required(VERSION 3.20)
project(DARLACausalLVC LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(DARLA_ENABLE_SANITIZERS "Build with AddressSanitizer and UndefinedBehaviorSanitizer" OFF)
option(DARLA_ENABLE_PYTHON_SCRIPTING "Enable embedded Python script components with pybind11" OFF)

include(CTest)

if(DARLA_ENABLE_SANITIZERS)
    if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
        add_compile_options(-fsanitize=address,undefined -fno-omit-frame-pointer)
        add_link_options(-fsanitize=address,undefined)
    else()
        message(FATAL_ERROR "DARLA_ENABLE_SANITIZERS requires Clang or GCC")
    endif()
endif()

add_library(sim_events
    sim-events/src/EventLedger.cpp
)
target_include_directories(sim_events PUBLIC sim-events/include sim-core/include)

add_library(sim_graph
    sim-graph/src/TemporalCausalGraph.cpp
    sim-graph/src/RelationshipGraph.cpp
    sim-graph/src/GraphEntityResolver.cpp
)
target_include_directories(sim_graph PUBLIC sim-graph/include sim-events/include sim-core/include)
target_link_libraries(sim_graph PUBLIC sim_events)

add_library(sim_agents
    sim-agents/src/Agents.cpp
    sim-agents/src/AgentFramework.cpp
    sim-agents/src/AgentRuntime.cpp
    sim-agents/src/AuthorityGate.cpp
    sim-agents/src/MaritimeAgentBindings.cpp
)
target_include_directories(sim_agents PUBLIC sim-agents/include sim-core/include sim-events/include sim-graph/include)
target_link_libraries(sim_agents PUBLIC sim_events sim_graph sim_core)

add_library(sim_core
    sim-core/src/ScenarioLoader.cpp
    sim-core/src/SimulationKernel.cpp
    sim-core/src/ScriptComponent.cpp
    sim-core/src/AgentAction.cpp
    sim-core/src/CourseOfAction.cpp
    sim-core/src/DecisionHorizon.cpp
    sim-core/src/ExecutionBudget.cpp
    sim-core/src/RelationshipTypes.cpp
    sim-core/src/InterventionPreconditions.cpp
    sim-core/src/StructuralCausalModel.cpp
)
target_include_directories(sim_core PUBLIC sim-core/include sim-events/include sim-graph/include sim-adjudication/include)
target_link_libraries(sim_core PUBLIC sim_events sim_graph sim_adjudication)

if(DARLA_ENABLE_PYTHON_SCRIPTING)
    find_package(pybind11 REQUIRED)
    add_library(sim_scripting
        sim-scripting/src/PythonRuntime.cpp
        sim-scripting/src/PythonScriptComponent.cpp
        sim-scripting/src/ScriptContext.cpp
    )
    target_include_directories(sim_scripting PUBLIC sim-scripting/include sim-core/include sim-events/include)
    target_link_libraries(sim_scripting PUBLIC sim_core pybind11::embed)
    target_compile_definitions(sim_scripting PRIVATE DARLA_SOURCE_DIR="${CMAKE_SOURCE_DIR}")
endif()

add_library(sim_fmi
    sim-fmi/src/FmuComponent.cpp
    sim-fmi/src/FmuBinding.cpp
    sim-fmi/src/FmuRegistry.cpp
    sim-fmi/src/FmiMaster.cpp
    sim-fmi/src/FmuMasterClock.cpp
    sim-fmi/src/FmuEventAdapter.cpp
)
target_include_directories(sim_fmi PUBLIC sim-fmi/include sim-core/include sim-events/include)
target_link_libraries(sim_fmi PUBLIC sim_core sim_events)
target_compile_definitions(sim_fmi PRIVATE DARLA_SOURCE_DIR="${CMAKE_SOURCE_DIR}")

option(DARLA_ENABLE_FMI "Link FMIL for real FMI co-simulation (requires fmilib)" OFF)
if(DARLA_ENABLE_FMI)
    find_package(fmilib REQUIRED)
    target_link_libraries(sim_fmi PUBLIC fmilib::fmilib)
    target_compile_definitions(sim_fmi PUBLIC DARLA_HAS_FMIL)
endif()

add_library(sim_adjudication
    sim-adjudication/src/MicroWorldAdjudicator.cpp
    sim-adjudication/src/EmergenceDetector.cpp
)
target_include_directories(sim_adjudication PUBLIC sim-adjudication/include sim-core/include sim-events/include sim-graph/include)
target_link_libraries(sim_adjudication PUBLIC sim_events sim_graph sim_agents sim_fmi)

add_library(sim_causal
    sim-causal/src/InterventionEngine.cpp
    sim-causal/src/MinimumInterventionSearch.cpp
    sim-causal/src/CausalActionEstimator.cpp
    sim-causal/src/CausalVariable.cpp
    sim-causal/src/CausalClaimBuilder.cpp
    sim-causal/src/PlantedTruthScorer.cpp
    sim-causal/src/Identification.cpp
    sim-causal/src/CausalEffectEstimator.cpp
    sim-causal/src/CalibrationHarness.cpp
)
target_include_directories(sim_causal PUBLIC sim-causal/include sim-core/include sim-events/include sim-graph/include)
target_link_libraries(sim_causal PUBLIC sim_core sim_events sim_graph)

add_library(sim_credibility
    sim-credibility/src/CredibilityEngine.cpp
    sim-credibility/src/CredibilityContractLoader.cpp
    sim-credibility/src/AsyncValidationRuntime.cpp
)
target_include_directories(sim_credibility PUBLIC sim-credibility/include sim-causal/include sim-events/include sim-core/include)
target_link_libraries(sim_credibility PUBLIC sim_causal)

add_library(sim_tools
    sim-tools/src/ScenarioRunner.cpp
    sim-tools/src/SimFrameExporter.cpp
    sim-tools/src/SimCommandProcessor.cpp
)
target_include_directories(sim_tools PUBLIC sim-tools/include sim-core/include sim-events/include sim-graph/include sim-credibility/include)
target_link_libraries(sim_tools PUBLIC sim_causal sim_credibility)
if(DARLA_ENABLE_PYTHON_SCRIPTING)
    target_link_libraries(sim_tools PUBLIC sim_scripting)
    target_compile_definitions(sim_tools PUBLIC DARLA_ENABLE_PYTHON_SCRIPTING)
endif()

add_executable(sim-runner sim-runner/main.cpp)
target_link_libraries(sim-runner PRIVATE sim_tools)

add_executable(sim-replay sim-replay/main.cpp)
target_link_libraries(sim-replay PRIVATE sim_events)

add_executable(sim-counterfactual sim-counterfactual/main.cpp)
target_link_libraries(sim-counterfactual PRIVATE sim_tools)

add_executable(sim-verify sim-verify/main.cpp)
target_link_libraries(sim-verify PRIVATE sim_tools sim_credibility)
target_compile_definitions(sim-verify PRIVATE DARLA_SOURCE_DIR="${CMAKE_SOURCE_DIR}")

add_executable(sim-agent-demo sim-agent-demo/main.cpp)
target_link_libraries(sim-agent-demo PRIVATE sim_tools sim_credibility)
target_compile_definitions(sim-agent-demo PRIVATE DARLA_SOURCE_DIR="${CMAKE_SOURCE_DIR}")

add_executable(sim-search sim-search/main.cpp)
target_link_libraries(sim-search PRIVATE sim_tools sim_causal)

add_executable(sim-export sim-export/main.cpp)
target_link_libraries(sim-export PRIVATE sim_tools sim_credibility sim_adjudication)
target_compile_definitions(sim-export PRIVATE DARLA_SOURCE_DIR="${CMAKE_SOURCE_DIR}")

add_executable(sim-calibrate sim-calibrate/main.cpp)
target_link_libraries(sim-calibrate PRIVATE sim_tools sim_credibility sim_causal)
target_compile_definitions(sim-calibrate PRIVATE DARLA_SOURCE_DIR="${CMAKE_SOURCE_DIR}")

add_executable(sim-stream sim-stream/main.cpp)
target_link_libraries(sim-stream PRIVATE sim_tools)

add_executable(sim-live sim-live/main.cpp)
target_link_libraries(sim-live PRIVATE sim_tools)

add_executable(sim-serve sim-serve/main.cpp)
target_link_libraries(sim-serve PRIVATE sim_tools)

if(BUILD_TESTING)
    add_executable(darla_tests
        tests/unit/main.cpp
    )
    target_link_libraries(darla_tests PRIVATE sim_tools sim_credibility sim_agents sim_causal sim_adjudication)
    target_compile_definitions(darla_tests PRIVATE DARLA_SOURCE_DIR="${CMAKE_SOURCE_DIR}")
    add_test(NAME darla_unit_tests COMMAND darla_tests)
endif()
