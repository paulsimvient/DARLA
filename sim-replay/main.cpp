#include "sim-events/EventLedger.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

using namespace darla;

namespace {

std::uint64_t parseExpectedHash(const std::string& header) {
    const auto pos = header.find("hash=");
    if (pos == std::string::npos) {
        throw std::runtime_error("ledger header is missing hash=");
    }
    const auto start = pos + 5;
    const auto end = header.find(' ', start);
    return std::stoull(header.substr(start, end == std::string::npos ? std::string::npos : end - start));
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc < 2) {
            std::cerr << "usage: sim-replay <events.log> [--verify-hash]\n";
            return 2;
        }

        std::ifstream in{std::filesystem::path(argv[1])};
        if (!in) {
            throw std::runtime_error("unable to open event ledger");
        }

        std::string header;
        std::getline(in, header);
        std::ostringstream body;
        body << in.rdbuf();

        const auto expected = parseExpectedHash(header);
        const auto actual = EventLedger::stableHashForSerialized(body.str());
        const bool verify_hash = argc > 2 && std::string(argv[2]) == "--verify-hash";

        std::cout << "Event ledger: " << argv[1] << '\n';
        std::cout << "Expected hash: " << expected << '\n';
        std::cout << "Actual hash: " << actual << '\n';
        if (verify_hash && expected != actual) {
            std::cerr << "Hash verification failed\n";
            return 1;
        }
        if (verify_hash) {
            std::cout << "Hash verification: passed\n";
        }
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-replay error: " << ex.what() << '\n';
        return 1;
    }
}
