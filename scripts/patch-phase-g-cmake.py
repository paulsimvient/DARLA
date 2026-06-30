#!/usr/bin/env python3
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

block = """
# ---- DARLA Phase G: formal mission reasoning layer ----
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/sim-reasoning")
  add_library(sim-reasoning
    sim-reasoning/src/BeliefState.cpp
    sim-reasoning/src/DecisionContext.cpp
    sim-reasoning/src/EvidencePackage.cpp
    sim-reasoning/src/SimulationBroker.cpp
    sim-reasoning/src/MissionReasoner.cpp
  )

  target_include_directories(sim-reasoning PUBLIC
    sim-reasoning/include
  )

  target_compile_features(sim-reasoning PUBLIC cxx_std_20)

  if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/tests/unit/phase_g_reasoning_smoke.cpp")
    add_executable(phase_g_reasoning_smoke
      tests/unit/phase_g_reasoning_smoke.cpp
    )
    target_link_libraries(phase_g_reasoning_smoke PRIVATE sim-reasoning)
    add_test(NAME phase_g_reasoning_smoke COMMAND phase_g_reasoning_smoke)
  endif()
endif()
# ---- end DARLA Phase G ----
"""

if "DARLA Phase G: formal mission reasoning layer" not in text:
    text = text.rstrip() + "\n\n" + block + "\n"

link_block = """
# ---- DARLA Phase G optional target links ----
foreach(_phaseg_target IN ITEMS sim-export sim-stream sim-live sim-tools darla_tests)
  if(TARGET ${_phaseg_target} AND TARGET sim-reasoning)
    target_link_libraries(${_phaseg_target} PRIVATE sim-reasoning)
  endif()
endforeach()
# ---- end DARLA Phase G optional target links ----
"""

if "DARLA Phase G optional target links" not in text:
    text = text.rstrip() + "\n\n" + link_block + "\n"

path.write_text(text)
print(f"Patched {path}")
