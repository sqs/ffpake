const EXPORTED_SYMBOLS = ['HttpPakeAuthInjector'];


Components.utils.import("resource://ffpake/ext/log4moz.js");
Components.utils.import("resource://ffpake/util.js");


function HttpPakeAuthInjector(authHeader) {
    this._authHeader = authHeader;
    this._initLogs();
    //this._log = {trace: dump};
}

HttpPakeAuthInjector.prototype = {    
    _logName: "HttpPakeAuthInjector",
    _logPref: "log.loggers.account",

    observe: function(subject, topic, data) {
        if (topic == "http-on-modify-request") {
            this._log.trace("injecting Authorization: " + this._authHeader);
            var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
            httpChannel.setRequestHeader("Authorization", this._authHeader, false);
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
    },

    _initLogs: function() {
        this._log = Log4Moz.repository.getLogger(this._logName);
        this._log.level = Log4Moz.Level[Svc.Prefs.get(this._logPref)];
        this._log.trace("HttpPakeAuthInjector init: " + this._authHeader);
    }
};


