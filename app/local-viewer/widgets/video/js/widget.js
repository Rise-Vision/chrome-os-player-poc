/* exported WIDGET_COMMON_CONFIG */
var WIDGET_COMMON_CONFIG = {
  AUTH_PATH_URL: "v1/widget/auth",
  LOGGER_CLIENT_ID: "1088527147109-6q1o2vtihn34292pjt4ckhmhck0rk0o7.apps.googleusercontent.com",
  LOGGER_CLIENT_SECRET: "nlZyrcPLg6oEwO9f9Wfn29Wh",
  LOGGER_REFRESH_TOKEN: "1/xzt4kwzE1H7W9VnKB8cAaCx6zb4Es4nKEoqaYHdTD15IgOrJDtdun6zK6XiATCKT",
  STORE_URL: "https://store-dot-rvaserver2.appspot.com/"
};
/* global WIDGET_COMMON_CONFIG */

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.LoggerUtils = (function() {
  "use strict";

   var displayId = "",
     companyId = "",
     version = null;

  /*
   *  Private Methods
   */

  /* Retrieve parameters to pass to the event logger. */
  function getEventParams(params, cb) {
    var json = null;

    // event is required.
    if (params.event) {
      json = params;

      if (json.file_url) {
        json.file_format = getFileFormat(json.file_url);
      }

      json.company_id = companyId;
      json.display_id = displayId;

      if (version) {
        json.version = version;
      }

      cb(json);
    }
    else {
      cb(json);
    }
  }

  // Get suffix for BQ table name.
  function getSuffix() {
    var date = new Date(),
      year = date.getUTCFullYear(),
      month = date.getUTCMonth() + 1,
      day = date.getUTCDate();

    if (month < 10) {
      month = "0" + month;
    }

    if (day < 10) {
      day = "0" + day;
    }

    return "" + year + month + day;
  }

  /*
   *  Public Methods
   */
  function getFileFormat(url) {
    var hasParams = /[?#&]/,
      str;

    if (!url || typeof url !== "string") {
      return null;
    }

    str = url.substr(url.lastIndexOf(".") + 1);

    // don't include any params after the filename
    if (hasParams.test(str)) {
      str = str.substr(0 ,(str.indexOf("?") !== -1) ? str.indexOf("?") : str.length);

      str = str.substr(0, (str.indexOf("#") !== -1) ? str.indexOf("#") : str.length);

      str = str.substr(0, (str.indexOf("&") !== -1) ? str.indexOf("&") : str.length);
    }

    return str.toLowerCase();
  }

  function getInsertData(params) {
    var BASE_INSERT_SCHEMA = {
      "kind": "bigquery#tableDataInsertAllRequest",
      "skipInvalidRows": false,
      "ignoreUnknownValues": false,
      "templateSuffix": getSuffix(),
      "rows": [{
        "insertId": ""
      }]
    },
    data = JSON.parse(JSON.stringify(BASE_INSERT_SCHEMA));

    data.rows[0].insertId = Math.random().toString(36).substr(2).toUpperCase();
    data.rows[0].json = JSON.parse(JSON.stringify(params));
    data.rows[0].json.ts = new Date().toISOString();

    return data;
  }

  function logEvent(table, params) {
    getEventParams(params, function(json) {
      if (json !== null) {
        RiseVision.Common.Logger.log(table, json);
      }
    });
  }

  function logEventToPlayer(table, params) {
    try {
      top.postToPlayer( {
        message: "widget-log",
        table: table,
        params: JSON.stringify(params),
        suffix: getSuffix()
      } );
    } catch (err) {
      console.log("widget-common.logEventToPlayer", err);
    }
  }

  /* Set the Company and Display IDs. */
  function setIds(company, display) {
    companyId = company;
    displayId = display;
  }

  function setVersion(value) {
    version = value;
  }

  return {
    "getInsertData": getInsertData,
    "getFileFormat": getFileFormat,
    "logEvent": logEvent,
    "logEventToPlayer": logEventToPlayer,
    "setIds": setIds,
    "setVersion": setVersion
  };
})();

RiseVision.Common.Logger = (function(utils) {
  "use strict";

  var REFRESH_URL = "https://www.googleapis.com/oauth2/v3/token?client_id=" + WIDGET_COMMON_CONFIG.LOGGER_CLIENT_ID +
      "&client_secret=" + WIDGET_COMMON_CONFIG.LOGGER_CLIENT_SECRET +
      "&refresh_token=" + WIDGET_COMMON_CONFIG.LOGGER_REFRESH_TOKEN +
      "&grant_type=refresh_token";

  var serviceUrl = "https://www.googleapis.com/bigquery/v2/projects/client-side-events/datasets/Widget_Events/tables/TABLE_ID/insertAll",
    throttle = false,
    throttleDelay = 1000,
    lastEvent = "",
    refreshDate = 0,
    token = "";

  /*
   *  Private Methods
   */
  function refreshToken(cb) {
    var xhr = new XMLHttpRequest();

    if (new Date() - refreshDate < 3580000) {
      return cb({});
    }

    xhr.open("POST", REFRESH_URL, true);
    xhr.onloadend = function() {
      var resp = {};
      try {
        resp = JSON.parse(xhr.response);
      } catch(e) {
        console.warn("Can't refresh logger token - ", e.message);
      }
      cb({ token: resp.access_token, refreshedAt: new Date() });
    };

    xhr.send();
  }

  function isThrottled(event) {
    return throttle && (lastEvent === event);
  }

  /*
   *  Public Methods
   */
  function log(tableName, params) {
    if (!tableName || !params || (params.hasOwnProperty("event") && !params.event) ||
      (params.hasOwnProperty("event") && isThrottled(params.event))) {
      return;
    }

    // don't log if display id is invalid or preview/local
    if (!params.display_id || params.display_id === "preview" || params.display_id === "display_id" ||
      params.display_id === "displayId") {
      return;
    }

    try {
      if ( top.postToPlayer && top.enableWidgetLogging ) {
        // send log data to player instead of BQ
        return utils.logEventToPlayer( tableName, params );
      }
    } catch ( e ) {
      console.log( "widget-common: logger", e );
    }

    throttle = true;
    lastEvent = params.event;

    setTimeout(function () {
      throttle = false;
    }, throttleDelay);

    function insertWithToken(refreshData) {
      var xhr = new XMLHttpRequest(),
        insertData, url;

      url = serviceUrl.replace("TABLE_ID", tableName);
      refreshDate = refreshData.refreshedAt || refreshDate;
      token = refreshData.token || token;
      insertData = utils.getInsertData(params);

      // Insert the data.
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Authorization", "Bearer " + token);

      if (params.cb && typeof params.cb === "function") {
        xhr.onloadend = function() {
          params.cb(xhr.response);
        };
      }

      xhr.send(JSON.stringify(insertData));
    }

    return refreshToken(insertWithToken);
  }

  return {
    "log": log
  };
})(RiseVision.Common.LoggerUtils);

/* global WebFont */

var RiseVision = RiseVision || {};

RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.Utilities = (function() {

  function getFontCssStyle(className, fontObj) {
    var family = "font-family: " + decodeURIComponent(fontObj.font.family).replace(/'/g, "") + "; ";
    var color = "color: " + (fontObj.color ? fontObj.color : fontObj.forecolor) + "; ";
    var size = "font-size: " + (fontObj.size.indexOf("px") === -1 ? fontObj.size + "px; " : fontObj.size + "; ");
    var weight = "font-weight: " + (fontObj.bold ? "bold" : "normal") + "; ";
    var italic = "font-style: " + (fontObj.italic ? "italic" : "normal") + "; ";
    var underline = "text-decoration: " + (fontObj.underline ? "underline" : "none") + "; ";
    var highlight = "background-color: " + (fontObj.highlightColor ? fontObj.highlightColor : fontObj.backcolor) + ";";

    return "." + className + " {" + family + color + size + weight + italic + underline + highlight + "}";
  }

  function addCSSRules(rules) {
    var style = document.createElement("style");

    for (var i = 0, length = rules.length; i < length; i++) {
      style.appendChild(document.createTextNode(rules[i]));
    }

    document.head.appendChild(style);
  }

  /*
   * Loads Google or custom fonts, if applicable, and injects CSS styles
   * into the head of the document.
   *
   * @param    array    settings    Array of objects with the following form:
 *                                   [{
 *                                     "class": "date",
 *                                     "fontSetting": {
 *                                         bold: true,
 *                                         color: "black",
 *                                         font: {
 *                                           family: "Akronim",
 *                                           font: "Akronim",
 *                                           name: "Verdana",
 *                                           type: "google",
 *                                           url: "http://custom-font-url"
 *                                         },
 *                                         highlightColor: "transparent",
 *                                         italic: false,
 *                                         size: "20",
 *                                         underline: false
 *                                     }
 *                                   }]
   *
   *           object   contentDoc    Document object into which to inject styles
   *                                  and load fonts (optional).
   */
  function loadFonts(settings, cb) {
    var families = null,
      googleFamilies = [],
      customFamilies = [],
      customUrls = [];

    function callback() {
      if (cb && typeof cb === "function") {
        cb();
      }
    }

    function onGoogleFontsLoaded() {
      callback();
    }

    if (!settings || settings.length === 0) {
      callback();
      return;
    }

    // Check for custom css class names and add rules if so
    settings.forEach(function(item) {
      if (item.class && item.fontStyle) {
        addCSSRules([ getFontCssStyle(item.class, item.fontStyle) ]);
      }
    });

    // Google fonts
    for (var i = 0; i < settings.length; i++) {
      if (settings[i].fontStyle && settings[i].fontStyle.font.type &&
        (settings[i].fontStyle.font.type === "google")) {
        // Remove fallback font.
        families = settings[i].fontStyle.font.family.split(",")[0];

        // strip possible single quotes
        families = families.replace(/'/g, "");

        googleFamilies.push(families);
      }
    }

    // Custom fonts
    for (i = 0; i < settings.length; i++) {
      if (settings[i].fontStyle && settings[i].fontStyle.font.type &&
        (settings[i].fontStyle.font.type === "custom")) {
        // decode value and strip single quotes
        customFamilies.push(decodeURIComponent(settings[i].fontStyle.font.family).replace(/'/g, ""));
        // strip single quotes
        customUrls.push(settings[i].fontStyle.font.url.replace(/'/g, "\\'"));
      }
    }

    if (googleFamilies.length === 0 && customFamilies.length === 0) {
      callback();
    }
    else {
      // Load the fonts
      for (var j = 0; j < customFamilies.length; j += 1) {
        loadCustomFont(customFamilies[j], customUrls[j]);
      }

      if (googleFamilies.length > 0) {
        loadGoogleFonts(googleFamilies, onGoogleFontsLoaded);
      }
      else {
        callback();
      }
    }
  }

  function loadCustomFont(family, url, contentDoc) {
    var sheet = null;
    var rule = "font-family: " + family + "; " + "src: url('" + url + "');";

    contentDoc = contentDoc || document;

    sheet = contentDoc.styleSheets[0];

    if (sheet !== null) {
      sheet.addRule("@font-face", rule);
    }
  }

  function loadGoogleFonts(families, cb) {
    WebFont.load({
      google: {
        families: families
      },
      active: function() {
        if (cb && typeof cb === "function") {
          cb();
        }
      },
      inactive: function() {
        if (cb && typeof cb === "function") {
          cb();
        }
      },
      timeout: 2000
    });
  }

  function loadScript( src ) {
    var script = document.createElement( "script" );

    script.src = src;
    document.body.appendChild( script );
  }

  function preloadImages(urls) {
    var length = urls.length,
      images = [];

    for (var i = 0; i < length; i++) {
      images[i] = new Image();
      images[i].src = urls[i];
    }
  }

  /**
   * Get the current URI query param
   */
  function getQueryParameter(param) {
    return getQueryStringParameter(param, window.location.search.substring(1));
  }

  /**
   * Get the query parameter from a query string
   */
  function getQueryStringParameter(param, query) {
    var vars = query.split("&"),
      pair;

    for (var i = 0; i < vars.length; i++) {
      pair = vars[i].split("=");

      if (pair[0] == param) { // jshint ignore:line
        return decodeURIComponent(pair[1]);
      }
    }

    return "";
  }

  /**
   * Get date object from player version string
   */
  function getDateObjectFromPlayerVersionString(playerVersion) {
    var reggie = /(\d{4})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})/;
    var dateArray = reggie.exec(playerVersion);
    if (dateArray) {
      return new Date(
        (+dateArray[1]),
          (+dateArray[2])-1, // Careful, month starts at 0!
        (+dateArray[3]),
        (+dateArray[4]),
        (+dateArray[5])
      );
    } else {
      return;
    }
  }

  function getRiseCacheErrorMessage(statusCode) {
    var errorMessage = "";
    switch (statusCode) {
      case 404:
        errorMessage = "The file does not exist or cannot be accessed.";
        break;
      case 507:
        errorMessage = "There is not enough disk space to save the file on Rise Cache.";
        break;
      default:
        errorMessage = "There was a problem retrieving the file from Rise Cache.";
    }

    return errorMessage;
  }

  function unescapeHTML(html) {
    var div = document.createElement("div");

    div.innerHTML = html;

    return div.textContent;
  }

  function hasInternetConnection(filePath, callback) {
    var xhr = new XMLHttpRequest();

    if (!filePath || !callback || typeof callback !== "function") {
      return;
    }

    xhr.open("HEAD", filePath + "?cb=" + new Date().getTime(), false);

    try {
      xhr.send();

      callback((xhr.status >= 200 && xhr.status < 304));

    } catch (e) {
      callback(false);
    }
  }

  /**
   * Check if chrome version is under a certain version
   */
  function isLegacy() {
    var legacyVersion = 25;

    var match = navigator.userAgent.match(/Chrome\/(\S+)/);
    var version = match ? match[1] : 0;

    if (version) {
      version = parseInt(version.substring(0,version.indexOf(".")));

      if (version <= legacyVersion) {
        return true;
      }
    }

    return false;
  }

  /**
   * Adds http:// or https:// protocol to url if the protocol is missing
   */
  function addProtocol(url, secure) {
    if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
      url = ((secure) ? "https://" : "http://") + url;
    }
    return url;
  }

  return {
    addProtocol:              addProtocol,
    getQueryParameter:        getQueryParameter,
    getQueryStringParameter:  getQueryStringParameter,
    getFontCssStyle:          getFontCssStyle,
    addCSSRules:              addCSSRules,
    loadFonts:                loadFonts,
    loadCustomFont:           loadCustomFont,
    loadGoogleFonts:          loadGoogleFonts,
    loadScript:               loadScript,
    preloadImages:            preloadImages,
    getRiseCacheErrorMessage: getRiseCacheErrorMessage,
    unescapeHTML:             unescapeHTML,
    hasInternetConnection:    hasInternetConnection,
    isLegacy:                 isLegacy,
    getDateObjectFromPlayerVersionString: getDateObjectFromPlayerVersionString
  };
})();

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.RiseCache = (function () {
  "use strict";

  var BASE_CACHE_URL = "http://localhost:9494/";

  var _pingReceived = false,
    _isCacheRunning = false,
    _isV2Running = false,
    _isHttps = true,
    _utils = RiseVision.Common.Utilities,
    _RC_VERSION_WITH_ENCODE = "1.7.3",
    _RC_VERSION = "";

  function ping(callback) {
    var r = new XMLHttpRequest(),
      /* jshint validthis: true */
      self = this;

    if (!callback || typeof callback !== "function") {
      return;
    }

    if (!_isV2Running) {
      r.open("GET", BASE_CACHE_URL + "ping?callback=_", true);
    }
    else {
      r.open("GET", BASE_CACHE_URL, true);
    }

    r.onreadystatechange = function () {
      try {
        if (r.readyState === 4 ) {
          // save this result for use in getFile()
          _pingReceived = true;

          if(r.status === 200) {
            _isCacheRunning = true;

            try {
              var responseObject = (r.responseText) ? JSON.parse(r.responseText) : "";
              if (responseObject) {
                _RC_VERSION = responseObject.version;
              }
            }
            catch(e) {
              console.log(e);
            }

            callback(true, r.responseText);
          } else if (r.status === 404) {
            // Rise Cache V2 is running
            _isV2Running = true;

            BASE_CACHE_URL = "https://localhost:9495/";

            // call ping again so correct ping URL is used for Rise Cache V2
            return self.ping(callback);
          } else {

            if ( _isHttps ) {
              _isV2Running = true;
              _isHttps = false;
              BASE_CACHE_URL = "http://localhost:9494/";

              // call ping again so correct ping URL is used for Rise Cache V2 HTTPs
              return self.ping(callback);
            } else {
              console.debug("Rise Cache is not running");
              _isV2Running = false;
              _isCacheRunning = false;

              callback(false, null);
            }
          }
        }
      }
      catch (e) {
        console.debug("Caught exception: ", e.description);
      }

    };
    r.send();
  }

  function getFile(fileUrl, callback, nocachebuster) {
    if (!fileUrl || !callback || typeof callback !== "function") {
      return;
    }

    var totalCacheRequests = 0;

    function fileRequest() {
      var url, str, separator;

      if (_isCacheRunning) {
        if (_isV2Running) {
          if ( _compareVersionNumbers( _RC_VERSION, _RC_VERSION_WITH_ENCODE ) > 0 ) {
            url = BASE_CACHE_URL + "files?url=" + fileUrl;
          } else {
            url = BASE_CACHE_URL + "files?url=" + encodeURIComponent(fileUrl);
          }
        } else {
          // configure url with cachebuster or not
          url = (nocachebuster) ? BASE_CACHE_URL + "?url=" + encodeURIComponent(fileUrl) :
          BASE_CACHE_URL + "cb=" + new Date().getTime() + "?url=" + encodeURIComponent(fileUrl);
        }
      } else {
        if (nocachebuster) {
          url = fileUrl;
        } else {
          str = fileUrl.split("?");
          separator = (str.length === 1) ? "?" : "&";
          url = fileUrl + separator + "cb=" + new Date().getTime();
        }
      }

      makeRequest("HEAD", url);
    }

    function _compareVersionNumbers( v1, v2 ) {
      var v1parts = v1.split( "." ),
        v2parts = v2.split( "." ),
        i = 0;

      function isPositiveInteger( x ) {
        return /^\d+$/.test( x );
      }

      // First, validate both numbers are true version numbers
      function validateParts( parts ) {
        for ( i = 0; i < parts.length; i++ ) {
          if ( !isPositiveInteger( parts[ i ] ) ) {
            return false;
          }
        }
        return true;
      }
      if ( !validateParts( v1parts ) || !validateParts( v2parts ) ) {
        return NaN;
      }

      for ( i = 0; i < v1parts.length; ++i ) {
        if ( v2parts.length === i ) {
          return 1;
        }

        if ( v1parts[ i ] === v2parts[ i ] ) {
          continue;
        }
        if ( v1parts[ i ] > v2parts[ i ] ) {
          return 1;
        }
        return -1;
      }

      if ( v1parts.length !== v2parts.length ) {
        return -1;
      }

      return 0;
    }

    function makeRequest(method, url) {
      var xhr = new XMLHttpRequest(),
        request = {
          xhr: xhr,
          url: url
        };

      if (_isCacheRunning) {
        xhr.open(method, url, true);

        xhr.addEventListener("loadend", function () {
          var status = xhr.status || 0;
          if (status === 202) {
              totalCacheRequests++;
              if (totalCacheRequests < 3) {
                setTimeout(function(){ makeRequest(method, url); }, 3000);
              } else {
                  callback(request, new Error("File is downloading"));
              }
          } else if (status >= 200 && status < 300) {
            callback(request);
          } else {
            // Server may not support HEAD request. Fallback to a GET request.
            if (method === "HEAD") {
              makeRequest("GET", url);
            } else {
              callback(request, new Error("The request failed with status code: " + status));
            }
          }
        });

        xhr.send();
      }
      else {
        // Rise Cache is not running (preview), skip HEAD request and execute callback immediately
        callback(request);
      }

    }

    if (!_pingReceived) {
      /* jshint validthis: true */
      return this.ping(fileRequest);
    } else {
      return fileRequest();
    }

  }

  function getErrorMessage(statusCode) {
    var errorMessage = "";
    switch (statusCode) {
      case 502:
        errorMessage = "There was a problem retrieving the file.";
        break;
      case 504:
        errorMessage = "Unable to download the file. The server is not responding.";
        break;
      case 507:
        errorMessage = "There is not enough disk space to save the file on Rise Cache.";
        break;
      case 534:
        errorMessage = "The file does not exist or cannot be accessed.";
        break;
      default:
        errorMessage = "";
    }

    return errorMessage;
  }

  function isRiseCacheRunning(callback) {
    if (!callback || typeof callback !== "function") {
      return;
    }

    if (!_pingReceived) {
      /* jshint validthis: true */
      return this.ping(function () {
        callback(_isCacheRunning);
      });
    } else {
      callback(_isCacheRunning);
    }
  }

  function isV2Running(callback) {
    if (!callback || typeof callback !== "function") {
      return;
    }

    if (!_pingReceived) {
      /* jshint validthis: true */
      return this.ping(function () {
        callback(_isV2Running);
      });
    }
    else {
      callback(_isV2Running);
    }
  }

  function isRCV2Player(callback) {
    if (!callback || typeof callback !== "function") {
      return;
    }
    /* jshint validthis: true */
    return this.isV2Running(function (isV2Running) {
      if (isV2Running) {
        callback(isV2Running);
      } else {
        callback(isV3PlayerVersionWithRCV2());
      }
    });
  }

  function isV3PlayerVersionWithRCV2() {
    var RC_V2_FIRST_PLAYER_VERSION_DATE = _utils.getDateObjectFromPlayerVersionString("2016.10.10.00.00");

    var sysInfoViewerParameter = _utils.getQueryParameter("sysInfo");
    if (!sysInfoViewerParameter) {
      // when the widget is loaded into an iframe the search has a parameter called parent which represents the parent url
      var parentParameter = _utils.getQueryParameter("parent");
      sysInfoViewerParameter = _utils.getQueryStringParameter("sysInfo", parentParameter);
    }
    if (sysInfoViewerParameter) {
      var playerVersionString = _utils.getQueryStringParameter("pv", sysInfoViewerParameter);
      var playerVersionDate = _utils.getDateObjectFromPlayerVersionString(playerVersionString);
      return playerVersionDate >= RC_V2_FIRST_PLAYER_VERSION_DATE;
    } else {
      return false;
    }
  }

  function reset() {
    _pingReceived = false;
     _isCacheRunning = false;
     _isV2Running = false;
     _isHttps = true;
    BASE_CACHE_URL = "http://localhost:9494/";
  }

  return {
    getErrorMessage: getErrorMessage,
    getFile: getFile,
    isRiseCacheRunning: isRiseCacheRunning,
    isV2Running: isV2Running,
    isRCV2Player: isRCV2Player,
    ping: ping,
    reset: reset
  };

})();

/* exported version */
var version = "1.1.0";
/* exported config */
if ( typeof angular !== "undefined" ) {
  angular.module( "risevision.common.i18n.config", [] )
    .constant( "LOCALES_PREFIX", "locales/translation_" )
    .constant( "LOCALES_SUFIX", ".json" );
}

const config = {
  STORAGE_ENV: "prod",
  COMPONENTS_PATH: "components/"
};

/* global gadgets, _ */

var RiseVision = RiseVision || {};

RiseVision.Video = {};

RiseVision.Video = ( function( window, gadgets ) {
  "use strict";

  var _additionalParams,
    _mode,
    _displayId,
    _isLoading = true,
    _configDetails = null,
    _prefs = null,
    _storage = null,
    _nonStorage = null,
    _message = null,
    _player = null,
    _viewerPaused = true,
    _resume = true,
    _currentFiles = [],
    _currentPlaylistIndex = null,
    _errorLog = null,
    _errorTimer = null,
    _errorFlag = false,
    _storageErrorFlag = false,
    _playerErrorFlag = false,
    _unavailableFlag = false;

  /*
   *  Private Methods
   */
  function _done() {
    gadgets.rpc.call( "", "rsevent_done", null, _prefs.getString( "id" ) );

    // Any errors need to be logged before the done event.
    if ( _errorLog !== null ) {
      logEvent( _errorLog, true );
    }

    logEvent( { "event": "done" }, false );
  }

  function _ready() {
    gadgets.rpc.call( "", "rsevent_ready", null, _prefs.getString( "id" ),
      true, true, true, true, true );
  }

  function _clearErrorTimer() {
    clearTimeout( _errorTimer );
    _errorTimer = null;
  }

  function _startErrorTimer() {
    _clearErrorTimer();

    _errorTimer = setTimeout( function() {
      // notify Viewer widget is done
      _done();
    }, 5000 );
  }

  function _getCurrentFile() {
    if ( _currentFiles && _currentFiles.length > 0 ) {
      if ( _mode === "file" ) {
        return _currentFiles[ 0 ];
      } else if ( _mode === "folder" ) {
        if ( _currentPlaylistIndex ) {
          // retrieve the currently played file
          return _currentFiles[ _currentPlaylistIndex ];
        }
      }
    }

    return null;
  }

  function _resetErrorFlags() {
    _errorFlag = false;
    _playerErrorFlag = false;
    _storageErrorFlag = false;
    _unavailableFlag = false;
    _errorLog = null;
  }

  /*
   *  Public Methods
   */
  function hasStorageError() {
    return _storageErrorFlag;
  }

  function hasPlayerError() {
    return _playerErrorFlag;
  }

  function showError( message, isStorageError ) {
    _errorFlag = true;
    _storageErrorFlag = typeof isStorageError !== "undefined";

    _message.show( message );

    _currentPlaylistIndex = null;

    // if Widget is playing right now, run the timer
    if ( !_viewerPaused ) {
      _startErrorTimer();
    }

  }

  function logEvent( params, isError ) {
    if ( isError ) {
      _errorLog = params;
    }

    if ( !params.file_url ) {
      params.file_url = _getCurrentFile();
    }

    RiseVision.Common.LoggerUtils.logEvent( getTableName(), params );
  }

  function onFileInit( urls ) {
    if ( _mode === "file" ) {
      // urls value will be a string
      _currentFiles[ 0 ] = urls;
    } else if ( _mode === "folder" ) {
      // urls value will be an array
      _currentFiles = urls;
    }

    _resetErrorFlags();

    _message.hide();

    if ( !_viewerPaused ) {
      play();
    }
  }

  function onFileRefresh( urls ) {
    if ( _mode === "file" ) {
      // urls value will be a string of one url
      _currentFiles[ 0 ] = urls;
    } else if ( _mode === "folder" ) {
      // urls value will be an array of urls
      _currentFiles = urls;
    }

    if ( _player ) {
      _player.update( _currentFiles );
    }

    // in case refreshed file fixes an error with previous file, ensure flag is removed so playback is attempted again
    _resetErrorFlags();
  }

  function onFileUnavailable( message ) {
    _unavailableFlag = true;

    _message.show( message );

    _currentPlaylistIndex = null;

    // if Widget is playing right now, run the timer
    if ( !_viewerPaused ) {
      _startErrorTimer();
    }
  }

  function pause() {

    _viewerPaused = true;

    // in case error timer still running (no conditional check on errorFlag, it may have been reset in onFileRefresh)
    _clearErrorTimer();

    if ( _player ) {
      if ( !_resume ) {
        _currentPlaylistIndex = null;
        _player.reset();
      } else {
        _player.pause();
      }
    }

  }

  function play() {
    if ( _isLoading ) {
      _isLoading = false;

      // Log configuration event.
      logEvent( {
        event: "configuration",
        event_details: _configDetails
      }, false );
    }

    _viewerPaused = false;

    logEvent( { "event": "play" }, false );

    if ( _errorFlag ) {
      _startErrorTimer();
      return;
    }

    if ( _unavailableFlag ) {
      if ( _storage ) {
        _storage.retry();
      } else if ( _nonStorage ) {
        _nonStorage.retry();
      }

      return;
    }

    if ( _player ) {
      // Ensures possible error messaging gets hidden and video gets shown
      _message.hide();

      _player.play();
    } else {
      if ( _currentFiles && _currentFiles.length > 0 ) {
        _player = new RiseVision.Video.PlayerVJS( _additionalParams, _mode );
        _player.init( _currentFiles );
      }
    }

  }

  function getTableName() {
    return "video_v2_events";
  }

  function playerEnded() {
    _currentPlaylistIndex = null;

    _done();
  }

  function playerReady() {
    // Ensures loading messaging is hidden and video gets shown
    _message.hide();

    if ( !_viewerPaused && _player ) {
      _player.play();
    }
  }

  function playerItemChange( index ) {
    _currentPlaylistIndex = index;
  }

  function setAdditionalParams( params, mode, displayId ) {
    var isStorageFile;

    _additionalParams = _.clone( params );
    _mode = mode;
    _displayId = displayId;
    _prefs = new gadgets.Prefs();

    document.getElementById( "container" ).style.width = _prefs.getInt( "rsW" ) + "px";
    document.getElementById( "container" ).style.height = _prefs.getInt( "rsH" ) + "px";

    _additionalParams.width = _prefs.getInt( "rsW" );
    _additionalParams.height = _prefs.getInt( "rsH" );

    if ( _additionalParams.video.hasOwnProperty( "resume" ) ) {
      _resume = _additionalParams.video.resume;
    }

    _message = new RiseVision.Common.Message( document.getElementById( "container" ),
      document.getElementById( "messageContainer" ) );

    if ( RiseVision.Common.Utilities.isLegacy() ) {
      showError( "This version of Video Widget is not supported on this version of Rise Player. " +
        "Please use the latest Rise Player version available at https://help.risevision.com/user/create-a-display" );
    } else {
      // show wait message while Storage initializes
      _message.show( "Please wait while your video is downloaded." );

      if ( _mode === "file" ) {
        isStorageFile = ( Object.keys( _additionalParams.storage ).length !== 0 );

        if ( !isStorageFile ) {
          _configDetails = "custom";

          _nonStorage = new RiseVision.Video.NonStorage( _additionalParams );
          _nonStorage.init();
        } else {
          _configDetails = "storage file";

          // create and initialize the Storage file instance
          _storage = new RiseVision.Video.StorageFile( _additionalParams, _displayId );
          _storage.init();
        }
      } else if ( _mode === "folder" ) {
        _configDetails = "storage folder";

        // create and initialize the Storage folder instance
        _storage = new RiseVision.Video.StorageFolder( _additionalParams, _displayId );
        _storage.init();
      }
    }

    _ready();
  }

  // An error occurred with Player.
  function playerError( error ) {
    var params = {},
      type = "MEDIA_ERR_UNKNOWN",
      errorMessage = "Sorry, there was a problem playing the video.",
      errorTypes = [
        "MEDIA_ERR_CUSTOM",
        "MEDIA_ERR_ABORTED",
        "MEDIA_ERR_NETWORK",
        "MEDIA_ERR_DECODE",
        "MEDIA_ERR_SRC_NOT_SUPPORTED",
        "MEDIA_ERR_ENCRYPTED"
      ];

    if ( error ) {
      type = errorTypes[ error.code ] || type;
      errorMessage = error.message || errorMessage;
    }

    params.event = "player error";
    params.event_details = type + " - " + errorMessage;
    _playerErrorFlag = true;

    logEvent( params, true );
    showError( errorMessage );
  }

  function stop() {
    pause();
  }

  return {
    "getTableName": getTableName,
    "hasPlayerError": hasPlayerError,
    "hasStorageError": hasStorageError,
    "logEvent": logEvent,
    "onFileInit": onFileInit,
    "onFileRefresh": onFileRefresh,
    "onFileUnavailable": onFileUnavailable,
    "pause": pause,
    "play": play,
    "setAdditionalParams": setAdditionalParams,
    "showError": showError,
    "playerEnded": playerEnded,
    "playerReady": playerReady,
    "playerError": playerError,
    "playerItemChange": playerItemChange,
    "stop": stop
  };

} )( window, gadgets );

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.PlayerUtils = ( function() {
  "use strict";

  /*
   *  Public  Methods
   */
  function getVideoFileType( url ) {
    var extensions = [ ".mp4", ".webm" ],
      urlLowercase = url.toLowerCase(),
      type = null,
      i;

    for ( i = 0; i <= extensions.length; i += 1 ) {
      if ( urlLowercase.indexOf( extensions[ i ] ) !== -1 ) {
        type = "video/" + extensions[ i ].substr( extensions[ i ].lastIndexOf( "." ) + 1 );
        break;
      }
    }

    return type;
  }

  function getAspectRatio( width, height ) {

    var r;

    function gcd( a, b ) {
      return ( b == 0 ) ? a : gcd( b, a % b );
    }

    r = gcd( width, height );

    return width / r + ":" + height / r;
  }

  return {
    "getAspectRatio": getAspectRatio,
    "getVideoFileType": getVideoFileType
  };

} )();

/* global config */

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.StorageFile = function( data, displayId ) {
  "use strict";

  var _initialLoad = true,
    utils = RiseVision.Common.Utilities,
    riseCache = RiseVision.Common.RiseCache;

  /*
   *  Public Methods
   */
  function init() {
    var storage = document.getElementById( "videoStorage" );

    if ( !storage ) {
      return;
    }

    storage.addEventListener( "rise-storage-response", function( e ) {
      if ( e.detail && e.detail.url ) {

        if ( _initialLoad ) {
          _initialLoad = false;

          RiseVision.Video.onFileInit( e.detail.url );
        } else {
          // check for "changed" property
          if ( e.detail.hasOwnProperty( "changed" ) ) {
            if ( e.detail.changed ) {
              RiseVision.Video.onFileRefresh( e.detail.url );
            } else {
              // in the event of a network failure and recovery, check if the Widget is in a state of storage error
              if ( RiseVision.Video.hasStorageError() || RiseVision.Video.hasPlayerError() ) {
                // proceed with refresh logic so the Widget can eventually play video again from a network recovery
                RiseVision.Video.onFileRefresh( e.detail.url );
              }
            }
          }
        }
      }
    } );

    storage.addEventListener( "rise-storage-api-error", function( e ) {
      var params = {
        "event": "storage api error",
        "event_details": "Response code: " + e.detail.code + ", message: " + e.detail.message
      };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "Sorry, there was a problem communicating with Rise Storage." );
    } );

    storage.addEventListener( "rise-storage-no-file", function( e ) {
      var params = { "event": "storage file not found", "event_details": e.detail };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "The selected video does not exist or has been moved to Trash." );
    } );

    storage.addEventListener( "rise-storage-file-throttled", function( e ) {
      var params = { "event": "storage file throttled", "file_url": e.detail };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "The selected video is temporarily unavailable." );
    } );

    storage.addEventListener( "rise-storage-subscription-expired", function() {
      var params = { "event": "storage subscription expired" };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "Rise Storage subscription is not active." );
    } );

    storage.addEventListener( "rise-storage-subscription-error", function( e ) {
      var params = {
        "event": "storage subscription error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Video.logEvent( params, true );
    } );

    storage.addEventListener( "rise-storage-error", function( e ) {
      var params = {
        "event": "rise storage error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "Sorry, there was a problem communicating with Rise Storage.", true );
    } );

    storage.addEventListener( "rise-cache-error", function( e ) {
      var params = {
          "event": "rise cache error",
          "event_details": e.detail.error.message
        },
        statusCode = 0,
        errorMessage = "";

      // log the error
      RiseVision.Video.logEvent( params, true );

      riseCache.isV2Running( function showError( isV2 ) {
        if ( e.detail.error.message ) {
          statusCode = +e.detail.error.message.substring( e.detail.error.message.indexOf( ":" ) + 2 );
        }

        if ( isV2 ) {
          errorMessage = riseCache.getErrorMessage( statusCode );
        // Show a different message if there is a 404 coming from rise cache
        } else {
          errorMessage = utils.getRiseCacheErrorMessage( statusCode );
        }

        // show the error
        RiseVision.Video.showError( errorMessage );
      } );
    } );

    storage.addEventListener( "rise-cache-not-running", function( e ) {

      var params = {
        "event": "rise cache not running",
        "event_details": ""
      };

      if ( e.detail ) {
        if ( e.detail.error ) {
          // storage v1
          params.event_details = e.detail.error.message;
        } else if ( e.detail.resp && e.detail.resp.error ) {
          // storage v2
          params.event_details = e.detail.resp.error.message;
        }
      }

      RiseVision.Video.logEvent( params, true );

      if ( e.detail && e.detail.isPlayerRunning ) {
        RiseVision.Video.showError( "Waiting for Rise Cache", true );
      }
    } );

    storage.addEventListener( "rise-cache-file-unavailable", function() {
      RiseVision.Video.onFileUnavailable( "File is downloading" );
    } );

    storage.setAttribute( "folder", data.storage.folder );
    storage.setAttribute( "fileName", data.storage.fileName );
    storage.setAttribute( "companyId", data.storage.companyId );
    storage.setAttribute( "displayId", displayId );
    storage.setAttribute( "env", config.STORAGE_ENV );

    storage.go();
  }

  function retry() {
    var storage = document.getElementById( "videoStorage" );

    if ( !storage ) {
      return;
    }

    storage.go();
  }

  return {
    "init": init,
    "retry": retry
  };
};

/* global config, _ */

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.StorageFolder = function( data, displayId ) {
  "use strict";

  var _initialLoad = true,
    _files = [],
    utils = RiseVision.Common.Utilities,
    riseCache = RiseVision.Common.RiseCache;

  function _getUrls() {
    return _.pluck( _files, "url" );
  }

  function _getExistingFile( file ) {
    return _.find( _files, function( f ) {
      return file.name === f.name;
    } );
  }

  function _deleteFile( file ) {
    var existing = _getExistingFile( file );

    if ( existing ) {
      _files.splice( _files.indexOf( existing ), 1 );
    }
  }

  function _changeFile( file ) {
    var existing = _getExistingFile( file );

    if ( existing ) {
      existing.url = file.url;
    }
  }

  function _addFile( file ) {
    var existing = _getExistingFile( file );

    if ( !existing ) {
      // extract the actual file name and store in new property on file object
      file.fileName = file.name.slice( file.name.lastIndexOf( "/" ) + 1, file.name.lastIndexOf( "." ) ).toLowerCase();

      // insert file to _files list at specific index based on alphabetical order of file name
      _files.splice( _.sortedIndex( _files, file, "fileName" ), 0, file );
    }
  }

  /*
   *  Public Methods
   */
  function init() {
    var storage = document.getElementById( "videoStorage" );

    if ( !storage ) {
      return;
    }

    storage.addEventListener( "rise-storage-response", function( e ) {
      var file = e.detail;

      // Added
      if ( file.added ) {
        _addFile( file );

        if ( _initialLoad ) {
          _initialLoad = false;
          RiseVision.Video.onFileInit( _getUrls() );

          return;
        }
      }

      // Changed or unchanged
      if ( file.hasOwnProperty( "changed" ) ) {
        if ( file.changed ) {
          _changeFile( file );
        } else {
          // in the event of a network failure and recovery, check if the Widget is in a state of storage error
          if ( !RiseVision.Video.hasStorageError() && !RiseVision.Video.hasPlayerError() ) {
            // only proceed with refresh logic below if there's been a storage error, otherwise do nothing
            // this is so the Widget can eventually play video again from a network recovery
            return;
          }
        }
      }

      // Deleted
      if ( file.deleted ) {
        _deleteFile( file );
      }

      RiseVision.Video.onFileRefresh( _getUrls() );

    } );

    storage.addEventListener( "rise-storage-api-error", function( e ) {
      var params = {
        "event": "storage api error",
        "event_details": "Response code: " + e.detail.code + ", message: " + e.detail.message
      };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "Sorry, there was a problem communicating with Rise Storage." );
    } );

    storage.addEventListener( "rise-storage-empty-folder", function() {
      var params = { "event": "storage folder empty" };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "The selected folder does not contain any videos." );
    } );

    storage.addEventListener( "rise-storage-no-folder", function( e ) {
      var params = { "event": "storage folder doesn't exist", "event_details": e.detail };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "The selected folder does not exist or has been moved to Trash." );
    } );

    storage.addEventListener( "rise-storage-folder-invalid", function() {
      var params = { "event": "storage folder format(s) invalid" };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "The selected folder does not contain any supported video formats." );
    } );

    storage.addEventListener( "rise-storage-subscription-expired", function() {
      var params = { "event": "storage subscription expired" };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "Rise Storage subscription is not active." );
    } );

    storage.addEventListener( "rise-storage-subscription-error", function( e ) {
      var params = {
        "event": "storage subscription error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Video.logEvent( params, true );
    } );

    storage.addEventListener( "rise-storage-error", function( e ) {
      var params = {
        "event": "rise storage error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Video.logEvent( params, true );
      RiseVision.Video.showError( "Sorry, there was a problem communicating with Rise Storage.", true );
    } );

    storage.addEventListener( "rise-cache-error", function( e ) {
      var params = {
          "event": "rise cache error",
          "event_details": e.detail.error.message
        },
        statusCode = 0,
        errorMessage = "";

      RiseVision.Video.logEvent( params, true );

      riseCache.isV2Running( function showError( isV2 ) {
        if ( e.detail.error.message ) {
          statusCode = +e.detail.error.message.substring( e.detail.error.message.indexOf( ":" ) + 2 );
        }

        if ( isV2 ) {
          errorMessage = riseCache.getErrorMessage( statusCode );
        // Show a different message if there is a 404 coming from rise cache
        } else {
          errorMessage = utils.getRiseCacheErrorMessage( statusCode );
        }

        RiseVision.Video.showError( errorMessage );
      } );
    } );

    storage.addEventListener( "rise-cache-not-running", function( e ) {

      var params = {
        "event": "rise cache not running",
        "event_details": ""
      };

      if ( e.detail ) {
        if ( e.detail.error ) {
          // storage v1
          params.event_details = e.detail.error.message;
        } else if ( e.detail.resp && e.detail.resp.error ) {
          // storage v2
          params.event_details = e.detail.resp.error.message;
        }
      }

      RiseVision.Video.logEvent( params, true );

      if ( e.detail && e.detail.isPlayerRunning ) {
        RiseVision.Video.showError( "Waiting for Rise Cache", true );
      }
    } );

    storage.addEventListener( "rise-cache-folder-unavailable", function() {
      RiseVision.Video.onFileUnavailable( "Files are downloading" );
    } );

    storage.setAttribute( "fileType", "video" );
    storage.setAttribute( "companyId", data.storage.companyId );
    storage.setAttribute( "displayId", displayId );
    storage.setAttribute( "folder", data.storage.folder );
    storage.setAttribute( "env", config.STORAGE_ENV );
    storage.go();
  }

  function retry() {
    var storage = document.getElementById( "videoStorage" );

    if ( !storage ) {
      return;
    }

    storage.go();
  }

  return {
    "init": init,
    "retry": retry
  };
};

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.NonStorage = function( data ) {
  "use strict";

  var riseCache = RiseVision.Common.RiseCache,
    utils = RiseVision.Common.Utilities,
    // 15 minutes
    _refreshDuration = 900000,
    _refreshIntervalId = null,
    _isLoading = true,
    _url = "";

  function _getFile( omitCacheBuster ) {
    riseCache.getFile( _url, function( response, error ) {
      var statusCode = 0,
        errorMessage;

      if ( !error ) {

        if ( _isLoading ) {
          _isLoading = false;

          RiseVision.Video.onFileInit( response.url );

          // start the refresh interval
          _startRefreshInterval();

        } else {
          RiseVision.Video.onFileRefresh( response.url );
        }

      } else {

        if ( error.message && error.message === "File is downloading" ) {

          RiseVision.Video.onFileUnavailable( error.message );

        } else {

          // error occurred
          RiseVision.Video.logEvent( {
            "event": "non-storage error",
            "event_details": error.message,
            "file_url": response.url
          }, true );

          riseCache.isV2Running( function showError( isV2 ) {
            if ( error.message ) {
              statusCode = +error.message.substring( error.message.indexOf( ":" ) + 2 );
            }

            if ( isV2 ) {
              errorMessage = riseCache.getErrorMessage( statusCode );
            // Show a different message if there is a 404 coming from rise cache
            } else {
              errorMessage = utils.getRiseCacheErrorMessage( statusCode );
            }

            // show the error
            RiseVision.Video.showError( errorMessage );
          } );
        }
      }
    }, omitCacheBuster );
  }

  function _startRefreshInterval() {
    if ( _refreshIntervalId === null ) {
      _refreshIntervalId = setInterval( function() {
        _getFile( false );
      }, _refreshDuration );
    }
  }

  /*
   *  Public Methods
   */
  function init() {
    // Handle pre-merge use of "url" setting property
    _url = ( data.url && data.url !== "" ) ? data.url : data.selector.url;

    _url = utils.addProtocol( _url );

    _getFile( true );
  }

  function retry() {
    _getFile( false );
  }

  return {
    "init": init,
    "retry": retry
  };
};

