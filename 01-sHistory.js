/*jshint scripturl:true */
/**
 * Page state management. Uses real hashcange event if possible. Partially
 *   based on work by Ben Alman.
 * @see http://benalman.com/projects/jquery-bbq-plugin/
 * @constructor
 * @returns {sHistory} The history object.
 */
var sHistory = function () {
  if (!sHistory.hasNativeSupport) {
    // From ba-bbq
    var getFragment = function (url) {
      url = url || location.href;
      return '#' + url.replace(/^[^#]*#?(.*)$/, '$1');
    };

    // Create an iframe
    var iframe = q(sDoc.newElement('iframe')).setAttributes({
      'id': 'shistory',
      'tabindex': -1,
      'title': 'empty',
      'src': 'javascript:0'
    });
    iframe.get().style.display = 'none';

    // The original hash
    var lastHash = getFragment();

    // Some callbacks that will be defined fully upon loading the iframe
    var fnRet = function (v) { return v; };
    var getHistory = fnRet;
    var setHistory = fnRet;

    var callEventHandlers = function () {
      var event = new sEvent({type: 'hashchange'});
      for (var i = 0; i < sHistory._eventListeners.length; i++) {
        sHistory._eventListeners[i](event);
      }
    };

    // The polling callback
    var timeoutId = null, poll = function () {
      var hash = getFragment();
      var historyHash = getHistory();

      if (hash !== lastHash) {
        lastHash = hash;
        setHistory(lastHash, historyHash);

        // Call the event handlers
        callEventHandlers();
      }
      else if (historyHash !== lastHash) {
        // First hash change
        location.href = location.href.replace(/#.*/, '') + historyHash;
      }

      timeoutId = setTimeout(poll, 50);
    };
    // Upon the iframe loading, make sure we begin polling for hash changes
    var loadOnceCallback = function () {
      var theIframe = iframe.get();
      var contentIframe = theIframe.contentWindow;

      // Define set/getHistory
      getHistory = function () {
        return getFragment(contentIframe.location.href);
      };
      setHistory = function (hash, historyHash) {
        if (hash !== historyHash) {
          var iframeDoc = contentIframe.document;
          //iframeDoc.title = document.title;
          iframeDoc.open(); // This triggers a history event
          iframeDoc.close();
          contentIframe.location.hash = hash;
        }
      };

      // Make the iframe's hash the same as the page's
      contentIframe.document.open();
      contentIframe.location.hash = location.hash;

      // Begin polling
      poll();

      // This is always called from .start() so call the event handlers
      //   for first hash event
      callEventHandlers();

      // Unbind
      q(this).unbind('load', loadOnceCallback);
    };
    // Bind the one-time callback
    iframe.bind('load', loadOnceCallback);


    // Add the iframe to the page
    q(document.body).append(iframe);
  }
};
/**
 * If the browser supports onhashchange natively.
 * @type boolean
 */
sHistory.hasNativeSupport = (function () {
  var mode = document.documentMode;
  return 'onhashchange' in window && (mode === undefined || mode > 7);
})();
/**
 * Just in case called incorrectly.
 * @private
 * @type function()
 */
sHistory.prototype.constructor = function () {};
/**
 * Get full URI.
 * @private
 * @returns {string}
 */
sHistory._getFullURI = function () {
  var url = fURL.getDomain() + fURL.get();
  var qs = fURL.getQueryString();

  if (qs) {
    url += '?' + qs;
  }

  return url;
};
/**
 * Push a state. Note that setting an empty state can cause a browser to
 *   scroll.
 * @param {string} stateKey State name to push. If merge is true, then this
 *   will replace the current state of the same key name. The <code>__t</code>
 *   key is reserved.
 * @param {string|boolean|number} stateValue Value to set.
 * @param {boolean} [merge=true] Whether or not to merge with the current
 *   state.
 */
sHistory.pushState = function (stateKey, stateValue, merge) {
  merge === undefined && (merge = true);

  if (stateKey === undefined || stateValue === undefined) {
    return;
  }

  if (stateKey === '__t') {
    return;
  }

  var url = sHistory._getFullURI();
  var hash = location.hash.replace(/^#&/, '#');
  var euc = encodeURIComponent;

  if (!hash) {
    hash = '#';
  }

  if (merge) {
    if (sHistory.getState(stateKey) !== null) {
      var keyValues = hash.substr(1).split('&'), split;
      for (var i = 0; i < keyValues.length; i++) {
        split = keyValues[i].split('=');
        if (split[0] === stateKey) {
          keyValues[i] = stateKey + '=' + euc(stateValue);
        }
      }
      hash = '#' + keyValues.join('&');
    }
    else {
      if (location.hash) {
        hash += '&';
      }
      hash += stateKey + '=' + euc(stateValue.toString());
    }
  }
  else {
    hash = '#' + stateKey + '=' + euc(stateValue.toString());
  }

  location.href = url + hash;
};
/**
 * Push states. Note that the <code>__t</code> key is reserved.
 * @param {Object} stateObject Object of keys (string) to values (string|number|boolean).
 * @param {boolean} [merge=true] Whether or not to merge with the current
 *   state.
 */
sHistory.pushStates = function (stateObject, merge) {
  merge === undefined && (merge = true);
  stateObject === undefined && (stateObject = {});

  var euc = encodeURIComponent;
  var url = sHistory._getFullURI();
  var key, hash = '#';

  if (!location.hash) {
    merge = false;
  }

  if (merge) {
    // Compare the 2 objects, still need to keep order or 2 states would be pushed
    // TODO Make this more efficient.
    var keyValues = location.hash.substr(1).split('&');
    var found = false, split;

    for (key in stateObject) {
      if (stateObject.hasOwnProperty(key)) {
        if (sHistory.getState(key) !== null) {
          for (var i = 0; i < keyValues.length; i++) {
            split = keyValues[i].split('=');
            if (split[0] === key) {
              if (stateObject[key] === true) {
                stateObject[key] = 'true';
              }
              else if (stateObject[key] === false) {
                stateObject[key] = 'false';
              }
              keyValues[i] = key + '=' + euc(stateObject[key]);
            }
          }
        }
        else {
          keyValues.push(key + '=' + euc(stateObject[key]));
        }
      }
    }

    hash += keyValues.join('&');
  }
  else {
    for (key in stateObject) {
      // Reserved key
      if (key === '__t') {
        continue;
      }

      if (stateObject.hasOwnProperty(key)) {
        if (stateObject[key] === true) {
          stateObject[key] = 'true';
        }
        else if (stateObject[key] === false) {
          stateObject[key] = 'false';
        }
        hash += key + '=' + euc(stateObject[key]);
      }
    }
  }

  location.href = url + hash;
};
/**
 * Remove a state.
 * @param {string|undefined} [stateName] If not specified, removes all states.
 */
sHistory.removeState = function (stateName) {
  if (stateName === undefined) {
    location.href = sHistory._getFullURI() + '#';
    return;
  }

  if (sHistory.getState(stateName) !== null) {

  }
};
/**
 * Get a state by key name.
 * @param {string} key Key to use. Case-sensitive.
 * @param {string} [castTo='string'] Cast to string, number (integer), float,
 *   boolean.
 * @returns {string|number|boolean|null} The state value, or null if no such
 *   state exists.
 */
sHistory.getState = function (key, castTo) {
  if (!key || key === '__t') {
    return null;
  }

  castTo === undefined && (castTo = 'string');

  var keyValues = location.hash.substr(1).split('&');
  var split, ret = null, lcRet = null;

  for (var i = 0; i < keyValues.length; i++) {
    split = keyValues[i].split('=');
    if (split[0] === key) {
      ret = decodeURIComponent(split[1]);
      lcRet = ret.toLowerCase();
      break;
    }
  }

  if (castTo !== 'string') {
    switch (castTo) {
      case 'number':
      case 'integer':
      case 'int':
        ret = parseInt(ret, 10);
        if (isNaN(ret)) {
          ret = 0;
        }
        break;

      case 'float':
        ret = parseFloat(ret);
        break;

      case 'boolean':
      case 'bool':
        if (lcRet === 'true') {
          ret = true;
        }
        else if (lcRet === 'false') {
          ret = false;
        }
        else {
          ret = !!ret;
        }
        break;
    }
  }

  return ret;
};
/**
 * Triggered first event.
 * @type boolean
 * @private
 */
sHistory._started = false;
/**
 * Dispatches first hashchange event.
 * @private
 */
sHistory._dispatchFirst = function () {
  var event;

  if (sHistory.hasNativeSupport) {
    if (document.createEvent) {
      event = document.createEvent('HTMLEvents');
      event.initEvent('hashchange', true, false);
      window.dispatchEvent(event);
    }
    else {
      var hash = location.hash;
      if (hash !== '') {
        hash = hash.replace(/[\&\#]__t=[0-9]+\&?/, '');
        hash += '&__t=' + fCryptography.randomString(10, 'numeric');
      }
      location.hash = hash;
    }
  }
  else {
    sHistory();
  }
};
/**
 * Trigger the first hashchange event. Should be called once per page and only
 *   after all hashchange listeners have been registered.
 * @param {string} [defaultState] The default state key name.
 * @param {string|number|boolean} [defaultStateValue] The default state value.
 */
sHistory.start = function (defaultState, defaultStateValue) {
  if (!sHistory._started) {
    if (defaultState !== undefined &&
        defaultStateValue !== undefined &&
        sHistory.getState(defaultState) === null) {
      // Simply trigger the first hash change with a value
      // IE cannot do this, so call sHistory() to initialise the polling
      if (!sHistory.hasNativeSupport) {
        sHistory();
      }

      sHistory.pushState(defaultState, defaultStateValue);
    }
    else {
      sHistory._dispatchFirst();
    }

    sHistory._started = true;
  }
};
/**
 * @private
 * @type Array
 */
sHistory._eventListeners = [];
/**
 * Add an event listener.
 * @param {function(sEvent|event)} func Callback.
 */
sHistory.addEventListener = function (func) {
  if (!sHistory.hasNativeSupport) {
    sHistory._eventListeners.push(func);
    return;
  }

  window.addEventListener('hashchange', func, false);
};
