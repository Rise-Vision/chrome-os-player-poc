import webviewMessagingFn from './webview-messaging'

function init() {
    window.addEventListener('message', (event) => {
        console.log(event);
        if (!event.data) {
            return;
        }

        event.preventDefault();
        const message = event.data;
        if (message.from === 'messaging-component') {
            console.log(`viewer window is broadcasting message from webview: ${JSON.stringify(event.data)}`);
            chrome.runtime.sendMessage(event.data);
        }
    });

    const webview = document.querySelector('webview');
    webview.addEventListener('loadstop', () => {
        webview.executeScript({code: webviewMessagingFn});
        webview.contentWindow.postMessage({from: 'player', topic: 'hello'}, webview.src);
    });

    function handleMessage(message) {
        if (message.from === 'player') {
            console.log(`viewer window received message from player, sending it to webview: ${JSON.stringify(message)}`);
            webview.contentWindow.postMessage(message, webview.src);
        }
    }

    const closeButton = document.getElementById('close');
    closeButton.addEventListener('click', () => window.close());

    const screenshotButton = document.getElementById('screenshot');
    screenshotButton.addEventListener('click', (ev) => {
        ev.preventDefault();
        webview.captureVisibleRegion((dataUrl) => {
            console.log(dataUrl);
        });
    });

    chrome.runtime.onMessage.addListener(handleMessage);
}


document.addEventListener("DOMContentLoaded", init);
