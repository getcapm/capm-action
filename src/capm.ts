import nodeFetch from "node-fetch";
import path from "path";
import fs from "fs";
import {promisify} from "util";
import {info, success} from "signale";

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