function setUpMessaging() {
    let appWindow = null;
    let appOrigin = null;

    function receiveMessage(event) {
        if (!appWindow || !appOrigin) {
            appWindow = event.source;
            appOrigin = event.origin;
        }
        if (!event.data) {
            return;
        }

        const message = event.data;
        console.log(`webview - received message: ${JSON.stringify(message)}`);

        if (message.from === 'player' && message.topic === 'hello') {
            sendMessageToApp({
                from: 'viewer',
                topic: 'hello'
            });
            window.RiseVision.Viewer.Utils.reportViewerConfigToPlayer();
        }
    }

    window.addEventListener('message', receiveMessage);

    function sendMessageToApp(message, origin = appOrigin) {
        if (appWindow) {
            console.log(`webview - sending message to chrome app ${origin} ${JSON.stringify(message)}`);
            if (!message.from) {
                message.from = 'viewer';
            }

            appWindow.postMessage(message, origin)
        } else {
            console.log("ERROR: don't have container app info - no initial message received");
        }
    }

    window.postToPlayer = sendMessageToApp;

    window.sendMessageToApp = sendMessageToApp;
}

function generateScriptText(fn) {
    // Escape double-quotes.
    // Insert newlines correctly.
    const fnText = fn.toString()
        .replace(/"/g, '\\"')
        .replace(/(\r?\n|\r)/g, '\\n');

    const scriptText = `(function() {
        var script = document.createElement("script");
        script.innerHTML = "(function() { (${fnText})(); })()"
        document.body.appendChild(script);
        })()`;
    return scriptText;
}

export default generateScriptText(setUpMessaging);
