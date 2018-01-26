import FileSystem from './filesystem'

const installedModules = [];

function saveModuleFile(name, response) {
    return response.blob().then((blob) => {
        console.log(`Blob read from module ${name} response`);
        return FileSystem.saveFile(name, blob);
    });
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
        .then(() => console.log(`all modules have been loaded from manifest ${JSON.stringify(modules)}`))
        .catch(error => console.error(error));
}

function serialPromises(funcs) {
    return funcs.reduce((promise, func) => promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([]));
}

const Installer = {installModules}

export default Installer;
