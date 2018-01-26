console.log("Someday I'll be the watchdog module");

fetch('http://192.168.0.12:9000/rise.jpg')
    .then(() => {
        console.log(`rise.jpg download succeeded`);
    })
    .catch((error) => {
        console.error('Error downloading rise.jpg from a web worker', error);
    });

// The following lines will not work when the module is loaded as Web Worker
chrome.runtime.getPlatformInfo((platformInfo) => {
    console.log(`I can get the platform info ${JSON.stringify(platformInfo)}`);
});

chrome.system.cpu.getInfo((cpuInfo) => {
    console.log(`I can get the CPU info ${JSON.stringify(cpuInfo)}`);
});

chrome.system.memory.getInfo((memoryInfo) => {
    console.log(`I can get the memory info ${JSON.stringify(memoryInfo)}`);
});
