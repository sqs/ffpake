

Cu.import("resource://weave-identity/ext/log4moz.js");
Cu.import("resource://weave-identity/ext/Observers.js");

function FFPake() {
    this._log = Log4Moz.repository.getLogger("FFPake");
    this._log.level = Log4Moz.Level[Svc.Prefs.get("log.logger.profiles")];
}

FFPake.startup = function() {
    Observers.add("weaveid-profile-manager-start", this, false);
    alert("hello");
};

FFPake.shutdown = function() {
    Observers.remove("weaveid-profile-manager-start", this, false);
};

FFPake.prototype = {    
    observe: function(subject, topic, data) {
        this._log.debug("observe: topic: " + topic);
        if (topic != "weaveid-profile-manager-start") {
            return;
        }
    },
}

// Install load and unload handlers
window.addEventListener("load", function(e) { FFPake.startup(); }, false);
window.addEventListener("unload", function(e) { FFPake.shutdown(); }, false);

