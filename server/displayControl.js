const moduleName = 'displayControl';
let displayId = null;

self.onmessage = (event) => {
    const message = event.data;
    console.log(`${moduleName} - received message: ${JSON.stringify(message)}`);
    if (message.from === 'installer' && message.topic === 'startup') {
        displayId = message.displayId;
        run();
    }
}

function sendWatchMessage() {
    const filesToWatch = ['screen-control.txt', 'content.json'];
    filesToWatch.forEach(name => {
        const filePath = `risevision-display-notifications/${displayId}/${name}`;
        self.postMessage({
            from: moduleName,
            topic: "watch",
            filePath
        });
    });
}

function run() {
    console.log(`${moduleName} - started`);
    sendWatchMessage();
    logExternal('started');
}

function logExternal(event) {
    self.postMessage({
        from: moduleName,
        topic: "log",
        data: {event}
    });
}
