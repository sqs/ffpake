

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");  

function HTTPPAKEAuth() {

}

HTTPPAKEAuth.prototype = {
    classDescription: 'HTTP PAKE auth component',
    classID: Components.ID('{7beae336-6b83-4452-8b5f-dd6f75068718}'),
    contractID: "@mozilla.org/network/http-authenticator;1?scheme=pake",

    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIHttpAuthenticator]),    


};

var components = [HTTPPAKEAuth];
function NSGetModule(compMgr, fileSpec) {  
    return XPCOMUtils.generateModule(components);  
}  