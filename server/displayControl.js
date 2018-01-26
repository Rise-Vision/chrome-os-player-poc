console.log("Someday I'll be the display control module");

const moduleName = 'display-control';
let displayId = null;

self.onmessage = (event) => {
    const message = event.data;
    console.log(`Display control module received message: ${JSON.stringify(message)}`);
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
    sendWatchMessage();
}
