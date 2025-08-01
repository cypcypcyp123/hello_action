const { execSync } = require("child_process");

function getCurrentBranch() {
	return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
}

function extractModule(branchName, versionData) {
	const moduleKeys = Object.keys(versionData)
		.filter((key) => typeof versionData[key] === "object")
		.sort((a, b) => b.length - a.length);

	const matchedKey = moduleKeys.find((key) =>
		new RegExp(key, "i").test(branchName)
	);

	if (!matchedKey) {
		throw new Error(
			`无法匹配模块: ${branchName} (可用: ${moduleKeys.join(", ")})`
		);
	}

	return matchedKey.toLowerCase();
}

module.exports = (versionData) => {
	try {
		const branch = getCurrentBranch();
		const moduleKey = extractModule(branch, versionData);
		const version = versionData[moduleKey].version;

		if (!version) {
			throw new Error(`模块 ${moduleKey} 缺少 version 字段`);
		}

		return version;
	} catch (error) {
		console.error("[ERROR]", error.message);
		process.exit(1);
	}
};
