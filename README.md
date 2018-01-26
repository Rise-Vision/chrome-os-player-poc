# Chrome OS Player PoC [![Circle CI](https://circleci.com/gh/Rise-Vision/chrome-os-player-poc.svg?style=svg)](https://circleci.com/gh/Rise-Vision/chrome-os-player-poc)

## Introduction
This is a proof of concept

## Development

### Local Development Environment Setup and Installation

*  Clone repository:
```bash
git clone https://github.com/Rise-Vision/chrome-os-player-poc.git
```

*  Install:
```bash
npm install
```

* Build:
```bash
npm run watch
```

* Edit the files under `src`. Webpack will generate a `main.js` file into `app`. This directory contains all the files required for the packaged app.

* Load the packaged app directory `app` on `chrome://extensions`
