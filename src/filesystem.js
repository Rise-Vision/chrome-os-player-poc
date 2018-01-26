const FIFTY_GIG = 50 * 1024 * 1024 * 1024; // eslint-disable-line no-magic-numbers

const FileSystem = {

    initialSize: FIFTY_GIG,

    saveFile(name, contents) {
        return this.requestFileSystem()
            .then(this.createDirectory)
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

    createDirectory(fs, name = 'modules') {
        return new Promise((resolve, reject) => {
            fs.root.getDirectory(name, {create: true}, resolve, reject);
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

                fileWriter.onwriteend = resolve
                fileWriter.onerror = reject
                fileWriter.onprogress = (progress) => {
                    console.log(`File write progress type ${progress.type} loaded ${progress.loaded}, total: ${progress.total}`);
                }
                fileWriter.write(contents);

                // return processChunkedContents(contents, fileWriter);
            });
        });
    }
};

// TODO Test this with large files
function processChunkedContents(contents, fileWriter) {
    const reader = contents.getReader()
    return readChunk();
  
    function readChunk() {
      return reader.read().then(writeChunks);
    }
  
    function writeChunks({ value, done }) {
        return new Promise((resolve, reject) => {
            if (done) {
                console.log('returning')
                return resolve();
            }

            fileWriter.onwriteend = readChunk;
            fileWriter.write(new Blob(value));
        });
    }
}

export default FileSystem;
