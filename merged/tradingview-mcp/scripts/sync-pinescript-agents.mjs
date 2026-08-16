#!/usr/bin/env node
/**
 * Refresh vendored docs from github.com/TradersPost/pinescript-agents (main)
 * and mirror .cursor/skills -> .claude/skills so Claude Code stays aligned with Cursor.
 */

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorRoot = join(root, "vendor", "pinescript-agents");
const vendorDocs = join(vendorRoot, "docs");
const upstreamUrl = "https://github.com/TradersPost/pinescript-agents.git";

const tmp = mkdtempSync(join(tmpdir(), "psa-sync-"));
const cloneDir = join(tmp, "repo");

try {
  execSync(`git clone --depth 1 --branch main "${upstreamUrl}" "${cloneDir}"`, {
    stdio: "inherit",
    cwd: tmp,
  });
} catch {
  rmSync(tmp, { recursive: true, force: true });
  console.error("sync-pinescript-agents: git clone failed. Install git and retry.");
  process.exit(1);
}

const upstreamDocs = join(cloneDir, "docs");
if (!existsSync(upstreamDocs)) {
  rmSync(tmp, { recursive: true, force: true });
  console.error("sync-pinescript-agents: upstream docs/ missing.");
  process.exit(1);
}

rmSync(vendorDocs, { recursive: true, force: true });
cpSync(upstreamDocs, vendorDocs, { recursive: true });
console.log("Updated vendor/pinescript-agents/docs from upstream main.");

const cursorSkills = join(root, ".cursor", "skills");
const claudeSkills = join(root, ".claude", "skills");
if (existsSync(cursorSkills)) {
  rmSync(claudeSkills, { recursive: true, force: true });
  cpSync(cursorSkills, claudeSkills, { recursive: true });
  console.log("Mirrored .cursor/skills -> .claude/skills");
} else {
  console.warn("sync-pinescript-agents: .cursor/skills not found; skipped skill mirror.");
}

rmSync(tmp, { recursive: true, force: true });
console.log("Done.");
