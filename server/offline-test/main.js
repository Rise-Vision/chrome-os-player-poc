function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('Service worker not supported');
        return;
    }

    return navigator.serviceWorker.register('sw.js')
        .then(() => {
            console.log('Registered');
        })
        .catch((error) => {
            console.log('Registration failed:', error);
        });
}

registerServiceWorker()
    .then(() => {
        return fetch('http://localhost:8080/ten_mega.png');
    })
    .then(response => response.blob())
    .then((blob) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.src = url;
        document.body.appendChild(image);
    });
