import Messaging from '../messaging'

export default class LocalStorageModule {
    init() {
        return Messaging.receiveMessages('localStorage')
    }
}
