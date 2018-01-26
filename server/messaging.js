const channel = new BroadcastChannel('local-messaging-module')

channel.onmessage = function(e) {
  console.log('Local messaging received', e.data);
};

channel.postMessage('Local messaging has started');
