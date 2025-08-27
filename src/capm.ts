import nodeFetch from "node-fetch";
import path from "path";
import fs from "fs";
import {promisify} from "util";
import {error, info, success} from "signale";
import {Octokit} from "@octokit/action";
import {context} from "@actions/github";
import {
    createBranchIfNotExists,
    createOrUpdateFile,
    createPRComment,
    getFile,
    getRepoName,
    getRepoOwner,
    getSourceBranch,
    isPullRequest,
    updateComment
} from "./github";

const BRANCH_NAME = '_capm_reports';
const streamPipeline = promisify(require('stream').pipeline);

function getBinaryName() {
    const binaries: { [platform: string]: string } = {
        'darwin': 'capm-macos',
        'win32': 'capm.exe',
        'linux': 'capm-linux'
    };
    if (process.env.RUNNER_OS) {
        const platform = process.env.RUNNER_OS.toLowerCase();
        if (platform in binaries) {
            return binaries[platform];
        }
    }
    if (process.platform in binaries) {
        return binaries[process.platform];
    }
    return binaries['linux'];
}

async function getLatestBinaryUrl() {
    const latestUrl = 'https://github.com/getcapm/capm/releases/latest';
    const res = await nodeFetch(latestUrl);
    const downloadUrl = res.url.replace('/tag/', '/download/');
    return `${downloadUrl}/${getBinaryName()}`;
}

export async function downloadCapmBinary(version: string): Promise<string> {
    let binaryUrl;
    if (version === 'latest') {
        binaryUrl = await getLatestBinaryUrl();
    } else {
        binaryUrl = `https://github.com/getcapm/capm/releases/download/${version}/${getBinaryName()}`;
    }
    info(`Downloading binary from URL: ${binaryUrl}`);
    const response = await nodeFetch(binaryUrl);

    const filename = path.join(__dirname, getBinaryName());
    await streamPipeline(response.body, fs.createWriteStream(filename));
    fs.chmodSync(filename, '777');
    success(`Binary downloaded: ${filename}`);
    return filename;
}

export async function updateRepository(octokit: Octokit) {
    const owner = getRepoOwner(context);
    const repo = getRepoName(context);
    const branch = getSourceBranch();
    if (!owner || !repo || !branch) {
        error('Could not determine repository owner, name, or branch');
        process.exit(1);
    }
    try {
        await updateReportsBranch(octokit, owner, repo);
    } catch (e: unknown) {
        error('Failed to update reports branch');
        if (e instanceof Error) {
            error(`Reason: ${e.message}`);
        }
    }
    if (isPullRequest()) {
        try {
            await updatePullRequestComment(octokit, owner, repo, branch);
        } catch (e: unknown) {
            error('Failed to update pull request comment');
            if (e instanceof Error) {
                error(`Reason: ${e.message}`);
            }
        }
    }
}

async function updateReportsBranch(octokit: Octokit, owner: string, repo: string) {
    await createBranchIfNotExists(octokit, owner, repo, BRANCH_NAME);
}

async function updatePullRequestComment(octokit: Octokit, owner: string, repo: string, branch: string) {
    const prNumber = context.payload.pull_request?.number;
    if (prNumber) {
        const actionStateFile = await getFile(octokit, owner, repo, BRANCH_NAME, `${branch}/action.json`);
        if (actionStateFile) {
            const fileContent = Buffer.from(actionStateFile.content, 'base64').toString('utf-8');
            const actionState = JSON.parse(fileContent) as ActionState;
            const commentId = actionState.commentId;
            info(`Updating existing comment with ID: ${commentId}`);
            await updateComment(octokit, owner, repo, prNumber, "CAPM CONTENT HERE", commentId);
        } else {
            info('State file not found, creating new comment');
            const commentId = await createPRComment(octokit, owner, repo, prNumber, "CAPM CONTENT HERE");
            const actionState: ActionState = {commentId: commentId};
            const actionStateJson = JSON.stringify(actionState);
            await createOrUpdateFile(octokit, owner, repo, BRANCH_NAME, 'Update by CAPM',
                `${branch}/action.json`, actionStateJson);
        }
    }
}