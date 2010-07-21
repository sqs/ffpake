

Cu.import("resource://weave-identity/ext/log4moz.js");
Cu.import("resource://weave-identity/ext/Observers.js");
Cu.import("resource://weave-identity/profilemanager.js");
Cu.import("resource://ffpake/profiles/http-pake-auth.js");


function FFPake() {
    this._log = Log4Moz.repository.getLogger("FFPake");
    this._log.level = "All";
}

FFPake.prototype = {
    startup: function() {
        Observers.add("weaveid-profile-manager-start", this, false);
        this._log.debug("Observing weaveid-profile-manager-start");
    },

    shutdown: function() {
        Observers.remove("weaveid-profile-manager-start", this, false);
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
        ffpake.startup(); }, 
    false);
window.addEventListener("unload", function(e) { ffpake.shutdown(); }, false);

