const EXPORTED_SYMBOLS = ['HttpPakeAuthInjector'];

const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/accountmanager/base.jsm");

/* TODO: should see if its Authorization attempts fail, and if so, unregister
 * itself */

const HTTP_ON_MODIFY_REQUEST = "http-on-modify-request";

function HttpPakeAuthInjector(host, port, authHeader) {
  BaseClass.apply(this);
  this.host = host;
  this.port = port;
  this.authHeader = authHeader;
  this.init();
}

HttpPakeAuthInjector.prototype = {
  __proto__: BaseClass.prototype,
  prefBranchStr: "extensions.ffpake.",
  logName: "HttpPakeAuthInjector",

  init: function() {
    this.log("init with Authorization: " + this.authHeader);
  },

  observe: function(subject, topic, data) {
    if (topic == HTTP_ON_MODIFY_REQUEST) {
      var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
      if (httpChannel.URI.host == this.host && httpChannel.URI.port == this.port) {
        this.log("injecting Authorization: " + this.authHeader);
        httpChannel.setRequestHeader("Authorization", this.authHeader, false);
      }
    }
  },

  start: function() {
    Services.obs.addObserver(this, HTTP_ON_MODIFY_REQUEST, false);
  },

  stop: function() {
    Services.obs.removeObserver(this, HTTP_ON_MODIFY_REQUEST);
    this.log("stopped");
  }
};


