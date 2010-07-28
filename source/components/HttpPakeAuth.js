

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");  
Components.utils.import("resource://ffpake/ext/log4moz.js");
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

    _logName: "HTTPPAKEAuth",
    _logPref: "log.logger.httpauth",


    init: function() {
        this._log = Log4Moz.repository.getLogger(this._logName);
        this._log.level = Log4Moz.Level[Svc.Prefs.get(this._logPref)];
        this._pake = new pake(1);
    },

    challengeReceived: function(aChannel, aChallenge, aProxyAuth, aSessionState,
                                aContinuationState, aInvalidatesIdentity) {
        this._log.trace("challengeReceived: " +
                        "\n\tchallenge: '" + aChallenge + "'" +
                        "\n\tsessionState: " + aSessionState.toSource() +
                        "\n\tcontinuationState: " + aContinuationState.toSource());

        let chal = this._parseHeader(aChallenge);
        if (!('Y' in chal)) { // stage 1
            aInvalidatesIdentity.value = true;
        } else { // stage 2
            // The identity is never invalidated between stages 1 and 2 since
            // they occur in sequence with no additional user prompting. If the
            // credentials are invalid, the client discovers that after stage2.
            aInvalidatesIdentity.value = false;
        }

        this._log.trace("PAKE challengeReceived DONE, " +
                        (aInvalidatesIdentity.value ? "invalidate identity" :
                                                      "don't invalidate identity"));
    },

    generateCredentials: function(aChannel, aChallenge, aProxyAuth, aDomain,
                                  aUser, aPassword, aSessionState, 
                                  aContinuationState, aFlags) {
       this._log.trace("generateCredentials: " +
                       "\n\tchannel: " + (aChannel ? aChannel.value : "null") + 
                       "\n\tchallenge: '" + aChallenge + "'" +
                       "\n\tuser: '" + aUser + "' password: '" + aPassword + "'" +
                       "\n\tsessionState: " + aSessionState.toSource() +
                       "\n\tcontinuationState: " + aContinuationState.toSource() +
                       "\n\tsessionState: " + aSessionState.toSource());

       let chal = this._parseHeader(aChallenge);
       let response;
       if (!('Y' in chal)) { // stage 1
           response = "PAKE username=\"" + aUser + "\" " +
                      "realm=\"" + chal['realm'] + "\"";
       } else { // stage 2
           if (!aUser && !aPassword) {
               // TODO(sqs): The only way to stop this duplicate auth from
               // happening is to throw here. Calling .cancel() on the channel
               // doesn't work.
               throw "must have username and password in stage2 generateCredentials";
           }

           this._pake.client_set_credentials(aUser, chal['realm'], aPassword);
           this._pake.client_recv_Y(chal['Y']);
           let sid = 1122334455;
           response = "PAKE username=\"" + aUser + "\" " +
           "realm=\"" + chal['realm'] + "\" " +
           "X=\"" + this._pake.client_get_X_string() + "\" " +
           "respc=\"" + this._pake.compute_respc(sid) + "\"";
       }
        
       // TODO(sqs): mutual auth -- check resps

       this._log.trace("PAKE response: " + response + "\n");
       
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
        /// this._log.trace("PAKE _parseHeader: " + header + "\n");

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

const NSGetFactory = XPCOMUtils.generateNSGetFactory([HTTPPAKEAuth]);