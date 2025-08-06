import fs from "fs";
import {getInput} from "@actions/core";
import {exec} from "@actions/exec";
import {downloadCapmBinary} from "./capm";
import {version} from "./version";
import signale, {fatal, info, success} from "signale";

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
    const exitCode = await exec(capmBinary, ['run'], {ignoreReturnCode: true});
    if (exitCode === 0) {
        success('Done!');
    } else {
        fatal(`CAPM exited with code ${exitCode}`);
    }
    fs.unlinkSync(capmBinary);
    process.exit(exitCode);
}

main();
