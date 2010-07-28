const EXPORTED_SYMBOLS = ['Svc'];


var Svc = {
    'Prefs': Components.classes["@mozilla.org/preferences-service;1"]
             .getService(Components.interfaces.nsIPrefService)
             .getBranch("extensions.ffpake.")
};

Svc.Prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);