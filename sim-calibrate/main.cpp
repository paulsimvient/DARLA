#include "ScenarioLoader.h"
#include "sim-causal/CalibrationHarness.h"
#include "sim-credibility/CredibilityEngine.h"

#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>

using namespace darla;

namespace {

std::string jsonNumber(double value) {
    std::ostringstream out;
    out << std::setprecision(6) << value;
    return out.str();
}

std::string buildJson(const Scenario& scenario, const CalibrationReport& report, const CredibilityContract& contract) {
    std::ostringstream out;
    out << '{'
        << "\"scenario_id\":\"" << scenario.config.scenario_id << "\","
        << "\"seed\":" << scenario.config.seed << ','
        << "\"mission_cutoff\":" << scenario.mission.target_detected_before_tick << ','
        << "\"probability_calibration\":{"
        << "\"brier_score\":" << jsonNumber(report.brier_score) << ','
        << "\"log_loss\":" << jsonNumber(report.log_loss) << ','
        << "\"expected_calibration_error\":" << jsonNumber(report.expected_calibration_error) << ','
        << "\"outcome_samples\":" << report.outcome_samples << ','
        << "\"reliability\":[";
    for (std::size_t i = 0; i < report.reliability.size(); ++i) {
        if (i > 0) out << ',';
        out << "{\"mean_predicted\":" << jsonNumber(report.reliability[i].mean_predicted)
            << ",\"mean_observed\":" << jsonNumber(report.reliability[i].mean_observed)
            << ",\"count\":" << report.reliability[i].count << '}';
    }
    out << "]},"
        << "\"effect_accuracy\":{"
        << "\"true_effect\":" << jsonNumber(report.true_effect) << ','
        << "\"mean_estimated_effect\":" << jsonNumber(report.mean_estimated_effect) << ','
        << "\"mean_ci_width\":" << jsonNumber(report.mean_ci_width) << ','
        << "\"ci_coverage\":" << jsonNumber(report.ci_coverage) << ','
        << "\"ci_experiments\":" << report.ci_experiments << ','
        << "\"mean_abs_effect_error\":" << jsonNumber(report.recovery.mean_abs_effect_error)
        << "},"
        << "\"graph_recovery\":{"
        << "\"precision\":" << jsonNumber(report.recovery.precision) << ','
        << "\"recall\":" << jsonNumber(report.recovery.recall) << ','
        << "\"f1\":" << jsonNumber(report.recovery.f1) << ','
        << "\"structural_hamming_distance\":" << report.recovery.structural_hamming_distance << ','
        << "\"sign_accuracy\":" << jsonNumber(report.recovery.sign_accuracy)
        << "},"
        << "\"credibility_contract\":{"
        << "\"calibration_error\":" << jsonNumber(contract.calibration_error) << ','
        << "\"validation_score\":" << jsonNumber(contract.validation_score) << ','
        << "\"uncertainty_score\":" << jsonNumber(contract.uncertainty_score)
        << "}}";
    return out.str();
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc < 2) {
            std::cerr << "usage: sim-calibrate <scenario.yaml> [--seeds N] [--ci-experiments N] [--ci-replicates N] [--out file.json]\n";
            return 2;
        }

        CalibrationConfig config;
        std::filesystem::path out_path;
        for (int i = 2; i + 1 < argc; ++i) {
            const std::string flag = argv[i];
            if (flag == "--seeds") config.outcome_seeds = std::stoi(argv[i + 1]);
            else if (flag == "--ci-experiments") config.ci_experiments = std::stoi(argv[i + 1]);
            else if (flag == "--ci-replicates") config.ci_replicates = std::stoi(argv[i + 1]);
            else if (flag == "--out") out_path = argv[i + 1];
        }

        ScenarioLoader loader;
        const auto scenario = loader.load(std::filesystem::path(argv[1]));

        CalibrationHarness harness;
        const auto report = harness.run(scenario, config);

        // Populate the previously-unused credibility-contract calibration fields.
        CredibilityContract contract;
        contract.model_name = "calibrated causal slice (" + scenario.config.scenario_id + ")";
        contract.calibration_error = report.calibration_error;
        contract.validation_score = report.validation_score;
        contract.uncertainty_score = report.uncertainty_score;

        std::cout << std::fixed << std::setprecision(4);
        std::cout << "Calibration report for " << scenario.config.scenario_id << "\n";
        std::cout << "  Probability calibration (P[mission success]):\n";
        std::cout << "    Brier score:               " << report.brier_score << "\n";
        std::cout << "    Log loss:                  " << report.log_loss << "\n";
        std::cout << "    Expected calibration error:" << report.expected_calibration_error << "\n";
        std::cout << "    Outcome samples:           " << report.outcome_samples << "\n";
        std::cout << "  Effect estimate accuracy (sensor->mission chain):\n";
        std::cout << "    True effect (SCM):         " << report.true_effect << "\n";
        std::cout << "    Mean estimated effect:     " << report.mean_estimated_effect << "\n";
        std::cout << "    Mean 90% CI width:         " << report.mean_ci_width << "\n";
        std::cout << "    CI coverage:               " << report.ci_coverage
                  << " (" << report.ci_experiments << " experiments)\n";
        std::cout << "    Mean abs effect error:     " << report.recovery.mean_abs_effect_error << "\n";
        std::cout << "  Planted-DAG recovery:\n";
        std::cout << "    Precision / Recall / F1:   " << report.recovery.precision << " / "
                  << report.recovery.recall << " / " << report.recovery.f1 << "\n";
        std::cout << "    Structural Hamming dist.:  " << report.recovery.structural_hamming_distance << "\n";
        std::cout << "    Sign accuracy:             " << report.recovery.sign_accuracy << "\n";
        std::cout << "  Credibility contract fields:\n";
        std::cout << "    calibration_error:         " << contract.calibration_error << "\n";
        std::cout << "    validation_score:          " << contract.validation_score << "\n";
        std::cout << "    uncertainty_score:         " << contract.uncertainty_score << "\n";

        if (!out_path.empty()) {
            std::ofstream out{out_path};
            if (!out) throw std::runtime_error("unable to write: " + out_path.string());
            out << buildJson(scenario, report, contract);
            std::cout << "Wrote " << out_path.string() << "\n";
        }
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-calibrate error: " << ex.what() << '\n';
        return 1;
    }
}
