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

function serialize(obj) {
    const str = [];

    for (const prop in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            str.push(`${encodeURIComponent(prop)}=${encodeURIComponent(obj[prop])}`);
        }
    }

    return str.join("&");
}

function getParams() {
    return {
        key: "AIzaSyDXHFGBZ0dS-h00TXW9tSuk1bBkg8C6lzQ",
        majorDimension: "ROWS",
        valueRenderOption: "FORMATTED_VALUE"
    };
}

function getUrl() {
    const baseUrl = "https://sheets.googleapis.com/v4/spreadsheets/";
    const key = "1NeuRyASBAR_av3csTrPa3fq5mwjgzCIe6M5FQVntvsA";
    const sheet = "Medal of Honor Recipients";
    const range = "";

    return `${baseUrl}${key}/values/${encodeURIComponent(sheet)}${range}`;
}

function onSheetResponse(resp) {
    console.log("onSheetResponse", resp);
    if (resp && resp.response) {
        console.log("Data retrieved", resp.values);
    }
}

function onSheetError(error) {
    console.log("onSheetError");
    try {
        const response = JSON.parse(error.message);

        if (response.status) {
            if (response.status === 429) { // eslint-disable-line no-magic-numbers
                console.log("quota exceeded");
                return;
            }

            console.log("Request error", response.statusText, response.status);
        }
    } catch (err) {} // eslint-disable-line no-empty
}

registerServiceWorker()
    .then(() => {
        const init = {
            method: "GET",
            mode: "cors",
            cache: "no-cache"
        };

        const params = "?" + serialize(getParams());
        const url = getUrl() + params;
        const req = new Request(url, init);

        return fetch(req);
    })
    .then((response)=>{
        console.log("got response", response);
        if (response.ok) {
            return Promise.resolve(response);
        }
        return Promise.reject(new Error(JSON.stringify({
            status: response.status,
            statusText: `The request failed with status code: ${response.status}`
        })));
    })
    .then((response) => {
        return response.json();
    })
    .then((json)=> {
        onSheetResponse(json);
    })
    .catch((error)=>{
        onSheetError(error);
    });
