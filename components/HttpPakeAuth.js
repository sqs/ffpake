Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");  
Components.utils.import("resource://ffpake/util.js");
Components.utils.import("resource://ffpake/ext/jspake/core/pake.ctypes.js");

function HTTPPAKEAuth() {
  this.init();
}

HTTPPAKEAuth.prototype = {
  classDescription: 'HTTP PAKE auth component',
  classID: Components.ID('{7beae336-6b83-4452-8b5f-dd6f75068718}'),
  contractID: "@mozilla.org/network/http-authenticator;1?scheme=pake",

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIHttpAuthenticator]),

  _log: function(s) { dump("*** HTTPPAKEAuth: " + s + "\n"); },

  init: function() {
    this._pake = new pake(1);
  },

  challengeReceived: function(aChannel, aChallenge, aProxyAuth, aSessionState,
                              aContinuationState, aInvalidatesIdentity) {
    this._log("challengeReceived: " +
                    "\n\tchallenge: '" + aChallenge + "'" +
                    "\n\tsessionState: " + aSessionState.toSource());

    let chal = this._parseHeader(aChallenge);
    if (!('Y' in chal)) { // stage 1
      aInvalidatesIdentity.value = true;
    } else { // stage 2
      // The identity is never invalidated between stages 1 and 2 since
      // they occur in sequence with no additional user prompting. If the
      // credentials are invalid, the client discovers that after stage2.
      aInvalidatesIdentity.value = false;
    }

    this._log("PAKE challengeReceived DONE, " +
                    (aInvalidatesIdentity.value ? "invalidate identity" :
                     "don't invalidate identity"));
  },

  generateCredentials: function(aChannel, aChallenge, aProxyAuth, aDomain,
                                aUser, aPassword, aSessionState, 
                                aContinuationState, aFlags) {
    this._log("generateCredentials: " +
                    "\n\tchannel: " + (aChannel ? aChannel.value : "null") + 
                    "\n\tchallenge: '" + aChallenge + "'" +
                    "\n\tuser: '" + aUser + "' password: '" + aPassword + "'");

    let chal = this._parseHeader(aChallenge);
    let response;
    if (!('Y' in chal)) { // stage 1
      response = "PAKE username=\"" + aUser + "\" " +
                 "realm=\"" + chal['realm'] + "\"";
    } else { // stage 2
      this._pake.client_set_credentials(aUser, chal['realm'], aPassword);
      this._pake.client_recv_Y(chal['Y']);

      let sessid = "abcd123";

      response = "PAKE username=\"" + aUser + "\" " +
                 "realm=\"" + chal['realm'] + "\" " +
                 "X=\"" + this._pake.client_get_X_string() + "\" " +
                 "respc=\"" + this._pake.compute_respc(sid) + "\"";
    }
    
    this._log("PAKE response: " + response + "\n");

    // Mutual auth.
    // If aChannel is null, then this was called from
    // httpPakeAuthProfile.js and it performs its own mutual auth.
    if (aChannel) {
      aChannel.notificationCallbacks = new serverAuthListener();
    }
       
    return response;
  },

  HeaderParseError: function(header, msg) {
    let c = function _HeaderParseError(header, msg) {};
    c.prototype = {
      'toString': function () { 
        return "HeaderParseError: " + msg + " (in header: " + header + ")"; 
      }
    };
    return c(header, msg);
  },

  _authName: 'PAKE',

  _parseHeader: function(header) {
    /// this._log("PAKE _parseHeader: " + header + "\n");

    if (!header) throw 'null-header';

    // TODO(sqs): "PAKE" should be case insensitive
    let prefix = this._authName + ' ';
    if (header.indexOf(prefix) != 0) {
      throw this.HeaderParseError(header, "auth name != 'PAKE'");
    }

    // Advance beyond "PAKE " prefix
    header = header.substr(prefix);

    let attrs = header.match(/([a-zA-Z]+)=\"([^\"]+)\"/g);
    for (let i=0; i < attrs.length; i++) {
      attrs[i] = attrs[i].split('=');
      // strip quotes around val
      attrs[i][1] = attrs[i][1].substr(1, attrs[i][1].length - 2);
      attrs[attrs[i][0]] = attrs[i][1];
      delete attrs[i];
    }
        
    return attrs;
  }

};

function serverAuthListener() {
  dump("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n");
}

serverAuthListener.prototype = {
  getInterface: function(aIID) {
    return this.QueryInterface(aIID);
  },

  QueryInterface: function(aIID) {
    if (aIID.equals(Components.interfaces.nsIProgressEventSink) ||
        aIID.equals(Components.interfaces.nsIInterfaceRequestor) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  onProgress: function onProgress(aRequest, aContext, aProgress, aProgressMax) {
    dump("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");
    let log = Log4Moz.repository.getLogger("HTTPPAKEAuth.serverAuthListener");
    log.level =
      Log4Moz.Level[Svc.Prefs.get("log.logger.httpauth")];
    log.debug("onProgress: byte count " + aProgress + "/" + aProgressMax);
    dump("##########################################################\n");
  }
};

function ServerAuthListener2(logger) {
  this._log = logger;
}
ServerAuthListener2.prototype = {
  onStopRequest: function Channel_onStopRequest(channel, context, status) {
    dump("################################# " + status + "\n");
  },
};


const NSGetFactory = XPCOMUtils.generateNSGetFactory([HTTPPAKEAuth]);