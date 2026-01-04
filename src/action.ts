import fs from "fs";
import {getInput} from "@actions/core";
import {exec} from "@actions/exec";
import {downloadCapmBinary, updateRepository} from "./capm";
import {version} from "./version";
import signale, {fatal, info, success} from "signale";
import {Octokit} from "@octokit/action";

signale.config({
    displayTimestamp: true
});

async function main() {
    info(`CAPM-action, version: ${version.revision}`);
    const capmVersion = getInput('capm_version') || 'latest';
    const capmBinary = await downloadCapmBinary(capmVersion);
    info(`CAPM binary: ${capmBinary}`);
    info('CAPM version:');
    await exec(capmBinary, ['--version']);
    info('Running CAPM...');
    const exitCode = await exec(capmBinary, ['check', '--show-output'], {ignoreReturnCode: true});
    if (exitCode === 0) {
        success('Done!');
    } else {
        fatal(`CAPM exited with code ${exitCode}`);
    }
    const octokit = new Octokit({auth: getInput('token')});
    await updateRepository(octokit);
    fs.unlinkSync(capmBinary);
    process.exit(exitCode);
}

main();
