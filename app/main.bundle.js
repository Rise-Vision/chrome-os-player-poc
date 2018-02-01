/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 3);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
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
    const fileWriteableStream = new WritableStream({
        write(chunk) {
          return new Promise((resolve, reject) => {
            fileWriter.onwriteend = resolve
            fileWriter.onerror = reject
            fileWriter.onprogress = (progress) => {
                console.log(`File write progress type ${progress.type} loaded ${progress.loaded}, total: ${progress.total}`);
            }
            fileWriter.write(new Blob(chunk));
          });
        }
      });
    return contents.pipeTo(fileWriteableStream);
}

/* harmony default export */ __webpack_exports__["a"] = (FileSystem);


/***/ }),
/* 1 */,
/* 2 */,
/* 3 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__filesystem__ = __webpack_require__(0);


let output = null;

const dirName = 'large-files';

function readLargeFilesDir() {
    return __WEBPACK_IMPORTED_MODULE_0__filesystem__["a" /* default */].listEntries(dirName)
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
            return __WEBPACK_IMPORTED_MODULE_0__filesystem__["a" /* default */].saveFile(name, response.body, dirName);
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


/***/ })
/******/ ]);