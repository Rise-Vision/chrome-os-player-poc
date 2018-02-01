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
    const files = ['ten_mega.png', 'fifty_mega.mp4', 'one_hundred_mega.webm', 'one_and_a_half_gig.mp4'];
    const baseUrl = 'https://storage.googleapis.com/rise-andre/';

    files.forEach((file) => {
        if (existingFiles.indexOf(file) < 0) {
            testSavingLargeFile(`${baseUrl}${file}`, file);
        }
    });
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
    readLargeFilesDir().then(testSavingLargeFiles);
}

document.addEventListener("DOMContentLoaded", init);
