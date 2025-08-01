const core = require("@actions/core");
const axios = require("axios");
const simpleGit = require("simple-git");
const { getVersionType, getBaseVersion } = require("./get-base-version");

async function calculateTag(baseVersion, versionType) {
	const git = simpleGit();
	const tags = await git.tags();
	const pattern = new RegExp(`^${baseVersion}-${versionType}\\.(\\d+)$`);

	const lastNumber =
		tags.all
			.filter((tag) => pattern.test(tag))
			.map((tag) => parseInt(tag.match(pattern)[1]))
			.sort((a, b) => b - a)[0] || 0;

	return `${baseVersion}-${versionType}.${lastNumber + 1}`;
}

async function run() {
	try {
		// 解析输入
		const versionData = JSON.parse(core.getInput("version-data"));
		const giteaToken = core.getInput("GITEA_TOKEN");
		const giteaServer = core.getInput("GITEA_SERVER");

		// 自动确定版本类型
		const versionType = getVersionType(versionData);
		const baseVersion = getBaseVersion(versionData);

		core.info(`🔍 自动识别: ${versionType} 版本`);
		core.info(`🔄 基础版本: ${baseVersion}`);

		// 计算并创建标签
		const newTag = await calculateTag(baseVersion, versionType);
		const git = simpleGit();
		await git.addAnnotatedTag(newTag, `Release ${newTag}`);
		await git.pushOrigin(newTag);
		core.info(`✅ 新标签: ${newTag}`);

		// 触发工作流
		const response = await axios.post(
			`${giteaServer}/api/v1/repos/base/sc-ui/actions/workflows/${encodeURIComponent(
				core.getInput("workflow-file")
			)}/dispatches`,
			{
				ref: `refs/tags/${newTag}`,
				inputs: { tag: newTag },
			},
			{
				headers: {
					Authorization: `Bearer ${giteaToken}`,
					"Content-Type": "application/json",
				},
			}
		);

		core.setOutput("new-tag", newTag);
		core.info(`🎉 成功触发工作流 (状态码: ${response.status})`);
	} catch (error) {
		core.setFailed(`💥 发布失败: ${error.message}`);
		if (error.response) {
			core.error(`服务端响应: ${JSON.stringify(error.response.data)}`);
		}
	}
}

run();
