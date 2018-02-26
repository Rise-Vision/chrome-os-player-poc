import FileSystem from './filesystem';
import MSConnection from './ms-connection';
import WSC from './lib/wsc-chrome.min';

let output = null;

const dirName = 'large-files';

function readLargeFilesDir() {
    return FileSystem.listEntries(dirName)
        .then((entries) => {
            const list = document.getElementById('files');
            list.innerHTML = '';
            entries.forEach(entry => {
                console.log(entry);
                entry.file((file) => {
                    const item = document.createElement('li');
                    const itemText = `${file.name}, ${file.type}, ${humanFileSize(file.size)}, ${file.lastModifiedDate}`;
                    if (file.type.startsWith('image') || file.type.startsWith('video') || file.type.startsWith('text/html')) {
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
            appWin.contentWindow.addEventListener('DOMContentLoaded', () => {
                if (type.startsWith('image')) {
                    const img = appWin.contentWindow.document.createElement('img');
                    img.src = url;
                    appWin.contentWindow.document.body.appendChild(img);
                } else if (type.startsWith('video')) {
                    const video = appWin.contentWindow.document.createElement('video');
                    video.src = url;
                    appWin.contentWindow.document.body.appendChild(video);
                } else if (type.startsWith('text/html')) {
                    const webview = appWin.contentWindow.document.querySelector('webview');
                    webview.src = url;
                }

                appWin.show();
            }
        );
    });
}

function testSavingLargeFiles(existingFiles) {
    console.log(`testSavingLargeFiles, existing: ${JSON.stringify(existingFiles)}`);
    const files = ['ten_mega.png', 'rise.jpg'];
    const baseUrl = 'https://storage.googleapis.com/rise-andre/';

    const promises = [];
    files.forEach((file) => {
        if (existingFiles.indexOf(file) < 0) {
            promises.push(testSavingLargeFile(`${baseUrl}${file}`, file));
        }
    });

    return Promise.all(promises);
}

function writeToOutput(text) {
    console.log(text);
    const line = document.createElement("p");
    line.textContent = text;
    output.appendChild(line);
}

function testSavingLargeFile(url, name) {
    writeToOutput(`Downloading ${url}`);
    return fetch(url)
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

    let viewerUrl = `http://rvashow.appspot.com/Viewer.html?player=true&type=display&id=${displayId}`;
    const offline = document.getElementById('offline').checked;
    if (offline) {
        viewerUrl = chrome.runtime.getURL(`local-viewer/viewer/localviewer/main/Viewer.html?player=true&type=display&id=${displayId}`);
    }

    createViewerWindowWithUrl(viewerUrl);
}

function createViewerWindowWithUrl(url) {
    console.log(`creating viewer window with url: ${url}`);
    getWindowOptions().then((windowOptions) => {
        chrome.app.window.create(
            'viewer.html',
            {id: 'viewer', hidden: true, state: 'maximized', innerBounds: windowOptions},
            (appWin) => {
                appWin.contentWindow.addEventListener('DOMContentLoaded', () => {
                    const webview = appWin.contentWindow.document.querySelector('webview');
                    webview.addEventListener('permissionrequest', handleViewerWebViewPermissions);
                    webview.style.height = `${windowOptions.height}px`;
                    webview.style.width = '100%';
                    console.log(`loading webview with url: ${url}`);
                    webview.src = url;

                    const closeButton = appWin.contentWindow.document.getElementById('close');
                    closeButton.addEventListener('click', () => appWin.contentWindow.close());

                    appWin.show();
                }
            );
        });
    });
}

function handleViewerWebViewPermissions(event) {
    console.log(`Permission ${event.permission} requested by webview`);
    const allowedPermissions = ['geolocation', 'filesystem', 'loadplugin'];
    if (allowedPermissions.includes(event.permission)) {
        event.request.allow();
    } else {
        event.request.deny();
    }
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

function testMSClientSocket() {
    MSConnection.init()
        .then(()=>{
            if (MSConnection.canConnect()) {
                // request a Messaging Service update on test file
                MSConnection.write({
                    from: "test-client",
                    filePath: "local-storage-test/test-1x1.png",
                    topic: "WATCH",
                    version: "0"
                });
            }
        })
}

function testAvailableDiskSpace() {
    FileSystem.getAvailableDiskSpace((usedBytes, grantedBytes, err)=>{
        if (err) {
           console.log(`Error: ${err}`);
           return;
        }
        writeToOutput(`App is using ${FileSystem.bytesToSize(usedBytes)} of ${FileSystem.bytesToSize(grantedBytes)} available disk space`);
    });
}

function setupButtons() {
    const closeAppButton = document.getElementById('closeAppButton');
    closeAppButton.addEventListener('click', () => chrome.app.window.current().close());

    const launchViewerButton = document.getElementById('launchViewer');
    launchViewerButton.addEventListener('click', launchViewer);

    const saveFileButton = document.getElementById('saveFile');
    saveFileButton.addEventListener('click', () => {
        const url = document.getElementById('url').value;
        const name = url.substring(url.lastIndexOf('/') + 1);
        testSavingLargeFile(url, name)
            .then(readLargeFilesDir);
    });

    const launchWebViewButton = document.getElementById('launchWebView');
    launchWebViewButton.addEventListener('click', (event) => {
        const url = document.getElementById('url').value;
        if (!url) {
            return;
        }
        event.preventDefault();
        createViewerWindowWithUrl(url);
    });
}

function init() {
    output = document.querySelector('output');

    setupButtons();

    chrome.storage.local.get("launchData", ({launchData}) => {
        console.log(launchData);
        // FileSystem.kioskMode = launchData.isKioskSession;

        readLargeFilesDir()
            .then(testSavingLargeFiles)
            .then(readLargeFilesDir)
            .then(() => {
                // testMSClientSocket();
                testAvailableDiskSpace();
            });
    });

    startWebServer();
    showNetworkCondition();
}

function showNetworkCondition() {
    function writeStatus() {
        writeToOutput(`Is online: ${navigator.onLine}`);
    }

    window.addEventListener('online', writeStatus);
    window.addEventListener('offline', writeStatus);
    writeStatus();
}

let webServer = null;

function startWebServer() {
    FileSystem.requestFileSystem()
        .then(fs => FileSystem.getDirectory(fs, dirName, true))
        .then((dirEntry) => {
            const options = {
                entry: dirEntry,
                renderIndex: false,
                optBackground: false,
                optAutoStart: false,
                optCORS: true,
                port: 8080
            };
            webServer = new WSC.WebApplication(options);
            webServer.start(() => {
                console.log('Webserver started');
            });
        });
}

function stopWebServer() {
    if (webServer) {
        console.log('Stopping web server');
        webServer.stop();
    }
}

chrome.app.window.onClosed.addListener(stopWebServer);
chrome.runtime.onSuspend.addListener(stopWebServer);

document.addEventListener("DOMContentLoaded", init);
