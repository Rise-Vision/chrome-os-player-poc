import EventEmitter from 'eventemitter3'

class MessagingClient {

    constructor(moduleName, bus) {
        this.moduleName = moduleName;
        this.bus = bus;
    }

    broadcastMessage(message) {
        console.log(`${this.constructor.name} ${this.moduleName} - broadcastMessage(${message})`);
        this.bus.emit('message', message);
    }

    getClientList() {
        console.log(`${this.constructor.name} ${this.moduleName} - getClientList()`);
        this.bus.emit('clientlist-request');
    }

    toMessagingService(message) {
        console.log(`${this.constructor.name} ${this.moduleName} - toMessagingService(${message})`);
        this.bus.emit("message", Object.assign({}, message, {through: "ms"}));
    }

    toLocalWS(message) {
        console.log(`${this.constructor.name} ${this.moduleName} - toLocalWS(${message})`);
        this.bus.emit("message", Object.assign({}, message, {through: "ws"}));
    }

    receiveMessages() {
        console.log(`${this.constructor.name} ${this.moduleName} - receiveMessages()`);
        const receiver = new EventEmitter();
        this.bus.on('message', (message) => {
            console.log(`${this.constructor.name} ${this.moduleName} - got a message: ${JSON.stringify(message)}`);
            receiver.emit("message", message);
        });
        return receiver;
    }
}

class Messaging {

    constructor() {
        this.clientList = [];
        this.bus = new EventEmitter();
    }

    connect(moduleName) {
        console.log(`${this.constructor.name} - connect(${moduleName})`);
        const client = new MessagingClient(moduleName, this.bus);
        this.clientList.push(client);
        return Promise.resolve(client);
    }

    disconnect() {
        console.log(`${this.constructor.name} - disconnect()`);
        this.clientList = [];
        // broadcast disconnect?
        return Promise.resolve();
    }

    broadcastMessage(message) {
        console.log(`${this.constructor.name} - broadcastMessage(${message})`);
        this.clientList.forEach((client) => {
            client.broadcastMessage(message);
        });
        return Promise.resolve();
    }

    broadcastToLocalWS(message) {
        console.log(`${this.constructor.name} - broadcastToLocalWS(${message})`);
        this.clientList.forEach((client) => {
            client.toLocalWS(message);
        });
        return Promise.resolve();
    }

    getClientList(moduleName) {
        console.log(`${this.constructor.name} - getClientList()`);
        const moduleClient = this.clientList.find(client => client.moduleName === moduleName);
        if (moduleClient) {
            moduleClient.getClientList();
        }
        return Promise.resolve(moduleClient);
    }

    sendToMessagingService(message) {
        console.log(`${this.constructor.name} - sendToMessagingService(${message})`);
        const moduleClient = this.clientList.find(client => client.moduleName === message.from);
        if (moduleClient) {
            moduleClient.toMessagingService(message);
        }
        return Promise.resolve(moduleClient);
    }

    receiveMessages(moduleName) {
        console.log(`${this.constructor.name} - receiveMessages(${moduleName})`);
        const moduleClient = this.clientList.find(client => client.moduleName === moduleName);
        if (moduleClient) {
            // heartbeat.startHeartbeatInterval(moduleName);
            return Promise.resolve(moduleClient.receiveMessages());
        }
        return this.connect(moduleName).then(client => client.receiveMessages());
    }

}

export default new Messaging();
