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

/* exported config */
var config = {
  STORAGE_ENV: "prod"
};

if ( typeof angular !== "undefined" ) {
  angular.module( "risevision.common.i18n.config", [] )
    .constant( "LOCALES_PREFIX", "locales/translation_" )
    .constant( "LOCALES_SUFIX", ".json" );
}

/* global gadgets */

var RiseVision = RiseVision || {};

RiseVision.WebPage = {};

RiseVision.WebPage = ( function( document, gadgets ) {

  "use strict";

  // private variables
  var _prefs = new gadgets.Prefs(),
    _utils = RiseVision.Common.Utilities,
    _additionalParams = null,
    _url = "",
    _vertical = 0,
    _intervalId = null,
    _initialLoad = true,
    _widthOffset = 0,
    _message = null; // eslint-disable-line no-unused-vars

  /*
   *  Private Methods
   */
  function _ready() {
    gadgets.rpc.call( "", "rsevent_ready", null, _prefs.getString( "id" ),
      true, true, true, true, false );
  }

  function _setInteractivity( frame ) {
    var blocker = document.querySelector( ".blocker" );

    blocker.style.display = ( _additionalParams.interactivity.interactive ) ? "none" : "block";

    frame.setAttribute( "scrolling",
      ( _additionalParams.interactivity.interactive && _additionalParams.interactivity.scrollbars ) ? "yes" : "no" );
  }

  function _setAspectRatio() {
    var container = document.getElementById( "container" ),
      aspectRatio = ( _prefs.getInt( "rsH" ) / _prefs.getInt( "rsW" ) ) * 100;

    if ( container ) {
      // implement responsive iframe
      if ( _vertical !== 0 ) {
        aspectRatio += ( _vertical / _prefs.getInt( "rsW" ) ) * 100;
      }

      container.setAttribute( "style", "padding-bottom:" + aspectRatio + "%" );
    }
  }

  function _setZoom( frame ) {
    var zoom = parseFloat( _additionalParams.zoom ),
      currentStyle = "",
      zoomStyle = "";

    // Configure the zoom (scale) styling
    zoomStyle = "-ms-zoom:" + zoom + ";" +
      "-moz-transform: scale(" + zoom + ");" +
      "-moz-transform-origin: 0 0;" +
      "-o-transform: scale(" + zoom + ");" +
      "-o-transform-origin: 0 0;" +
      "-webkit-transform: scale(" + zoom + ");" +
      "-webkit-transform-origin: 0 0;" +
      "transform: scale(" + zoom + ");" +
      "transform-origin: 0 0;";

    currentStyle = frame.getAttribute( "style" );
    zoomStyle += "width: " + ( ( ( 1 / zoom ) * 100 ) + _widthOffset ) + "%;" +
      "height: " + ( ( 1 / zoom ) * 100 ) + "%;";

    if ( currentStyle ) {
      zoomStyle = currentStyle + zoomStyle;
    }

    frame.setAttribute( "style", zoomStyle );
  }

  function _setRegion( frame ) {
    var currentStyle = "",
      marginStyle = "",
      horizontal = 0;

    if ( _additionalParams.region && _additionalParams.region.showRegion &&
      ( _additionalParams.region.showRegion === "region" ) ) {
      if ( _additionalParams.region.horizontal > 0 ) {
        horizontal = _additionalParams.region.horizontal;
      }

      if ( _additionalParams.region.vertical > 0 ) {
        _vertical = _additionalParams.region.vertical;
      }

      // Apply negative margins in order to show a region.
      if ( ( horizontal !== 0 ) || ( _vertical !== 0 ) ) {
        // Calculate the width offset when region is chosen.
        _widthOffset = ( horizontal * 100 ) / _prefs.getInt( "rsW" );

        currentStyle = frame.getAttribute( "style" );
        marginStyle = "margin: " + "-" + _vertical + "px 0 0 -" + horizontal + "px;";

        if ( currentStyle ) {
          marginStyle = currentStyle + marginStyle;
        }

        frame.setAttribute( "style", marginStyle );
      }
    }
  }

  function _startRefreshInterval() {
    _intervalId = setInterval( function() {
      _utils.hasInternetConnection( "img/transparent.png", function( hasInternet ) {
        if ( hasInternet ) {
          _loadFrame();
        }
      } );
    }, _additionalParams.refresh );
  }

  function _getFrameElement() {
    var frame = document.createElement( "iframe" ),
      container = document.getElementById( "container" );

    frame.className = "webpage-frame";
    frame.style.visibility = "hidden";
    frame.setAttribute( "frameborder", "0" );
    frame.setAttribute( "allowTransparency", "true" );
    frame.setAttribute( "sandbox", "allow-forms allow-same-origin allow-scripts" );

    _setInteractivity( frame );
    _setRegion( frame );
    _setZoom( frame );
    _setAspectRatio();

    frame.onload = function() {
      this.onload = null;
      this.style.visibility = "visible";

      _initialLoad = false;

      // check if refresh interval should be started
      if ( _additionalParams.refresh > 0 && _intervalId === null ) {
        _startRefreshInterval();
      }

      if ( document.querySelectorAll( ".webpage-frame" ).length > 1 ) {
        // Refresh occurred, remove old iframe
        container.removeChild( document.querySelector( ".webpage-frame" ) );
      }
    };

    return frame;
  }

  function _loadFrame() {
    var container = document.getElementById( "container" ),
      fragment = document.createDocumentFragment(),
      frame = _getFrameElement();

    frame.setAttribute( "src", _url );

    fragment.appendChild( frame );
    container.appendChild( fragment );
  }

  function _unloadFrame() {
    var container = document.getElementById( "container" ),
      frame = document.querySelector( ".webpage-frame" );

    if ( _additionalParams.refresh > 0 ) {
      clearInterval( _intervalId );
      _intervalId = null;
    }

    if ( frame ) {
      container.removeChild( frame );
    }

  }

  function _init() {
    _message = new RiseVision.Common.Message( document.getElementById( "container" ),
      document.getElementById( "messageContainer" ) );

    // apply height value to message container so a message gets vertically centered
    document.getElementById( "messageContainer" ).style.height = _prefs.getInt( "rsH" ) + "px";

    // Configure the value for _url
    _url = _additionalParams.url;

    // Add http:// if no protocol parameter exists
    if ( _url.indexOf( "://" ) === -1 ) {
      _url = "http://" + _url;
    }

    _ready();
  }

  /*
   *  Public Methods
   */
  function getTableName() {
    return "webpage_events";
  }

  function logEvent( params ) {
    RiseVision.Common.LoggerUtils.logEvent( getTableName(), params );
  }

  function pause() {
    if ( _additionalParams.unload ) {
      _unloadFrame();
    }
  }

  function play() {

    logEvent( { "event": "play", "url": _url } );

    if ( _initialLoad || _additionalParams.unload ) {
      _loadFrame();
    }
  }

  function stop() {
    pause();
  }

  function setAdditionalParams( additionalParams ) {
    _additionalParams = JSON.parse( JSON.stringify( additionalParams ) );

    _init();
  }

  return {
    "getTableName": getTableName,
    "logEvent": logEvent,
    "setAdditionalParams": setAdditionalParams,
    "pause": pause,
    "play": play,
    "stop": stop
  };

} )( document, gadgets );

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

