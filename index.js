const core = require("@actions/core");
const axios = require("axios");
const simpleGit = require("simple-git");
const getBaseVersion = require("./get-base-version");

// 计算新标签
async function calculateTag(baseVersion, versionType) {
	const git = simpleGit();
	const tags = await git.tags();
	const pattern = new RegExp(`^${baseVersion}-${versionType}\\.(\\d+)$`);

	const matchedTags = tags.all
		.filter((tag) => pattern.test(tag))
		.map((tag) => parseInt(tag.match(pattern)[1]))
		.sort((a, b) => b - a);

	return `${baseVersion}-${versionType}.${matchedTags[0] + 1 || 1}`;
}

// 验证标签是否同步到服务器
async function verifyTagOnServer(
	tagName,
	giteaServer,
	giteaToken,
	maxAttempts = 5
) {
	const apiUrl = `${giteaServer}/api/v1/repos/base/sc-ui/git/refs/tags/${encodeURIComponent(
		tagName
	)}`;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			await axios.get(apiUrl, {
				headers: { Authorization: `Bearer ${giteaToken}` },
				timeout: 5000,
			});
			return true;
		} catch (error) {
			if (attempt < maxAttempts) {
				const delay = Math.pow(2, attempt) * 1000;
				core.info(`🔄 等待标签同步 (${delay}ms)`);
				await new Promise((resolve) => setTimeout(resolve, delay));
			} else {
				throw new Error(`标签同步失败: ${error.message}`);
			}
		}
	}
}

async function run() {
	try {
		// 获取所有输入
		const versionType = core.getInput("version-type");
		const giteaToken = core.getInput("GITEA_TOKEN");
		const giteaServer = core.getInput("GITEA_SERVER");
		const workflowFile = core.getInput("workflow-file");

		// 解析版本数据
		const versionData = JSON.parse(core.getInput("version-data"));
		if (!versionData[versionType]) {
			throw new Error(`版本类型 ${versionType} 不存在于输入数据`);
		}

		// 获取基础版本
		const baseVersion = getBaseVersion(versionData);
		core.info(`✅ 基础版本: ${baseVersion}`);

		// 计算新标签
		const newTag = await calculateTag(baseVersion, versionType);
		core.info(`✅ 新标签: ${newTag}`);

		// 创建并推送标签
		const git = simpleGit();
		await git.addAnnotatedTag(newTag, `Release ${newTag}`);
		await git.pushOrigin(newTag);
		core.info(`✅ 标签已推送`);

		// 验证标签同步
		await verifyTagOnServer(newTag, giteaServer, giteaToken);
		core.info(`✅ 标签已同步到服务器`);

		// 触发工作流
		const apiUrl = `${giteaServer}/api/v1/repos/base/sc-ui/actions/workflows/${encodeURIComponent(
			workflowFile
		)}/dispatches`;
		await axios.post(
			apiUrl,
			{
				ref: `refs/tags/${newTag}`,
				inputs: { tag: newTag },
			},
			{
				headers: {
					Authorization: `Bearer ${giteaToken}`,
					"Content-Type": "application/json",
				},
				timeout: 15000,
			}
		);

		core.setOutput("new-tag", newTag);
		core.info("🎉 发布流程完成");
	} catch (error) {
		core.setFailed(`❌ 发布失败: ${error.message}`);
		if (error.response) {
			core.error(`API 错误: ${JSON.stringify(error.response.data)}`);
		}
	}
}

run();
