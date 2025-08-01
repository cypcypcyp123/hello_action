const { execSync } = require("child_process");

// 获取当前分支名
function getCurrentBranch() {
	return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
}

// 从分支名提取模块名
function extractModule(branchName, versionData) {
	// 提取所有模块key（过滤非对象值）
	const moduleKeys = Object.entries(versionData)
		.filter(([key, value]) => typeof value === "object")
		.map(([key]) => key);

	// 按匹配优先级排序（更长的key优先）
	moduleKeys.sort((a, b) => b.length - a.length);

	// 不区分大小写匹配
	const matchedKey = moduleKeys.find((key) =>
		new RegExp(key, "i").test(branchName)
	);

	if (!matchedKey) {
		throw new Error(
			`分支名 "${branchName}" 未包含有效模块名。可用模块: ${moduleKeys.join(
				", "
			)}`
		);
	}

	return matchedKey.toLowerCase(); // 统一返回小写key
}

// 主逻辑
module.exports = (versionData) => {
	try {
		const branch = getCurrentBranch();
		const moduleKey = extractModule(branch, versionData);
		const version = versionData[moduleKey].version;

		console.log(`分支: ${branch} → 模块: ${moduleKey} → 版本: ${version}`);
		return version;
	} catch (error) {
		console.error("[Error]", error.message);
		process.exit(1);
	}
};
