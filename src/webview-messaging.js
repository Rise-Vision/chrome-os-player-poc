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
                from: 'messaging-component',
                topic: 'hello'
            });
        }
    }

    window.addEventListener('message', receiveMessage);

    function sendMessageToApp(message, origin = appOrigin) {
        if (appWindow) {
            console.log(`webview - sending message to chrome app ${origin} ${JSON.stringify(message)}`);
            appWindow.postMessage(message, origin)
        } else {
            console.log("ERROR: don't have container app info - no initial message received");
        }
    }

    window.sendMessageToApp = sendMessageToApp;
}

function generateScriptText(fn) {
    // Escape double-quotes.
    // Insert newlines correctly.
    const fnText = fn.toString()
        .replace(/"/g, '\\"')
        .replace(/(\r?\n|\r)/g, '\\n');

    const scriptText =
        '(function() {\n' +
        '  var script = document.createElement("script");\n' +
        '  script.innerHTML = "(function() { (' + fnText + ')(); })()" \n' +
        '  document.body.appendChild(script);\n' +
        '})()';
    return scriptText;
}

export default generateScriptText(setUpMessaging);
