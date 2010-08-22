const EXPORTED_SYMBOLS = ['HttpPakeAuthInjector'];

Components.utils.import("resource://ffpake/util.js");

/* TODO: should see if its Authorization attempts fail, and if so, unregister
 * itself */

/* Observes all HTTP requests to host:port and injects an Authorization:
 * header. */
function HttpPakeAuthInjector(host, port, authHeader) {
  this._host = host;
  this._port = port;
  this._authHeader = authHeader;
  this.init();
}

HttpPakeAuthInjector.prototype = {
  init: function() {
    this._log("HttpPakeAuthInjector init: " + this._authHeader);
  },

  _log: function(s) { dump("*** HttpPakeAuthInjector: " + s + "\n"); },

  observe: function(subject, topic, data) {
    if (topic == "http-on-modify-request") {
      var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
      if (httpChannel.URI.host == this._host &&
          httpChannel.URI.port == this._port) {
        this._log("injecting Authorization: " + this._authHeader);
        httpChannel.setRequestHeader("Authorization", this._authHeader, false);
      }
    }
  },

  get observerService() {
    return Components.classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);
  },

  register: function() {
    this.observerService.addObserver(this, "http-on-modify-request", false);
  },

  unregister: function() {
    this.observerService.removeObserver(this, "http-on-modify-request");
  }
};