/* global videojs */

var RiseVision = RiseVision || {};

RiseVision.Video = RiseVision.Video || {};

RiseVision.Video.PlayerVJS = function PlayerVJS( params, mode ) {
  "use strict";

  var _autoPlay = false,
    _playerInstance = null,
    _files = null,
    _fileCount = 0,
    _utils = RiseVision.Video.PlayerUtils,
    _updateWaiting = false,
    _isPaused = false,
    _pauseTimer,
    _pause;

  /*
   *  Private Methods
   */
  function _disableFullscreen() {
    var video = document.getElementById( "player" );

    if ( video ) {
      video.className += video.className ? " vjs-nofull" : "vjs-nofull";
    }
  }

  function _getOptions() {
    return {
      controls: params.video.controls,
      fluid: !params.video.scaleToFit,
      height: params.height,
      width: params.width
    };
  }

  function _onPause() {
    if ( !_isPaused ) {
      clearTimeout( _pauseTimer );

      _pauseTimer = setTimeout( function restart() {
        if ( _playerInstance.paused() ) {
          _playerInstance.play();
        }
      }, _pause * 1000 );
    }
  }

  function _onEnded() {
    if ( mode === "file" ) {
      RiseVision.Video.playerEnded();
    } else if ( mode === "folder" ) {
      _fileCount++;

      if ( ( _fileCount >= _playerInstance.playlist().length ) ) {
        _fileCount = 0;
        _playerInstance.playlist.currentItem( 0 );
        RiseVision.Video.playerEnded();
      } else {
        _playerInstance.playlist.next();
      }
    }
  }

  function _onError() {

    RiseVision.Video.playerError( _playerInstance.error() );
  }

  function _onLoadedMetaData() {
    // Log aspect event
    RiseVision.Video.logEvent( {
      event: "aspect",
      event_details: JSON.stringify( {
        placeholderWidth: params.width,
        placeholderHeight: params.height,
        placeholderAspect: _utils.getAspectRatio( params.width, params.height ),
        videoWidth: _playerInstance.videoWidth(),
        videoHeight: _playerInstance.videoHeight(),
        videoAspect: _utils.getAspectRatio( _playerInstance.videoWidth(), _playerInstance.videoHeight() ),
        scaleToFit: params.video.scaleToFit
      } ),
      file_url: _playerInstance.currentSrc()
    }, false );
  }

  function _initPlaylist() {
    var playlist = [],
      playlistItem,
      sources,
      source;

    _files.forEach( function addPlaylistItem( file ) {
      sources = [];
      source = {
        src: file,
        type: _utils.getVideoFileType( file )
      };

      sources.push( source );
      playlistItem = { sources: sources };
      playlist.push( playlistItem );
    } );

    _playerInstance.playlist( playlist );
  }

  function _configureHandlers() {
    if ( params.video.controls && _pause > 1 ) {
      _playerInstance.on( "pause", _onPause );
    }

    _playerInstance.on( "ended", _onEnded );
    _playerInstance.on( "error", _onError );
    _playerInstance.on( "loadedmetadata", _onLoadedMetaData );
  }

  function _setVolume() {
    if ( params.video && ( typeof params.video.volume !== "undefined" )
      && Number.isInteger( params.video.volume ) ) {
      _playerInstance.volume( params.video.volume / 100 );
    }
  }

  function _ready() {
    if ( _files && _files.length && _files.length > 0 ) {
      if ( mode === "file" ) {
        _playerInstance.src( { type: _utils.getVideoFileType( _files[ 0 ] ), src: _files[ 0 ] } );
      } else if ( mode === "folder" ) {
        _initPlaylist();
      }

      _configureHandlers();
      _setVolume();

      // notify that player is ready
      RiseVision.Video.playerReady();
    }
  }

  /*
   *  Public Methods
   */
  function init( files ) {
    _files = files;
    _autoPlay = ( !params.video.controls ) ? true : params.video.autoplay;

    _disableFullscreen();

    // Validate video.pause setting.
    if ( params.video.pause ) {
      params.video.pause = ( typeof params.video.pause === "string" ) ? parseInt( params.video.pause, 10 ) : params.video.pause;
      _pause = ( isNaN( params.video.pause ) ) ? 0 : params.video.pause;
    } else {
      _pause = 0;
    }


    _playerInstance = videojs( "player", _getOptions(), _ready );

    _removeLoadingSpinner();

  }


  /*
    Remove the loading spinner using video js api
   */
  function _removeLoadingSpinner() {
    var loadingSpinnerComponent = _playerInstance.getChild( "loadingSpinner" );

    _playerInstance.removeChild( loadingSpinnerComponent );
  }

  function pause() {
    _isPaused = true;

    if ( !_playerInstance.paused() ) {
      _playerInstance.pause();
    }

    clearTimeout( _pauseTimer );
  }

  function play() {
    _isPaused = false;

    if ( _updateWaiting ) {
      _updateWaiting = false;

      // set a new source
      if ( _files && _files.length && _files.length > 0 ) {
        if ( mode === "file" ) {
          _playerInstance.src( { type: _utils.getVideoFileType( _files[ 0 ] ), src: _files[ 0 ] } );
        } else if ( mode === "folder" ) {
          _initPlaylist();
        }
      }
    }

    if ( _autoPlay ) {
      _playerInstance.play();
    }
  }

  function reset() {
    pause();

    // if video is at end, a future play call will start video over from beginning automatically
    if ( _playerInstance.remainingTime() > 0 ) {
      _playerInstance.currentTime( 0 );
    }
  }

  function update( files ) {
    _files = files;
    _updateWaiting = true;
  }

  return {
    "init": init,
    "pause": pause,
    "play": play,
    "reset": reset,
    "update": update
  };
};

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.Message = function (mainContainer, messageContainer) {
  "use strict";

  var _active = false;

  function _init() {
    try {
      messageContainer.style.height = mainContainer.style.height;
    } catch (e) {
      console.warn("Can't initialize Message - ", e.message);
    }
  }

  /*
   *  Public Methods
   */
  function hide() {
    if (_active) {
      // clear content of message container
      while (messageContainer.firstChild) {
        messageContainer.removeChild(messageContainer.firstChild);
      }

      // hide message container
      messageContainer.style.display = "none";

      // show main container
      mainContainer.style.display = "block";

      _active = false;
    }
  }

  function show(message) {
    var fragment = document.createDocumentFragment(),
      p;

    if (!_active) {
      // hide main container
      mainContainer.style.display = "none";

      messageContainer.style.display = "block";

      // create message element
      p = document.createElement("p");
      p.innerHTML = message;
      p.setAttribute("class", "message");

      fragment.appendChild(p);
      messageContainer.appendChild(fragment);

      _active = true;
    } else {
      // message already being shown, update message text
      p = messageContainer.querySelector(".message");
      p.innerHTML = message;
    }
  }

  _init();

  return {
    "hide": hide,
    "show": show
  };
};

