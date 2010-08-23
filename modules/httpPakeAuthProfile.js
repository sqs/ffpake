const EXPORTED_SYMBOLS = ['HttpPakeAuthProfile'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Resource.jsm")
Cu.import("resource://gre/modules/accountmanager/profiles.js");
Cu.import("resource://ffpake/authinjector.js");

/*
 * HTTP PAKE mutual authentication profile
 */

function HttpPakeAuthProfile() {
  AbstractAuthProfile.call(this);
}
HttpPakeAuthProfile.prototype = {
  __proto__: AbstractAuthProfile.prototype,

  // for BaseClass
  prefBranchStr: "extensions.ffpake.",
  logName: "AcctMgr[http-pake]",

  // PAKE auth handler
  get _pakeAuth() {
    let pakeAuth = Cc['@mozilla.org/network/http-authenticator;1?scheme=pake']
                   .createInstance(Ci.nsIHttpAuthenticator);
    delete this._pakeAuth;
    this._pakeAuth = pakeAuth;
    return pakeAuth;
  },

  // for ProfileManager
  name: "http-pake",
  type: "auth",

  get _lm() {
    let lm = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
    delete this._lm;
    this._lm = lm;
    return lm;
  },

  savedAccountsCount: function(realm, onComplete) {
    let base = realm.url.scheme + '://' + realm.url.hostPort;
    let count = this._lm.countLogins(base, "", null); // any action url, but only form logins
    this._async(function() { onComplete(count); });
  },

  savedAccounts: function(realm, onComplete) {
    let base = realm.url.scheme + '://' + realm.url.hostPort;
    let logins = this._lm.findLogins({}, base, "", null); // any action url, but only form logins
    let accounts = [];
    for each (let l in logins) {
      l.QueryInterface(Ci.nsILoginMetaInfo);
      accounts.push({
        guid: l.guid,
        id: l.username,
        profile: this
      });
    }
    this._async(function() { onComplete(accounts); });
  },

  createAccount: function createAccount(realm, onComplete) {
    this._async(function() onComplete("popup", "pake-welcome"));
  },

  connect: function connect(account, autoconnect, realm, onComplete) {
    let prop = Cc["@mozilla.org/hash-property-bag;1"].
               createInstance(Ci.nsIWritablePropertyBag2);
    prop.setPropertyAsAUTF8String("guid", account.guid);

    let logins = this._lm.searchLogins({}, prop);
    if (logins.length == 0) {
      this.log("Failed to find login with guid: " + account.guid);
      onComplete("none");
      return;
    }

    this._sharedConnect({
      autoconnect: autoconnect,
      password: logins[0].password,
      username: logins[0].username,
    }, realm, onComplete);
  },

  _connectExisting: function _connectExisting(username, password, realm, onComplete) {
    this._sharedConnect({
      createOnSuccess: true,
      password: password,
      username: username,
    }, realm, onComplete);
  },

  _sharedConnect: function connect({autoconnect, createOnSuccess, password, username}, realm, onComplete) {
    let connectInfo = realm.auth[this.name].connect;
    let uniqPath = connectInfo.path + "?" + Date.now();
    let res = new Resource(realm.url.resolve(uniqPath));

    this._sharedConnect_clientIdentify({
        autoconnect: autoconnect,
        createOnSuccess: createOnSuccess,
        password: password,
        username: username,
    }, realm, connectInfo, res, onComplete);
  },

  _sharedConnect_clientIdentify: function connect_cid({autoconnect, createOnSuccess, password, username}, realm, connectInfo, res, onComplete) {
    // Make fake auth challenge header based on AMCD.
    let chal = "PAKE realm=\"" + realm.url.spec + "\"";
    
    let resp = this._pakeAuth.generateCredentials(
                 null, chal, false, null,
                 username, password, {}, {}, {});
    res.headers['authorization'] = resp;

    this.log("_sharedConnect_clientIdentify: " + res.headers.toSource());

    res.get(this._make_sharedConnect_clientAuth({
      autoconnect: autoconnect,
      createOnSuccess: createOnSuccess,
      password: password,
      username: username,         
    }, realm, connectInfo, res, onComplete));
  },

  _make_sharedConnect_clientAuth: function connect_ca({autoconnect, createOnSuccess, password, username}, realm, connectInfo, res, onComplete) {
    let self = this;
    return function(result) {
      chal = result.headers['www-authenticate'];
      let authHdr2 = self._pakeAuth.generateCredentials(
                       null, chal, false, null, 
                       username, password, {}, {}, {});
      res.headers['authorization'] = authHdr2;

      res.get(self._make_sharedConnect_serverAuth({
        autoconnect: autoconnect,
        createOnSuccess: createOnSuccess,
        password: password,
        username: username,
      }, realm, connectInfo, res, authHdr2, onComplete));
    }
  },

  _make_sharedConnect_serverAuth: function connect_sa({autoconnect, createOnSuccess, password, username}, realm, connectInfo, res, authHdr2, onComplete) {
    let self = this;
    return function(result) {
      self.handleStatusAction(result.success, connectInfo, onComplete);

      if (result.success) {
        // TODO(sqs): mutual auth -- check server resps

        let realmURI = realm.url;
        let hostname = realmURI.scheme + "://" + realmURI.hostPort;

        self._startAuthInjector(realmURI.host, realmURI.port, authHdr2);

        if (createOnSuccess) {
          let nsLoginInfo = new Components.Constructor(
                              "@mozilla.org/login-manager/loginInfo;1",
                              Ci.nsILoginInfo, "init");
          self._lm.addLogin(new nsLoginInfo(hostname, hostname, null, username,
                                            password, "username", "password"));
        }
      } else {
        // Login failed
        self.log("HTTP PAKE authentication failed");
        self.log("HTTP response headers: " + result.headers.toSource());
      }
    }
  },

  disconnect: function disconnect(account, realm, onComplete) {
    this._async(function() onComplete("popup", "form-disconnect"));
  },

  _disconnect: function _disconnect(account, realm, onComplete) {
    let self = this;
    let disconnectInfo = realm.auth[this.name].disconnect;
    let res = new Resource(realm.url.resolve(disconnectInfo.path));
    this._stopAuthInjector();
    res.get(function(result) {
        self.handleStatusAction(result.success, disconnectInfo, onComplete);
    });
  },

  _startAuthInjector: function(host, port, authHeader) {
    this._stopAuthInjector(); // only stops if one is already running
    this._authInjector = new HttpPakeAuthInjector(host, port, authHeader);
    this._authInjector.start();
  },

  _stopAuthInjector: function() {
    if (this._authInjector) {
      this._authInjector.stop();
      this._authInjector = null;
      // TODO(sqs): support for multiple auth injectors
    }
  }
};

