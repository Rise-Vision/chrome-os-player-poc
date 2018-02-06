import PrimusMS from "./lib/primus-ms";

const INITIAL_CONNECTION_TIMEOUT = 20 * 1000;
const MSConnection = {};
const messageHandlers = [];

let connection = null;
let connectivity = false;
let initialConnectionTimer = null;

MSConnection.init = () => {
    const testDisplayId = "YSD5WEDW339F";
    const testMachineId = "ee2abcc8e5893da424ae5ec20c930ff4";
    const msEndpoint = `https://services.risevision.com/messaging/primus/`;
    const msUrl = `${msEndpoint}?displayId=${testDisplayId}&machineId=${testMachineId}`;

    return new Promise((res) => {
        MSConnection.disconnect();

        console.log("Attempting MS connection");

        connection = PrimusMS.connect(msUrl, {
            reconnect: {
                max: 1800000,
                min: 2000,
                retries: Infinity
            },
            manual: true
        });

        connection.on("open", () => {
            clearTimeout(initialConnectionTimer);
            connectivity = true;
            console.log("MS connected");

            res();
        });

        connection.on("close", () => {
            console.log("MS connection closed");
        });

        connection.on("end", () => {
            connectivity = false;
            console.log("MS disconnected");
        });

        connection.on("error", (error) => {
            console.log("MS error", error.stack);
        });

        connection.on("data", (data) => {
            console.log(`Received data: ${JSON.stringify(data)}`);
            messageHandlers.forEach((handler) => {
                handler(data);
            });
        });

        initialConnectionTimer = setTimeout(() => {
            res();
        }, INITIAL_CONNECTION_TIMEOUT);

        connection.open();
    });
};

MSConnection.disconnect = () => {
    if (connection) {
        connection.end();
    }
};

MSConnection.write = (message) => {
    if (connection) {
        const msg = typeof message === "string" ? {msg: message} : message;
        connection.write(msg);
    }
};

MSConnection.receiveMessages = (action) => {
    messageHandlers.push((data) => {
        action(data);
    });
};

MSConnection.canConnect = () => {
    return connectivity;
};

export default MSConnection;
