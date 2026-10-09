import nodeFetch from "node-fetch";
import path from "path";
import fs from "fs";
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
} from "./github.ts";
import {ActionState} from "./entities/ActionState.ts";
import signale from "signale";
import {promisify} from "node:util";
import stream from "node:stream";
import * as os from "node:os";

const BRANCH_NAME = '_capm_reports';
const streamPipeline = promisify(stream.pipeline);

function getProcessorArchitecture(): 'arm' | 'intel' {
    const arch = os.arch();
    if (arch === 'arm64' || arch === 'arm') {
        return 'arm';
    } else {
        return 'intel';
    }
}

function getBinaryName() {
    const binaries: { [platform: string]: string } = {
        'darwin-arm': 'capm-macos-arm',
        'darwin-intel': 'capm-macos-x86_64',
        'win32-intel': 'capm.exe',
        'linux-arm': 'capm-linux-arm64',
        'linux-intel': 'capm-linux-x86_64',
    };
    const arch = getProcessorArchitecture();
    if (process.env.RUNNER_OS) {
        const platform = `${process.env.RUNNER_OS.toLowerCase()}-${arch}`;
        if (platform in binaries) {
            return binaries[platform];
        }
    }
    const platform = `${process.platform}-${arch}`;
    if (platform in binaries) {
        return binaries[platform];
    }
    return binaries['linux-intel'];
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
    signale.info(`Downloading binary from URL: ${binaryUrl}`);
    const response = await nodeFetch(binaryUrl);
    const filename = path.join(import.meta.dirname, getBinaryName());
    await streamPipeline(response.body!, fs.createWriteStream(filename));
    fs.chmodSync(filename, '777');
    signale.success(`Binary downloaded: ${filename}`);
    return filename;
}

export async function updateRepository(octokit: Octokit, content: string) {
    const owner = getRepoOwner(context);
    const repo = getRepoName(context);
    const branch = getSourceBranch();
    if (!owner || !repo || !branch) {
        signale.error('Could not determine repository owner, name, or branch');
        process.exit(1);
    }
    try {
        await updateReportsBranch(octokit, owner, repo);
    } catch (e: unknown) {
        signale.error('Failed to update reports branch');
        if (e instanceof Error) {
            signale.error(`Reason: ${e.message}`);
        }
    }
    if (isPullRequest()) {
        try {
            await updatePullRequestComment(octokit, owner, repo, branch, content);
        } catch (e: unknown) {
            signale.error('Failed to update pull request comment');
            if (e instanceof Error) {
                signale.error(`Reason: ${e.message}`);
            }
        }
    }
}

async function updateReportsBranch(octokit: Octokit, owner: string, repo: string) {
    await createBranchIfNotExists(octokit, owner, repo, BRANCH_NAME);
}

async function updatePullRequestComment(octokit: Octokit, owner: string, repo: string, branch: string,
                                        content: string) {
    const prNumber = context.payload.pull_request?.number;
    if (prNumber) {
        const actionStateFile = await getFile(octokit, owner, repo, BRANCH_NAME, `${branch}/action.json`);
        if (actionStateFile) {
            const fileContent = Buffer.from(actionStateFile.content, 'base64').toString('utf-8');
            const actionState = JSON.parse(fileContent) as ActionState;
            const commentId = actionState.commentId;
            signale.info(`Updating existing comment with ID: ${commentId}`);
            await updateComment(octokit, owner, repo, prNumber, content, commentId);
        } else {
            signale.info('State file not found, creating new comment');
            const commentId = await createPRComment(octokit, owner, repo, prNumber, content);
            const actionState: ActionState = {commentId: commentId};
            const actionStateJson = JSON.stringify(actionState);
            await createOrUpdateFile(octokit, owner, repo, BRANCH_NAME, 'Update by CAPM',
                `${branch}/action.json`, actionStateJson);
        }
    }
}