/* global RiseVision, gadgets */

( function( window, document, gadgets ) {
  "use strict";

  var id = new gadgets.Prefs().getString( "id" );

  // Disable context menu (right click menu)
  window.oncontextmenu = function() {
    return false;
  };

  document.body.onmousedown = function() {
    return false;
  };

  function configure( names, values ) {
    var additionalParams,
      companyId = "",
      displayId = "";

    if ( Array.isArray( names ) && names.length > 0 && Array.isArray( values ) && values.length > 0 ) {
      // company id
      if ( names[ 0 ] === "companyId" ) {
        companyId = values[ 0 ];
      }

      // display id
      if ( names[ 1 ] === "displayId" ) {
        if ( values[ 1 ] ) {
          displayId = values[ 1 ];
        } else {
          displayId = "preview";
        }
      }

      // provide LoggerUtils the ids to use
      RiseVision.Common.LoggerUtils.setIds( companyId, displayId );

      // additional params
      if ( names[ 2 ] === "additionalParams" ) {
        additionalParams = JSON.parse( values[ 2 ] );

        RiseVision.WebPage.setAdditionalParams( additionalParams );
      }
    }
  }

  function play() {
    RiseVision.WebPage.play();
  }

  function pause() {
    RiseVision.WebPage.pause();
  }

  function stop() {
    RiseVision.WebPage.stop();
  }

  if ( id && id !== "" ) {
    gadgets.rpc.register( "rscmd_play_" + id, play );
    gadgets.rpc.register( "rscmd_pause_" + id, pause );
    gadgets.rpc.register( "rscmd_stop_" + id, stop );
    gadgets.rpc.register( "rsparam_set_" + id, configure );
    gadgets.rpc.call( "", "rsparam_get", null, id, [ "companyId", "displayId", "additionalParams" ] );
  }

} )( window, document, gadgets );



/* jshint ignore:start */
var _gaq = _gaq || [];

_gaq.push(['_setAccount', 'UA-57092159-6']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();
/* jshint ignore:end */
