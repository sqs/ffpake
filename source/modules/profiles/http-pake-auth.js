

const EXPORTED_SYMBOLS = ['PAKEAuthProfile'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://ffpake/ext/log4moz.js");
Cu.import("resource://weave-identity/ext/resource.js");
Cu.import("resource://weave-identity/constants.js");
Cu.import("resource://weave-identity/util.js");

function PAKEAuthProfile(realm) {
  this._init(realm);
}
PAKEAuthProfile.prototype = {
  _logName: "PAKEAuthProfile",
  _logPref: "log.logger.profiles",

  name: "http-pake-auth",

  _init: function(realm) {
    this._realm = realm;
    this._profile = realm.amcd.methods[this.name];
    this._log = Log4Moz.repository.getLogger(this._logName);
    this._log.level = Log4Moz.Level['All'/*Svc.Prefs.get(this._logPref)*/];
    this._log.debug("PAKEAuthProfile._init(realm=" + realm + ")");
  },

  sessionstatus: function() {
    this._log.trace('Querying signin state');

    let query = this._profile.sessionstatus;
    if (query && query.method == 'GET') {
      let res = new Resource(this._realm.domain.obj.resolve(query.path));
      this._realm.statusChange(res.get().headers['X-Account-Management-Status']);
    } else
      this._log.warn('No supported methods in common for query');
  },

  connect: function() {
    if (!this._realm.lock(this._realm.SIGNING_IN))
      return;
    this._log.trace('Connecting');

    if (this._profile.connect) {
      this._do_connect();
    } else {
      this._log.warn('No supported methods for connect');
    }
  },
  _do_connect: function() {
    let connect = this._profile.connect;
    let logins = Utils.getLogins(this._realm.domain, this._realm.realmUrl, null, true);
    let username, password;
    if (logins && logins.length > 0) {
      username = logins[0].username;
      password = logins[0].password;
    }

    this._log.debug("pake client_set_credentials(" + username + ", " + this._realm.realmUrl + ", " + password + ")");

    let pakeAuth = Components.classes['@mozilla.org/network/http-authenticator;1?scheme=pake'].createInstance(Components.interfaces.nsIHttpAuthenticator);
    
    let chal = "PAKE realm=\"" + this._realm.realmUrl + "\"";
    let resp = pakeAuth.generateCredentials(null, chal, false, null,
                                            username, password, {}, {}, {});

    let res = new Resource(this._realm.domain.obj.resolve(connect.path));
    res.headers['Authorization'] = resp;

    let ret = res.get();
    chal = ret.headers['WWW-Authenticate'];
    resp = pakeAuth.generateCredentials(null, chal, false, null, 
                                        username, password, {}, {}, {});
    res.headers['Authorization'] = resp;
    ret = res.get()
    return;
;
    if (typeof(ret.headers['Authentication-Info']) != 'undefined') {
        this._log.trace('RES2 Authentication-Info: ' + ret.headers['Authentication-Info']);
        // TODO(sqs): mutual auth -- check server resps
    } else {
        this._log.error("HTTP PAKE authentication failed");
        this._log.trace("HTTP response headers: " + ret.headers.toSource());
    }

    this._realm.statusChange(ret.headers['X-Account-Management-Status']);
  }
};
