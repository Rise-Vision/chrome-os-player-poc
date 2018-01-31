import FileSystem from './filesystem'

function testSavingLargeFiles() {
    testSavingLargeFile('http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_60fps_stereo_abl.mp4', 'bbb_sunflower_1080p_60fps_stereo_abl.mp4');
}

function testSavingLargeFile(url, name) {
    console.log(`Downloading ${url}`);
    fetch(url)
        .then((response) => {
            console.log(`Saving file ${name}`);
            return FileSystem.saveFile(name, response.body);
        })
        .then((fileUrl) => console.log(`File ${name} saved with success ${fileUrl}`))
        .catch(console.error);
}

function init() {
    testSavingLargeFiles();
}

document.addEventListener("DOMContentLoaded", init);
