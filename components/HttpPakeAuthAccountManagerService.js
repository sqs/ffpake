const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://ffpake/httpPakeAuthProfile.js");

function HttpPakeAuthAccountManagerService() {
}
HttpPakeAuthAccountManagerService.prototype = {
  classID: Components.ID("{acd6b6c0-4a72-4fe7-85c7-dd341306778b}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),

  observe: function HPA_observe(subject, topic, data) {
    switch (topic) {
      case "profile-after-change":
        Services.obs.addObserver(this, "sessionstore-windows-restored", false);
        break;
      case "sessionstore-windows-restored":
        Services.obs.addObserver(this, "acctmgr-profile-manager-start", false);
        break;
      case "acctmgr-profile-manager-start":
        try {
          Cu.import("resource://gre/modules/accountmanager/profiles.jsm");
          Profiles.Service.registerProfile(HttpPakeAuthProfile);
        } catch (e) {
          Cu.reportError(e);
        }
        break;
      }
  }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([HttpPakeAuthAccountManagerService]);
