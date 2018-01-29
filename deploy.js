#!/usr/bin/env node

const program = require('commander');
const fs = require("fs");

const spawnSync = require("child_process").spawnSync;
const credentialsPath = "private-keys/poc-credentials.json";
function utf8() {return {encoding: "utf8"};}
const credentials = JSON.parse(fs.readFileSync(credentialsPath, utf8()));
const appId = process.env.CIRCLE_BRANCH === "master" ? credentials.production_app_id_no_restart : credentials.test_app_id;
const manifestFilePath = "dist/manifest.json";

program
  .version('0.0.1')
  .option('-i, --increment-version', 'Increment the packaged app version on manifest.json', incrementVersion)
  .option('-p, --publish', 'Upload dist/app.zip and publish it to Chrome Web Store', publish)
  .parse(process.argv);

function incrementVersion() {
  const d = new Date();
  const manifest = JSON.parse(fs.readFileSync(manifestFilePath, {encoding: "utf8"}));
  const dayMinutes = d.getHours() * 60 + d.getMinutes();
  const dayPct = dayMinutes / 1440;

  const patch = parseInt(((dayPct) + "").split(".")[1].substr(0,4)) + 1000;
  manifest.version = (d.getFullYear() - 2000) + "." + (d.getMonth() + 1) + "." +  d.getDate() + "." + patch;

  const publishVersion = manifest.version;

  console.log(`Writing version ${publishVersion} to manifest.json`);

  fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2), {encoding: "utf8"});
}


function publish() {

  const accessTokenRequest = spawnSync("curl", ["--data",
  "client_id=" + credentials.client_id +
  "&client_secret=" + credentials.client_secret +
  "&refresh_token=" + credentials.refresh_token + 
  "&grant_type=refresh_token",
  "https://www.googleapis.com/oauth2/v4/token"], utf8());

  const accessToken = JSON.parse(accessTokenRequest.stdout).access_token;

  console.log("Uploading...");

  const chromeWebStoreUploadRequest = spawnSync("curl", [
  "-H", "Authorization: Bearer " + accessToken, 
  "-H", "x-goog-api-version: 2",
  "-X", "PUT",
  "-T", "dist/app.zip",
  "-vv",
  "https://www.googleapis.com/upload/chromewebstore/v1.1/items/" + appId]);
    
  console.log(JSON.parse(chromeWebStoreUploadRequest.stdout.toString()).uploadState);

  if (chromeWebStoreUploadRequest.stdout.toString().indexOf("FAILURE") > -1) {
    console.log(chromeWebStoreUploadRequest.stdout.toString());
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFilePath, {encoding: "utf8"}));
  console.log("Publishing version " + manifest.version);
  
  const chromeWebStorePublishRequest = spawnSync("curl", [
  "-H", "Authorization: Bearer " + accessToken, 
  "-H", "x-goog-api-verison: 2",
  "-H", "Content-Length: 0",
  "-X", "POST",
  "-vv",
  "-fail",
  "https://www.googleapis.com/chromewebstore/v1.1/items/" + appId + "/publish"]);

  console.log(chromeWebStorePublishRequest.stdout.toString());
  
  process.exit(chromeWebStorePublishRequest.status);
}

