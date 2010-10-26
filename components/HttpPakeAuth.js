Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");  
Components.utils.import("resource://ffpake/ext/jspake/core/pake.ctypes.js");

var Cr = Components.results;

var PAKEAuthName = "PAKE";

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
  },

  generateCredentials: function(aChannel, aChallenge, aProxyAuth, aDomain,
                                aUser, aPassword, aSessionState, 
                                aContinuationState, aFlags) {
    this._log("generateCredentials: " +
                    "\n\tchannel: " + (aChannel ? aChannel.value : "null") + 
                    "\n\tchallenge: '" + aChallenge + "'" +
                    "\n\tuser: '" + aUser + "' password: '" + aPassword + "'");

    let self = this;
    let chal = this._parseHeader(aChallenge);
    let response;
    if (!('Y' in chal)) { // stage 1
      response = "PAKE username=\"" + aUser + "\" " +
                 "realm=\"" + chal['realm'] + "\"";
    } else { // stage 2
      this._pake.client_set_credentials(aUser, chal['realm'], aPassword);
      this._pake.client_recv_Y(chal['Y']);

      let sessid = "";
      if (aChannel) {
        let chan = aChannel.QueryInterface(Components.interfaces.nsIChannel);
        let secInfo = chan.securityInfo.QueryInterface(Components.interfaces.tcITransportSessionInfo);
          if (secInfo && secInfo.sessionID)
              sessid = secInfo.sessionID;
      }

      response = "PAKE username=\"" + aUser + "\" " +
                 "realm=\"" + chal['realm'] + "\" " +
                 "X=\"" + this._pake.client_get_X_string() + "\" " +
                 "respc=\"" + this._pake.compute_respc(sessid) + "\"";

      // Mutual auth.
      // If aChannel is null, then this was called from
      // httpPakeAuthProfile.js and it performs its own mutual auth.
      if (aChannel) {
        let traceChannel = aChannel.QueryInterface(Components.interfaces.nsITraceableChannel);
        let sl = new ServerAuthListener(this._parseHeader, this._pake.compute_resps(sessid), this._log);
        sl.originalListener = traceChannel.setNewListener(sl);
      }

    }
    
    this._log("PAKE response: " + response + "\n");
       
    return response;
  },

  _parseHeader: function(header) {
    /// this._log("PAKE _parseHeader: " + header + "\n");

    if (!header) throw 'null-header';

    // TODO(sqs): "PAKE" should be case insensitive
    let prefix = PAKEAuthName + ' ';
    if (header.indexOf(prefix) != 0) {
      throw HeaderParseError(header, "auth name != 'PAKE'");
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

function ServerAuthListener(parseHeader, expectedResps, logger) {
  this.originalListener = null;
  this.parseHeader = parseHeader;
  this.expectedResps = expectedResps;
  this._log = logger;
}

ServerAuthListener.prototype = {
  onStartRequest: function (aRequest, aContext) {
    this.originalListener.onStartRequest(aRequest, aContext);
  },
  
  onDataAvailable: function(request, context, inputStream, offset, count) {
    this.originalListener.onDataAvailable(request, context, inputStream, offset, count);
  },

  onStopRequest: function Channel_onStopRequest(aRequest, aContext, aStatusCode) {
    let httpChannel = aRequest.QueryInterface(Components.interfaces.nsIHttpChannel);
    let authInfo = httpChannel.getResponseHeader("Authentication-Info");
    this._log("authInfo = " + authInfo);
    this.originalListener.onStopRequest(aRequest, aContext, aStatusCode);
    aStatusCode.value = this.authInfoValidator(authInfo);
  },

  authInfoValidator: function (authInfo) {
    let ai = this.parseHeader(authInfo);
    if (!('resps' in ai)) {
      this._log("No resps in server Authentication-Info: " + authInfo);
      return Cr.NS_ERROR_FAILURE;
    }
    if (ai['resps'] != this.expectedResps) {
      this._log("Bad resps in server Authentication-Info: " + authInfo);
      return Cr.NS_ERROR_FAILURE;
    }
    return Cr.NS_OK;
  },

  QueryInterface: function (aIID) {
    if (aIID.equals(Ci.nsIStreamListener) ||
        aIID.equals(Ci.nsISupports)) {
      return this;
    }
    throw Components.results.NS_NOINTERFACE;
  }
};

var HeaderParseError = function(header, msg) {
  let c = function _HeaderParseError(header, msg) {};
  c.prototype = {
    'toString': function () { 
      return "HeaderParseError: " + msg + " (in header: " + header + ")"; 
    }
  };
  return c(header, msg);
};


const NSGetFactory = XPCOMUtils.generateNSGetFactory([HTTPPAKEAuth]);