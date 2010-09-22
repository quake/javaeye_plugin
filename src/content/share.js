var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

function toUTF8Octets(string) {
    return unescape(encodeURIComponent(string));
}

function btoa(input) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;

    do {
        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }

        output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) +
        keyStr.charAt(enc3) + keyStr.charAt(enc4);
    } while (i < input.length);

    return output;
}

function $(element) {
    return document.getElementById(element);
}

function $F(element) {
    return $(element).value;
}

function getUnicodePref(prefName, prefBranch) {
    return prefBranch.getComplexValue(prefName, Components.interfaces.nsISupportsString).data;
}

function setUnicodePref (prefName, prefValue, prefBranch) {
    var sString = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
    sString.data = prefValue;

    prefBranch.setComplexValue(prefName,  Components.interfaces.nsISupportsString, sString);
}

function $B() {
    var windowManager = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService();
    var windowManagerInterface = windowManager.QueryInterface(Components.interfaces.nsIWindowMediator);
    return windowManagerInterface.getMostRecentWindow( "navigator:browser" ).getBrowser();
}


function isActiveWindow() {
    if (navigator.platform == "Win32" && window.screenX == -32000 && window.screenY == -32000) {
        return false;
    }

    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
    .getService(Components.interfaces.nsIWindowMediator);
    var win = wm.getMostRecentWindow("");
    return (win == window) ? true : false;
}

function Request(url,options) {
    this._init(url,options);
}

Request.prototype = {
    _init: function(url, options) {
        var req = new XMLHttpRequest();
        req.open('POST', url, true);
        req.onreadystatechange = function() {
            if (req.readyState == 4) {
                if (req.status == 200) {
                    if(req.responseText.indexOf("error") == 0) {
                        options["onerror"](req.responseText);
                    }else{
                        options["onsuccess"](req.responseText);
                    }
                }else if (req.status ==  401) {
                    if(options["onauth"]) {
                        options["onauth"](req.responseText);
                    }else{
                        alert("JavaEye账号认证信息有误，请尝试退出后重新登录");
                    }
                }else{
            //TODO report error
            }
            }
        };
        req.setRequestHeader('Authorization', "Basic " + btoa(toUTF8Octets((options["auth_name"] || jeLoginManager.getLoggedInUser().name) + ':' + (options["auth_password"] || jeLoginManager.getLoggedInUser().password))));
        req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        this._req = req;
    },
    
    send: function(parameters) {
        var queryString = "";
        for(var key in parameters) {
            queryString += encodeURIComponent(key) + "=" + encodeURIComponent(parameters[key]) + "&";
        }
        this._req.send(queryString);
    }
}

String.prototype.strip = function () {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
};