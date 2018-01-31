import FileSystem from './filesystem'

let output = null;

const dirName = 'large-files';

function readLargeFilesDir() {
    return FileSystem.listEntries(dirName)
        .then((entries) => {
            writeToOutput('Existing files:');
            const names = entries.map(entry => entry.name);
            names.forEach(name => writeToOutput(name));
            return names;
        });
}

function testSavingLargeFiles(existingFiles) {
    if (existingFiles.indexOf('bbb_sunflower_1080p_60fps_stereo_abl.mp4') < 0) {
        testSavingLargeFile('http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_60fps_stereo_abl.mp4', 'bbb_sunflower_1080p_60fps_stereo_abl.mp4');
    }
}

function writeToOutput(text) {
    console.log(text);
    const line = document.createElement("p");
    line.textContent = text;
    output.appendChild(line);
}

function testSavingLargeFile(url, name) {
    writeToOutput(`Downloading ${url}`);
    fetch(url)
        .then((response) => {
            writeToOutput(`Saving file ${name}`);
            return FileSystem.saveFile(name, response.body, dirName);
        })
        .then((fileUrl) => writeToOutput(`File ${name} saved with success ${fileUrl}`))
        .catch((error) => {
            console.error(error);
            writeToOutput(error);
        });
}

function init() {
    output = document.querySelector('output');
    readLargeFilesDir()
        .then(testSavingLargeFiles);
}

document.addEventListener("DOMContentLoaded", init);
