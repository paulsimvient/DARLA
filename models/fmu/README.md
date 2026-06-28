# FMU models for co-simulation

Place `.fmu` archives here. DARLA resolves paths like `models/fmu/uas_sensor.fmu` relative to the repo root (or `DARLA_SOURCE_DIR` at build time).

When no archive is present, the co-simulation master runs in `analytical_stub` mode using YAML port bindings.

To enable real FMI stepping, build with FMIL:

```bash
cmake -S . -B build-make -DDARLA_ENABLE_FMI=ON
cmake --build build-make
```
