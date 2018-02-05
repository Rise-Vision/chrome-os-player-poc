const moduleName = 'logging';

self.onmessage = (event) => {
    const message = event.data;
    console.log(`${moduleName} - received message: ${JSON.stringify(message)}`);
    if (message.from === 'installer' && message.topic === 'startup') {
        run();
    } else {
        handleLogMessage(message)
    }
}

function handleLogMessage(message) {
    if (message.topic === "log") {
        console.log(`${moduleName} - call logger to log ${message}`);
    }
}

function run() {
    console.log(`${moduleName} - started`);
}
