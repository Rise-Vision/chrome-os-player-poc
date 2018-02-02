import FileSystem from './filesystem'

let output = null;

const dirName = 'large-files';

function readLargeFilesDir() {
    return FileSystem.listEntries(dirName)
        .then((entries) => {
            const list = document.getElementById('files');
            entries.forEach(entry => {
                console.log(entry);
                entry.file((file) => {
                    const item = document.createElement('li');
                    const itemText = `${file.name}, ${file.type}, ${humanFileSize(file.size)}, ${file.lastModifiedDate}`;
                    if (file.type.startsWith('image') || file.type.startsWith('video')) {
                        item.innerHTML = `<a href="${entry.toURL()}" data-src="${entry.toURL()}" data-type="${file.type}">${itemText}</a>`;
                        item.addEventListener('click', openLink);
                    } else {
                        item.textContent = `${file.name}, ${file.type}, ${humanFileSize(file.size)}, ${file.lastModifiedDate}`
                    }
                    list.appendChild(item);
                });
            });
            return entries.map(entry => entry.name);
        });
}

function humanFileSize(fileBytes) {
    let bytes = fileBytes;
    const thresh = 1024;
    if (Math.abs(bytes) < thresh) {
        return `${bytes} B`;
    }
    const units = ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return `${bytes.toFixed(1)} ${units[u]}`;
}

function openLink(e) {
    if (!e.target.hasAttribute('data-src') || !e.target.hasAttribute('data-type')) {
        return;
    }
    e.preventDefault();
    const url = e.target.getAttribute('data-src');
    const type = e.target.getAttribute('data-type');
    chrome.app.window.create(
        'webview.html',
        {hidden: true},
        (appWin) => {
            appWin.contentWindow.addEventListener('DOMContentLoaded', (e) => {
                let tag = 'p';
                if (type.startsWith('image')) {
                    tag = 'img';
                } else if (type.startsWith('video')) {
                    tag = 'video';
                }
                const element = appWin.contentWindow.document.createElement(tag);
                element.src = url;
                appWin.contentWindow.document.body.appendChild(element);
                appWin.show();
            }
        );
    });
}

function testSavingLargeFiles(existingFiles) {
    // const files = ['ten_mega.png', 'fifty_mega.mp4', 'one_hundred_mega.webm', 'one_and_a_half_gig.mp4'];
    const files = ['ten_mega.png', 'fifty_mega.mp4'];
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

function launchViewer(event) {
    const displayIdInput = document.getElementById('displayId');
    const displayId = displayIdInput.value;
    if (!displayId) {
        return;
    }

    event.preventDefault();

    getWindowOptions().then((windowOptions) => {
        const viewerUrl = `http://rvashow.appspot.com/Viewer.html?player=true&type=display&id=${displayId}`;
        chrome.app.window.create(
            'viewer.html',
            {id: 'viewer', hidden: true, state: 'maximized', innerBounds: windowOptions},
            (appWin) => {
                appWin.contentWindow.addEventListener('DOMContentLoaded', () => {
                    const webview = appWin.contentWindow.document.querySelector('webview');
                    webview.style.height = `${windowOptions.height}px`;
                    webview.style.width = '100%';
                    webview.src = viewerUrl;
                    appWin.show();
                }
            );
        });
    });   
}

function getWindowOptions() {
    return new Promise((resolve) => {
        chrome.system.display.getInfo((displays) => {
            const windowOptions = {};
            displays.forEach((display) => {
                if (display.bounds.left === 0 && display.bounds.top === 0) {
                    windowOptions.width = display.bounds.width;
                    windowOptions.height = display.bounds.height;
                }
            });
            resolve(windowOptions);
        });
    });
}

function init() {
    output = document.querySelector('output');

    const launchViewerButton = document.getElementById('launchViewer');
    launchViewerButton.addEventListener('click', launchViewer);

    chrome.storage.local.get("launchData", ({launchData}) => {
        console.log(launchData);
        // FileSystem.kioskMode = launchData.isKioskSession;

        readLargeFilesDir().then(testSavingLargeFiles);
    });
}

document.addEventListener("DOMContentLoaded", init);
