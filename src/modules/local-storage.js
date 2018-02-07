import messaging from '../messaging'

export default class LocalStorageModule {
    init() {
        return messaging.receiveMessages('localStorage').then(receiver => {
            receiver.on('message', this.handleMessage.bind(this));
        })
    }

    handleMessage(message) {
        console.log(`${this.constructor.name} - handleMessage(${JSON.stringify(message)})`);
    }
}
