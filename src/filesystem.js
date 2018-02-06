const FIFTY_GIG = 50 * 1024 * 1024 * 1024; // eslint-disable-line no-magic-numbers

const FileSystem = {

    kioskMode: false,

    initialSize: FIFTY_GIG,

    saveFile(name, contents, dirName = 'modules') {
        return this.requestFileSystem()
            .then((fs) => this.createDirectory(fs, dirName))
            .then((dir) => {
                return this.createFile(dir, name);
            })
            .then((fileEntry) => {
                return this.writeFile(fileEntry, contents).then(() => fileEntry.toURL());
            });
    },

    requestFileSystem() {
        if (this.fs) {
            return Promise.resolve(this.fs);
        }

        const setFs = (fs) => {
            this.fs = fs;
            return fs;
        };

        if (this.kioskMode) {
            return this.requestChromeFileSystem().then(setFs);
        }
        return this.requestWebkitFileSystem().then(setFs);
    },

    requestWebkitFileSystem() {
        return new Promise((resolve, reject) => {
            window.webkitRequestFileSystem(window.PERSISTENT, this.initialSize, resolve, reject);
        });
    },

    requestChromeFileSystem() {
        function getWritableVolume() {
            return new Promise((resolve, reject) => {
                chrome.fileSystem.getVolumeList((volumes) => {
                    if (!volumes) {
                        console.log('Error getting volume list');
                        return reject(chrome.runtime.lastError);
                    }

                    const writableVolume = volumes.find(volume => volume.writable);
                    if (!writableVolume) {
                        console.log('No writable volume was found');
                        return reject(new Error('No writable volume was found'));
                    }

                    resolve(writableVolume);
                });
            });
        }

        function getFileSystem(volume) {
            return new Promise((resolve, reject) => {
                chrome.fileSystem.requestFileSystem(volume, (fs) => {
                    if (!fs) {
                        console.log('Error requesting filesystem');
                        return reject(chrome.runtime.lastError);
                    }
                    resolve(fs);
                });
            });
        }

        return getWritableVolume().then(getFileSystem);
    },

    getDirectory(fs, name = 'modules', create = false) {
        return new Promise((resolve, reject) => {
            fs.root.getDirectory(name, {create}, resolve, reject);
        });
    },

    createDirectory(fs, name = 'modules') {
        return this.getDirectory(fs, name, true);
    },

    removeDirectory(name) {
        return this.requestFileSystem()
            .then((fs) => this.getDirectory(fs, name))
            .then((dirEntry) => {
                return new Promise((resolve, reject) => {
                    dirEntry.removeRecursively(resolve, reject);
                });
            })
            .catch(() => Promise.resolve());
    },

    listEntries(dirName = 'modules') {
        return this.requestFileSystem()
            .then((fs) => this.getDirectory(fs, dirName, true))
            .then(this.readDirectoryEntries);
    },

    readDirectoryEntries(dir) {
        return new Promise((resolve, reject) => {

            const dirReader = dir.createReader();
            function readEntriesRecursively(entries = []) {
               dirReader.readEntries((results) => {
                if (results.length > 0) {
                    readEntriesRecursively([...entries, ...results]);
                } else {
                    resolve(entries.sort());
                }
              }, reject);
            }

            readEntriesRecursively();
        });
    },

    createFile(dir, name) {
        return new Promise((resolve, reject) => {
            dir.getFile(name, {create: true}, resolve, reject);
        });
    },

    writeFile(fileEntry, contents) {
        return new Promise((resolve, reject) => {
            fileEntry.createWriter((fileWriter) => {
                processChunkedContents(contents, fileWriter).then(resolve).catch(reject);
            });
        });
    },

    bytesToSize(bytes) {
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        if (bytes === 0) { return "n/a"; }

        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
        if (i === 0) return `${bytes} ${sizes[i]})`;
        return `${(bytes / (1024 ** i)).toFixed(1)} ${sizes[i]}`;
    },

    getAvailableDiskSpace(cb) {
        navigator.webkitPersistentStorage.queryUsageAndQuota (
            function(usedBytes, grantedBytes) {
                cb(usedBytes, grantedBytes);
            },
            function(err) {
                cb(null,null,err);
            }
        );
    }
};

function processChunkedContents(contents, fileWriter) {
    fileWriter.onprogress = (progress) => {
        console.log(`File write progress type ${progress.type} loaded ${progress.loaded}, total: ${progress.total}`);
    };

    const fileWriteableStream = new WritableStream({
        write(chunk) {
            return new Promise((resolve, reject) => {
                fileWriter.seek(fileWriter.length);
                fileWriter.onwriteend = resolve
                fileWriter.onerror = reject
                fileWriter.write(new Blob([chunk]));
            });
        }
    });
    return contents.pipeTo(fileWriteableStream);
}

export default FileSystem;
