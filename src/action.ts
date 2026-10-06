import fs from "fs";
import {getInput} from "@actions/core";
import {exec, getExecOutput} from "@actions/exec";
import {downloadCapmBinary, updateRepository} from "./capm.ts";
import Version from "./version.ts";
import signale from "signale";
import {Octokit} from "@octokit/action";

signale.config({
    displayTimestamp: true
});

async function main() {
    signale.info(`CAPM-action, version: ${Version.gitSha.substring(0, 7)}`);
    const capmVersion = getInput('capm_version') || 'latest';
    const capmBinary = await downloadCapmBinary(capmVersion);
    signale.info(`CAPM binary: ${capmBinary}`);
    signale.info('CAPM version:');
    await exec(capmBinary, ['--version']);
    signale.info('Running CAPM...');
    const execOutput = await getExecOutput(capmBinary, ['check', '--show-output', '--format', 'markdown'],
        {ignoreReturnCode: true});
    const exitCode = execOutput.exitCode;
    if (exitCode === 0) {
        signale.success('Done!');
    } else {
        signale.fatal(`CAPM exited with code ${exitCode}`);
    }
    console.log(execOutput.stdout);
    if (process.env.GITHUB_ACTION) {
        const octokit = new Octokit({auth: getInput('token')});
        await updateRepository(octokit, execOutput.stdout);
    }
    fs.unlinkSync(capmBinary);
    process.exit(exitCode);
}

main();
