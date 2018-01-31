import FileSystem from './filesystem'

let output = null;

function testSavingLargeFiles() {
    testSavingLargeFile('http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_60fps_stereo_abl.mp4', 'bbb_sunflower_1080p_60fps_stereo_abl.mp4');
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
            return FileSystem.saveFile(name, response.body);
        })
        .then((fileUrl) => writeToOutput(`File ${name} saved with success ${fileUrl}`))
        .catch((error) => {
            console.error(error);
            writeToOutput(error);
        });
}

function init() {
    output = document.querySelector('output');
    testSavingLargeFiles();
}

document.addEventListener("DOMContentLoaded", init);
