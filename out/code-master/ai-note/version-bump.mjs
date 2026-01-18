import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

// read minAppVersion from obsidian-plugin.json and bump version to target version
let obsidianPluginJson = JSON.parse(readFileSync("manifest.json", "utf8"));
obsidianPluginJson["minAppVersion"] = targetVersion;
writeFileSync("manifest.json", JSON.stringify(obsidianPluginJson, null, "\t"));

// update versions.json with target version
let versionsJson = JSON.parse(readFileSync("versions.json", "utf8"));
versionsJson[targetVersion] = targetVersion;
writeFileSync("versions.json", JSON.stringify(versionsJson, null, "\t"));
