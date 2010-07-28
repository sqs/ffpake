

Components.utils.import("resource://ffpake/ext/log4moz.js");
Components.utils.import("resource://ffpake/util.js");
try {
    Components.utils.import("resource://weave-identity/ext/Observers.js");
    Components.utils.import("resource://weave-identity/profilemanager.js");
    Components.utils.import("resource://ffpake/profiles/http-pake-auth.js");
} catch (e) {}

function FFPake() { }

FFPake.prototype = {
    _logName: "FFPake",
    _logPref: "log.logger.ffpake",
    
    _initLogs: function FFPake_initLogs() {
        this._log = Log4Moz.repository.getLogger(this._logName);
        this._log.level = Log4Moz.Level[Svc.Prefs.get(this._logPref)];

        var formatter = new Log4Moz.BasicFormatter();
        var root = Log4Moz.repository.rootLogger;
        root.level = Log4Moz.Level[Svc.Prefs.get("log.rootLogger")];

        var capp = new Log4Moz.ConsoleAppender(formatter);
        capp.level = Log4Moz.Level[Svc.Prefs.get("log.appender.console")];
        root.addAppender(capp);

        var dapp = new Log4Moz.DumpAppender(formatter);
        dapp.level = Log4Moz.Level[Svc.Prefs.get("log.appender.dump")];
        root.addAppender(dapp);
    },

    startup: function() {
        if (typeof(Log4Moz) != "undefined") {
            this._initLogs();
        }

        // Only use if Account Manager is enabled and the PAKE profile loaded.
        if (typeof(PAKEAuthProfile) != "undefined") {
            Observers.add("weaveid-profile-manager-start", this, false);
            this._log.debug("Observing weaveid-profile-manager-start");
        }
    },

    shutdown: function() {
        if (typeof(PAKEAuthProfile) != "undefined") {
            Observers.remove("weaveid-profile-manager-start", this, false);
        }
    },

    observe: function(subject, topic, data) {
        this._log.debug("observe: topic: " + topic + 
                        " subject: " + subject);
        if (topic == "weaveid-profile-manager-start") {
            /* Add HTTP PAKE Auth profile. */
            this._log.debug("Going to register PAKEAuthProfile");
            subject.registerProfile(PAKEAuthProfile);
            this._log.debug("Registered PAKEAuthProfile");
        }
    }
};


// Install load and unload handlers
var ffpake;
window.addEventListener("load", function(e) { 
        ffpake = new FFPake(); 
        ffpake.startup();
    }, false);
window.addEventListener("unload", function(e) { ffpake.shutdown(); }, false);

