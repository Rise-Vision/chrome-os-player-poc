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
/******/ 	return __webpack_require__(__webpack_require__.s = 1);
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
/* 1 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__installer__ = __webpack_require__(2);


function createHelloWorldWindow() {
    // Center window on screen.
    const screenWidth = screen.availWidth;
    const screenHeight = screen.availHeight;
    const width = 600;
    const height = 500;

    chrome.app.window.create('index.html', {
      id: "helloWorldID",
      outerBounds: {
        width,
        height,
        left: Math.round((screenWidth - width) / 2),
        top: Math.round((screenHeight - height) / 2)
      }
    });
}

function init() {
    createHelloWorldWindow();

    const modules = {
        messaging: 'https://raw.githubusercontent.com/Rise-Vision/chrome-os-player-poc/master/server/messaging.js',
        logging: 'https://raw.githubusercontent.com/Rise-Vision/chrome-os-player-poc/master/server/logging.js',
        watchdog: 'https://raw.githubusercontent.com/Rise-Vision/chrome-os-player-poc/master/server/watchdog.js',
        displayControl: 'https://raw.githubusercontent.com/Rise-Vision/chrome-os-player-poc/master/server/displayControl.js'
    };

    const channel = new BroadcastChannel('local-messaging-module');

    __WEBPACK_IMPORTED_MODULE_0__installer__["a" /* default */].installModules(modules).then(() => {
        channel.postMessage('App has started');
    });

    chrome.permissions.getAll((permissions) => {console.log(`permissions ${JSON.stringify(permissions)}`);});
}

chrome.app.runtime.onLaunched.addListener(init);


/***/ }),
/* 2 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__filesystem__ = __webpack_require__(0);


const installedModules = [];

function saveModuleFile(name, response) {
    return __WEBPACK_IMPORTED_MODULE_0__filesystem__["a" /* default */].saveFile(name, response.body);
}

function loadModuleScript(name, fileUrl) {
    console.log(`Loading module script ${name} from ${fileUrl}`);

    // return loadModuleAsScriptTag(name, fileUrl);
    return loadModuleAsWorker(name, fileUrl);
}

function loadModuleAsWorker(name, fileUrl) {
    const worker = new Worker(fileUrl);
    worker.postMessage({from: 'installer', topic: 'startup'});
    worker.addEventListener('message', handleWorkerMessage)
    installedModules.push(worker);
    return name;
}

function handleWorkerMessage(message) {
    console.log(`Message received ${JSON.stringify(message.data)}`);
}

function loadModuleAsScriptTag(name, fileUrl) {
    const script = document.createElement('script');
    script.onload = function() {
        console.log(`Module ${name} has been loaded`);
    };
    script.src = fileUrl;

    document.head.appendChild(script);

    return name;
}

function uninstallModules() {
    installedModules.forEach(worker => {
        worker.terminate();
    });
    return Promise.resolve();
}

function initModule(name, url) {
    return fetch(url)
        .then(response => saveModuleFile(name, response))
        .then(fileUrl => loadModuleScript(name, fileUrl))
}

function installModules(modules) {
    const funcs = Object.keys(modules).map(moduleName => () => initModule(`${moduleName}.js`, modules[moduleName]))
    const installModulesPromises = serialPromises(funcs);

    return uninstallModules()
        .then(installModulesPromises)
        .then(() => __WEBPACK_IMPORTED_MODULE_0__filesystem__["a" /* default */].listEntries())
        .then((entries) => {
            console.log('All modules have been loaded from manifest:');
            console.log(JSON.stringify(modules, null, 2));
            console.log('Files:');
            console.log(entries);
        })
        .catch(console.error);
}

function serialPromises(funcs) {
    return funcs.reduce((promise, func) => promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([]));
}

const Installer = {installModules}

/* harmony default export */ __webpack_exports__["a"] = (Installer);


/***/ })
/******/ ]);