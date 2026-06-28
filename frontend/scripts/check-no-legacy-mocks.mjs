#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const pagesDir = new URL("../src/pages", import.meta.url).pathname;
const forbidden = ["mockScenario", "mockCoSim", "legacyDemoScenario", "legacyCoSimDemoData"];
const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!path.endsWith(".tsx") && !path.endsWith(".ts")) continue;
    const source = readFileSync(path, "utf8");
    for (const token of forbidden) {
      if (source.includes(`data/${token}`) || source.includes(`"${token}"`)) {
        offenders.push(`${path}: imports legacy mock ${token}`);
      }
    }
  }
}

walk(pagesDir);

if (offenders.length > 0) {
  console.error("Production pages must not import legacy mock fixtures:\n");
  for (const line of offenders) console.error(`  ${line}`);
  process.exit(1);
}

console.log("check:no-legacy-mocks passed");
