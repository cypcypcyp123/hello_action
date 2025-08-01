const core = require("@actions/core");
const axios = require("axios");
const simpleGit = require("simple-git");
const getBaseVersion = require("./get-base-version");

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
			core.info(`✅ Tag verified (attempt ${attempt}/${maxAttempts})`);
			return true;
		} catch (error) {
			if (attempt < maxAttempts) {
				const delay = Math.pow(2, attempt) * 1000;
				core.info(
					`🔄 Tag not synced, waiting ${delay}ms (${attempt}/${maxAttempts})`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
			} else {
				throw new Error(
					`Tag ${tagName} not synced after ${maxAttempts} attempts`
				);
			}
		}
	}
}

async function run() {
	try {
		// Get inputs
		const versionType = core.getInput("version-type");
		const giteaToken = core.getInput("GITEA_TOKEN");
		const giteaServer = core.getInput("GITEA_SERVER");
		const workflowFile = core.getInput("workflow-file");

		core.startGroup("🚀 Starting publish process");

		// 1. Get base version
		const baseVersion = getBaseVersion();
		core.info(`✅ Base version: ${baseVersion}`);

		// 2. Calculate new tag
		const newTag = await calculateTag(baseVersion, versionType);
		core.info(`✅ New tag: ${newTag}`);

		// 3. Create and push tag
		const git = simpleGit();
		await git.addAnnotatedTag(newTag, `Release ${newTag}`);
		await git.push("origin", newTag);
		core.info(`✅ Tag created and pushed`);

		// 4. Verify tag on server
		await verifyTagOnServer(newTag, giteaServer, giteaToken);
		core.info(`✅ Tag verified on server`);

		// 5. Trigger workflow
		const apiUrl = `${giteaServer}/api/v1/repos/base/sc-ui/actions/workflows/${encodeURIComponent(
			workflowFile
		)}/dispatches`;

		core.info(`⚡ Triggering workflow: ${workflowFile}`);
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

		core.info("🎉 Publish process completed successfully");
		core.setOutput("new-tag", newTag);
		core.endGroup();
	} catch (error) {
		core.setFailed(`❌ Publish failed: ${error.message}`);
		if (error.response) {
			core.error(
				`API Error: ${error.response.status} - ${JSON.stringify(
					error.response.data
				)}`
			);
		}
	}
}

run();
