import FileSystem from './filesystem'
import LocalStorageModule from './modules/local-storage'
import messaging from './messaging'

const packagedModules = [new LocalStorageModule()];
const remoteModules = [];

class RemoteModule {

    constructor(name, worker, messagingClient) {
        this.name = name;
        this.worker = worker;
        this.messagingClient = messagingClient;
        this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));
        this.messagingClient.receiveMessages((receiver) => {
            receiver.on('message', this.handleLocalMessage.bind(this));
        });
    }

    postMessage(message) {
        this.worker.postMessage(message);
    }

    shutdown() {
        console.log(`${this.constructor.name} - shutdown ${this.name}`);
        this.worker.terminate();
    }

    handleWorkerMessage(message) {
        console.log(`${this.constructor.name} ${this.name} - Handling worker message - ${JSON.stringify(message.data)}`);
        this.messagingClient.broadcastMessage(message.data);
    }

    handleLocalMessage(message) {
        console.log(`${this.constructor.name} ${this.name} - Handling local message - ${JSON.stringify(message.data)}`);
        if (message.from !== this.name) {
            this.worker.postMessage(message);
        }
    }
}

function saveModuleFile(name, response) {
    return FileSystem.saveFile(name, response.body);
}

function loadModuleScript(name, fileUrl) {
    console.log(`Loading module script ${name} from ${fileUrl}`);

    // return loadModuleAsScriptTag(name, fileUrl);
    return loadModuleAsWorker(name, fileUrl);
}

function loadModuleAsWorker(name, fileUrl) {
    const worker = new Worker(fileUrl);
    return messaging.connect(name).then((client) => {
        remoteModules.push(new RemoteModule(name, worker, client));
        return name;
    });
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
    remoteModules.forEach(module => {
        module.shutdown();
    });
    return Promise.resolve();
}

function initModule(name, url) {
    return fetch(url)
        .then(response => saveModuleFile(`${name}.js`, response))
        .then(fileUrl => loadModuleScript(name, fileUrl))
}

function initModules() {
    packagedModules.forEach(module => module.init());
    remoteModules.forEach(module => module.postMessage({from: 'installer', topic: 'startup'}));
}

function installModules(modules) {
    return uninstallModules()
        .then(() => {
            const promises = Object.keys(modules).map(moduleName => initModule(moduleName, modules[moduleName]))
            return serialPromises(promises);
        })
        .then(() => initModules())
        .then(() => FileSystem.listEntries())
        .then((entries) => {
            console.log('All modules have been loaded from manifest:');
            console.log(JSON.stringify(modules, null, 2));
            console.log('Files:');
            console.log(entries);
        })
        .catch(console.error);
}

function serialPromises(tasks) {
    return tasks.reduce((promiseChain, currentTask) => {
        return promiseChain.then(chainResults =>
            currentTask.then(currentResult => [...chainResults, currentResult])
        );
    }, Promise.resolve([]))
}

const Installer = {installModules}

export default Installer;
