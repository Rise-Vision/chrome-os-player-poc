import FileSystem from './filesystem'
import Installer from './installer'

function createHelloWorldWindow() {
    // Center window on screen.
    const screenWidth = screen.availWidth;
    const screenHeight = screen.availHeight;
    const width = 600;
    const height = 500;

    const options = {
        id: "helloWorldID",
        outerBounds: {
          width,
          height,
          left: Math.round((screenWidth - width) / 2),
          top: Math.round((screenHeight - height) / 2)
        }
    };

    chrome.app.window.create('index.html', options, (mainWindow) => {
        mainWindow.onClosed.addListener(() => chrome.power.releaseKeepAwake());
    });
}

function init(launchData) {
    console.log(launchData);
    chrome.storage.local.set({launchData});

    // FileSystem.kioskMode = launchData.isKioskSession;

    createHelloWorldWindow();

    const modules = {
        logging: 'https://raw.githubusercontent.com/Rise-Vision/chrome-os-player-poc/master/server/logging.js',
        watchdog: 'https://raw.githubusercontent.com/Rise-Vision/chrome-os-player-poc/master/server/watchdog.js',
        displayControl: 'https://raw.githubusercontent.com/Rise-Vision/chrome-os-player-poc/master/server/displayControl.js',
        twitter: 'https://raw.githubusercontent.com/Rise-Vision/chrome-os-player-poc/master/server/twitter.js'
    };

    const channel = new BroadcastChannel('local-messaging-module');

    Installer.installModules(modules).then(() => {
        channel.postMessage('App has started');
    });

    chrome.permissions.getAll((permissions) => {console.log(`permissions ${JSON.stringify(permissions)}`);});
}

chrome.app.runtime.onLaunched.addListener(init);

chrome.power.requestKeepAwake('display');