/* global gadgets, RiseVision, config, version */

( function( window, gadgets ) {
  "use strict";

  var prefs = new gadgets.Prefs(),
    id = prefs.getString( "id" );

  // Disable context menu (right click menu)
  window.oncontextmenu = function() {
    return false;
  };

  function configure( names, values ) {
    var additionalParams = null,
      mode = "",
      companyId = "",
      displayId = "";

    if ( Array.isArray( names ) && names.length > 0 && Array.isArray( values ) && values.length > 0 ) {
      if ( names[ 0 ] === "companyId" ) {
        companyId = values[ 0 ];
      }

      if ( names[ 1 ] === "displayId" ) {
        if ( values[ 1 ] ) {
          displayId = values[ 1 ];
        } else {
          displayId = "preview";
        }
      }

      RiseVision.Common.LoggerUtils.setIds( companyId, displayId );
      RiseVision.Common.LoggerUtils.setVersion( version );

      if ( names[ 2 ] === "additionalParams" ) {
        additionalParams = JSON.parse( values[ 2 ] );

        if ( Object.keys( additionalParams.storage ).length !== 0 ) {
          // storage file or folder selected
          if ( !additionalParams.storage.fileName ) {
            // folder was selected
            mode = "folder";
            RiseVision.Common.Utilities.loadScript( config.COMPONENTS_PATH + "videojs-playlist/dist/videojs-playlist.min.js" );
          } else {
            // file was selected
            mode = "file";
          }
        } else {
          // non-storage file was selected
          mode = "file";
        }

        RiseVision.Video.setAdditionalParams( additionalParams, mode, displayId );
      }
    }
  }

  function play() {
    RiseVision.Video.play();
  }

  function pause() {
    RiseVision.Video.pause();
  }

  function stop() {
    RiseVision.Video.stop();
  }

  function init() {
    if ( id && id !== "" ) {
      gadgets.rpc.register( "rscmd_play_" + id, play );
      gadgets.rpc.register( "rscmd_pause_" + id, pause );
      gadgets.rpc.register( "rscmd_stop_" + id, stop );

      gadgets.rpc.register( "rsparam_set_" + id, configure );
      gadgets.rpc.call( "", "rsparam_get", null, id, [ "companyId", "displayId", "additionalParams" ] );
    }
  }

  // check which version of Rise Cache is running and dynamically add rise-storage dependencies
  RiseVision.Common.RiseCache.isRCV2Player( function( isV2 ) {
    var fragment = document.createDocumentFragment(),
      link = document.createElement( "link" ),
      webcomponents = document.createElement( "script" ),
      href = config.COMPONENTS_PATH + ( ( isV2 ) ? "rise-storage-v2" : "rise-storage" ) + "/rise-storage.html",
      storage = document.createElement( "rise-storage" ),
      storageReady = false,
      polymerReady = false;

    function onPolymerReady() {
      window.removeEventListener( "WebComponentsReady", onPolymerReady );
      polymerReady = true;

      if ( storageReady && polymerReady ) {
        init();
      }
    }

    function onStorageReady() {
      storage.removeEventListener( "rise-storage-ready", onStorageReady );
      storageReady = true;

      if ( storageReady && polymerReady ) {
        init();
      }
    }

    webcomponents.src = config.COMPONENTS_PATH + "webcomponentsjs/webcomponents-lite.min.js";
    window.addEventListener( "WebComponentsReady", onPolymerReady );

    // add the webcomponents polyfill source to the document head
    document.getElementsByTagName( "head" )[ 0 ].appendChild( webcomponents );

    link.setAttribute( "rel", "import" );
    link.setAttribute( "href", href );

    // add the rise-storage <link> element to document head
    document.getElementsByTagName( "head" )[ 0 ].appendChild( link );

    storage.setAttribute( "id", "videoStorage" );
    storage.setAttribute( "refresh", 5 );

    if ( isV2 ) {
      storage.setAttribute( "usage", "widget" );
    }

    storage.addEventListener( "rise-storage-ready", onStorageReady );
    fragment.appendChild( storage );

    // add the <rise-storage> element to the body
    document.body.appendChild( fragment );
  } );

} )( window, gadgets );



var _gaq = _gaq || [];

_gaq.push(['_setAccount', 'UA-57092159-2']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();
