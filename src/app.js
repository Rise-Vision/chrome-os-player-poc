import Installer from './installer'

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
        messaging: 'http://localhost:9000/messaging.js',
        logging: 'http://localhost:9000/logging.js',
        watchdog: 'http://localhost:9000/watchdog.js',
        displayControl: 'http://localhost:9000/displayControl.js'
    };

    const channel = new BroadcastChannel('local-messaging-module');

    Installer.installModules(modules).then(() => {
        channel.postMessage('App has started');
    });

    chrome.permissions.getAll((permissions) => {console.log(`permissions ${JSON.stringify(permissions)}`);});
}

chrome.app.runtime.onLaunched.addListener(init);
