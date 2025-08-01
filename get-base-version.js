const { execSync } = require("child_process");

// 获取当前git分支
function getCurrentBranch() {
	return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
}

// 从分支名解析版本类型
function getVersionType(versionData) {
	const branch = getCurrentBranch().toLowerCase();
	const availableTypes = Object.keys(versionData).filter(
		(key) => typeof versionData[key] === "object"
	);

	// 按匹配优先级排序（长名称优先）
	const matchedType = availableTypes
		.sort((a, b) => b.length - a.length)
		.find((type) => branch.includes(type.toLowerCase()));

	if (!matchedType) {
		throw new Error(
			`分支名 "${branch}" 不包含有效版本类型\n可用类型: ${availableTypes.join(
				", "
			)}`
		);
	}

	return matchedType;
}

// 获取基础版本号
function getBaseVersion(versionData) {
	const versionType = getVersionType(versionData);
	const version = versionData[versionType]?.version;

	if (!version) {
		throw new Error(`在 version-data 中找不到 ${versionType} 的版本号`);
	}

	return version;
}

module.exports = { getVersionType, getBaseVersion };
