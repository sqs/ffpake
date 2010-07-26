

const EXPORTED_SYMBOLS = ['PAKEAuthProfile'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://weave-identity/ext/log4moz.js");
Cu.import("resource://weave-identity/ext/resource.js");
Cu.import("resource://weave-identity/constants.js");
Cu.import("resource://weave-identity/util.js");
//Cu.import("resource://ffpake/ext/jspake/core/pake.js");

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
    this._pake = {};
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

    // this._pake.client_set_credentials(username, this._realm.realmUrl, password);

    this._log.debug("log in as user='" + username + "' password='" + password + "'");
    
    let res = new Resource(this._realm.domain.obj.resolve(connect.path));
    res.headers['Authorization'] = 'Tcpcrypt username="' + username + '"' +
                                   ' realm="' + this._realm.realmUrl + '"';
    this._log.trace("REQ Authorization: " + res.headers['Authorization']);
    
    let ret = res.get();
    this._log.trace('RES WWW-Authenticate: ' + ret.headers['WWW-Authenticate']);
    // let res = new Resource(this._realm.domain.obj.resolve(connect.path));
    // res.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    // let ret = res.post(params);
    // this._realm.statusChange(ret.headers['X-Account-Management-Status']);
  },

  disconnect: function() {
    if (!this._realm.lock(this._realm.SIGNING_OUT))
      return;
    this._log.trace('Disconnecting');

    if (this._profile.disconnect &&
        this._profile.disconnect.method == 'POST') {
      this._disconnect_POST();
    } else if (this._profile.disconnect &&
               this._profile.disconnect.method == 'GET') {
      this._disconnect_GET();
    } else
      this._log.warn('No supported methods in common for disconnect');
  },
  _disconnect_POST: function() {
    let disconnect = this._profile.disconnect;
    let res = new Resource(this._realm.domain.obj.resolve(disconnect.path));
    let params;
    if (this._realm.token)
      params = connect.params.token + '=' + encodeURIComponent(this._realm.token);
    this._realm.statusChange(res.post(params).headers['X-Account-Management-Status']);
  },
  _disconnect_GET: function() {
    let disconnect = this._profile.disconnect;
    let res = new Resource(this._realm.domain.obj.resolve(disconnect.path));
    let params;

    if (this._realm.token) {
      params = connect.params.token + '=' + encodeURIComponent(this._realm.token);
      // be careful not to trample any params already there
      res.uri.QueryInterface(Ci.nsIURL);
      if (res.uri.query)
        res.uri.query += '&' + params;
      else
        res.uri.query = params;
    }

    this._realm.statusChange(res.get().headers['X-Account-Management-Status']);
  }
};
