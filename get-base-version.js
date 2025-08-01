// ci_scripts/get-base-version.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// 获取当前分支名
function getCurrentBranch() {
  return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
}

// 从分支名提取模块名
function extractModule(branchName) {
  const versionMap = JSON.parse(fs.readFileSync("version-map.json", "utf8"));

  // 提取所有模块key（过滤注释和非对象值）
  const moduleKeys = Object.entries(versionMap)
    .filter(([key, value]) => typeof value === "object" && !key.startsWith("//"))
    .map(([key]) => key);

  // 按匹配优先级排序
  moduleKeys.sort((a, b) => b.length - a.length);

  // 不区分大小写匹配
  const matchedKey = moduleKeys.find(key => new RegExp(key, "i").test(branchName));

  if (!matchedKey) {
    throw new Error(`分支名 "${branchName}" 未包含有效模块名。可用模块: ${moduleNames.join(", ")}`);
  }

  return matchedKey.toLowerCase(); // 统一返回小写key
}

// 获取模块版本
function getVersion(moduleKey) {
  const filePath = path.resolve(__dirname, "../version-map.json");
  const versionMap = JSON.parse(fs.readFileSync(filePath, "utf8"));

  const moduleData = versionMap[moduleKey.toLowerCase()];
  if (!moduleData?.version) {
    throw new Error(`模块 "${moduleKey}" 未在version-map.json中定义`);
  }

  return moduleData.version;
}

// 主逻辑
module.exports = () => {
  try {
    const branch = getCurrentBranch();
    const moduleKey = extractModule(branch);
    const version = getVersion(moduleKey);

    console.log(`分支: ${branch} → 模块: ${module} → 版本: ${version}`);
    return version;
  } catch (error) {
    console.error("[Error]", error.message);
    process.exit(1);
  }
};
