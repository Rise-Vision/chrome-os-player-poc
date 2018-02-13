const CACHE = 'offline-viewer-poc';

const staticContent = [
    '/rise-andre/offline-test/index.html',
    '/rise-andre/offline-test/main.js'
];

function precache() {
    return caches.open(CACHE).then((cache) => {
        return cache.addAll(staticContent);
    });
}

function fromCache(request) {
    return caches.open(CACHE).then((cache) => {
        return cache.match(request).then((matching) => {
            return matching || Promise.reject(new Error('no-match'));
        });
    });
}

function fromNetwork(request, timeout) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(reject, timeout);
        fetch(request).then((response) => {
            clearTimeout(timeoutId);
            resolve(response);
        }, reject);
    });
}

self.addEventListener('install', (event) => {
    console.log('Service worker installing...');
    console.log(event);
    event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
    console.log('Service worker activating...');
    console.log(event);
});

self.addEventListener('push', (event) => {
    console.log('Service worker push...');
    console.log(event);
});

self.addEventListener('sync', (event) => {
    console.log('Service worker sync...');
    console.log(event);
});

self.addEventListener('fetch', (event) => {
    console.log('Service worker fetch...');
    console.log(event);
    event.respondWith(fromNetwork(event.request, 400).catch(() => {
        return fromCache(event.request);
    }));
});
