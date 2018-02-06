const moduleName = 'twitter';
let displayId = null;

self.onmessage = (event) => {
    const message = event.data;
    console.log(`${moduleName} - received message: ${JSON.stringify(message)}`);
    if (message.from === 'installer' && message.topic === 'startup') {
        displayId = message.displayId;
        run();
    } else {
        handleMessage(message);
    }
}

function handleMessage(message) {
    console.log(`${moduleName} - handleMessage ${JSON.stringify(message)}`);
}

function sendTweets() {
    setInterval(() => {
        self.postMessage({
            from: moduleName,
            topic: "twitter-update",
            data: {id: 1234, text: "blabla"}
        });
    }, 4000);
}

function run() {
    console.log(`${moduleName} - started`);
    sendTweets();
    logExternal('started');
}

function logExternal(event) {
    self.postMessage({
        from: moduleName,
        topic: "log",
        data: {event}
    });
}
