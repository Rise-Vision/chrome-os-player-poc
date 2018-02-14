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

function update(request, response) {
    if (request.url.startsWith('http://localhost:8080')) {
        console.log('Skipping cache of local large file');
        return Promise.resolve(response);
    }

    return caches.open(CACHE).then((cache) => {
        return cache.put(request, response.clone()).then(() => {
            return response;
        });
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
    const request = event.request;
    event.respondWith(fromNetwork(request, 400)
        .then((response) => update(request, response))
        .catch(() => {
            return fromCache(request);
        }));
});
