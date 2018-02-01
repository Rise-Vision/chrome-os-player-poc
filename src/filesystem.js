const FIFTY_GIG = 50 * 1024 * 1024 * 1024; // eslint-disable-line no-magic-numbers

const FileSystem = {

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
        return new Promise((resolve, reject) => {
            window.webkitRequestFileSystem(window.PERSISTENT, this.initialSize, resolve, reject);
        });
    },

    getDirectory(fs, name = 'modules', create = false) {
        return new Promise((resolve, reject) => {
            fs.root.getDirectory(name, {create}, resolve, reject);
        });
    },

    createDirectory(fs, name = 'modules') {
        return this.getDirectory(fs, name, true);
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
