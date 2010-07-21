

const EXPORTED_SYMBOLS = ['PAKEAuthProfile'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://weave-identity/ext/log4moz.js");
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
    this._log.level = Log4Moz.Level[Svc.Prefs.get(this._logPref)];
    this._log.debug("PAKEAuthProfile._init()");
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

    if (this._profile.connect && this._profile.connect.method == 'POST') {
      this._connect_POST();
    } else {
      this._log.warn('No supported methods in common for connect');
    }
  },
  _connect_POST: function() {
    let connect = this._profile.connect;
    let logins = Utils.getLogins(this._realm.domain, this._realm.realmUrl, null, true);
    let username, password;
    if (logins && logins.length > 0) {
      username = logins[0].username;
      password = logins[0].password;
    }

    let params = 
      connect.params.username + '=' + encodeURIComponent(username) + '&' +
      connect.params.password + '=' + encodeURIComponent(password);

    if (this._realm.token)
      params += '&' + connect.params.token + '=' +
        encodeURIComponent(this._realm.token);

    let res = new Resource(this._realm.domain.obj.resolve(connect.path));
    res.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    let ret = res.post(params);
    this._realm.statusChange(ret.headers['X-Account-Management-Status']);
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
  },

  register: function() {
    if (!this._realm.lock(this._realm.REGISTERING))
      return;
    let reg = this._profile.register;

    if (reg && reg.method == 'POST') {
      this._log.debug("Registering a new account");
      let url = this._realm.domain.obj.resolve(reg.path);
      let res = new Resource(url);
      res.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      let id;
      if (this._profile.register.type == "email") {
        id = this._realm.email;
      } else if (this._profile.register.type == "username") {
        id = this._realm.username;
      } else {
        this._log.warn("Unknown registration id type: " +
                       this._profile.register.type);
        return;
      }
      let secret = Utils.makeRandom(reg.secret_maxlength? reg.secret_maxlength : 16);
      let params = this._paramGen(reg.params, {id: id, secret: secret});
      let ret = res.post(params);
      if (ret.status >= 200 && ret.status < 400) {
        this._realm.statusChange(ret.headers['X-Account-Management-Status']);
        Utils.persistLogin(id, secret, this._realm.domain, this._realm.realmUrl);
      }

    } else {
      this._log.warn('No supported methods in common for connect');
    }
  }
};
