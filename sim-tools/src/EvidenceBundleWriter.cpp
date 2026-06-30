#include "sim-tools/EvidenceBundleWriter.h"

#include <chrono>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace darla {
namespace {

void writeText(const std::filesystem::path& path, const std::string& text) {
    std::ofstream out(path);
    if (!out) throw std::runtime_error("failed to open " + path.string());
    out << text;
}

std::string escapeJson(const std::string& value) {
    std::string out;
    for (const char c : value) {
        switch (c) {
        case '\\': out += "\\\\"; break;
        case '"': out += "\\\""; break;
        case '\n': out += "\\n"; break;
        case '\r': out += "\\r"; break;
        case '\t': out += "\\t"; break;
        default: out += c; break;
        }
    }
    return out;
}

} // namespace

std::string utcNowIso8601() {
    const auto now = std::chrono::system_clock::now();
    const auto t = std::chrono::system_clock::to_time_t(now);
    std::tm tm{};
#if defined(_WIN32)
    gmtime_s(&tm, &t);
#else
    gmtime_r(&t, &tm);
#endif
    std::ostringstream out;
    out << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
    return out.str();
}

std::string renderEvidenceManifestJson(const EvidenceBundleManifest& manifest) {
    std::ostringstream out;
    out << "{\n";
    out << "  \"run_id\": \"" << escapeJson(manifest.run_id) << "\",\n";
    out << "  \"branch_id\": \"" << escapeJson(manifest.branch_id) << "\",\n";
    out << "  \"parent_run_id\": \"" << escapeJson(manifest.parent_run_id) << "\",\n";
    out << "  \"scenario_id\": \"" << escapeJson(manifest.scenario_id) << "\",\n";
    out << "  \"seed\": " << manifest.seed << ",\n";
    out << "  \"authorization_mode\": \"" << escapeJson(manifest.authorization_mode) << "\",\n";
    out << "  \"final_tick\": " << manifest.final_tick << ",\n";
    out << "  \"replay_hash\": \"" << escapeJson(manifest.replay_hash) << "\",\n";
    out << "  \"scenario_sha256\": \"" << escapeJson(manifest.scenario_sha256) << "\",\n";
    out << "  \"event_ledger_sha256\": \"" << escapeJson(manifest.event_ledger_sha256) << "\",\n";
    out << "  \"frames_sha256\": \"" << escapeJson(manifest.frames_sha256) << "\",\n";
    out << "  \"created_at_utc\": \"" << escapeJson(manifest.created_at_utc) << "\",\n";
    out << "  \"artifacts\": [\n";
    for (std::size_t i = 0; i < manifest.artifacts.size(); ++i) {
        const auto& artifact = manifest.artifacts[i];
        out << "    {\"name\": \"" << escapeJson(artifact.name) << "\", \"path\": \""
            << escapeJson(artifact.path) << "\", \"sha256\": \"" << escapeJson(artifact.sha256) << "\"}";
        if (i + 1 < manifest.artifacts.size()) out << ',';
        out << "\n";
    }
    out << "  ]\n";
    out << "}\n";
    return out.str();
}

void EvidenceBundleWriter::write(const std::filesystem::path& directory, const EvidenceBundleInputs& inputs) const {
    std::filesystem::create_directories(directory);

    EvidenceBundleManifest manifest = inputs.manifest;
    if (manifest.created_at_utc.empty()) manifest.created_at_utc = utcNowIso8601();

    if (inputs.ledger) {
        const auto ledger_path = directory / "event_ledger.jsonl";
        inputs.ledger->saveToFile(ledger_path);
        manifest.artifacts.push_back({"event_ledger", "event_ledger.jsonl", manifest.event_ledger_sha256});
    }
    if (!inputs.claims_json.empty()) {
        writeText(directory / "causal_claims.json", inputs.claims_json);
        manifest.artifacts.push_back({"causal_claims", "causal_claims.json", ""});
    }
    if (!inputs.frames_jsonl.empty()) {
        writeText(directory / "frames_sparse.jsonl", inputs.frames_jsonl);
        manifest.artifacts.push_back({"frames_sparse", "frames_sparse.jsonl", manifest.frames_sha256});
    }

    writeText(directory / "manifest.json", renderEvidenceManifestJson(manifest));
}

} // namespace darla
