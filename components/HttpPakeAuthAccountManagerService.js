const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/services-sync/ext/Sync.js");
Cu.import("resource://ffpake/httpPakeAuthProfile.js");

function setTimeout(func, delay) {
    let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    let callback = {
        notify: function notify() {
            // This line actually just keeps a reference to timer (prevent GC)
            timer = null;
 
            // Call the function so that "this" is global
            func();
        }
    }
    timer.initWithCallback(callback, delay, Ci.nsITimer.TYPE_ONE_SHOT);
}


function HttpPakeAuthAccountManagerService() {
}
HttpPakeAuthAccountManagerService.prototype = {
  classID: Components.ID("{acd6b6c0-4a72-4fe7-85c7-dd341306778b}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),

  observe: function HPA_observe(subject, topic, data) {
        dump("topic = " + topic + "\n");
    switch (topic) {
      case "profile-after-change":
        Services.obs.addObserver(this, "sessionstore-windows-restored", false);
        break;
      case "sessionstore-windows-restored":
        dump("BBBBBBBBBBBBBBBBBBBBBBBBBBBBb\n");
        Services.obs.addObserver(this, "acctmgr-profile-manager-start", false);
        break;
      case "acctmgr-profile-manager-start":
        try {
          Cu.import("resource://gre/modules/accountmanager/profiles.js");
          // TODO(sqs): patch services.js defineLazyGetter part (sets =null
          // before overwrites Service attribute on Profiles
          setTimeout(function() {
            Profiles.Service.registerProfile(HttpPakeAuthProfile);
          }, 50);
          // TODO: for now, just have the notification send itself as the subject
          dump("subject = " + subject + " : type=" + data + "\n");
          //Profiles.Service.Auth.registerProfile(HttpPakeAuthProfile);
        } catch (e) {
          Cu.reportError(e);
        }
        break;
      }
  }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([HttpPakeAuthAccountManagerService]);
