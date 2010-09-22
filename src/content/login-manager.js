const LOGIN_URL = "{javaeyeApiUrl}/auth/verify"
var jeLoginManager = {
    promptUserLogin: function(syncCallback) {
        window.openDialog("chrome://{appname}/content/login-window.xul", "LoginWindow", "chrome,dialog,centerscreen,modal,resizable=no", syncCallback);
    },

    cancel: function() {
        window.close();
    },

    login: function() {
        if($('img_spinner').getAttribute("hidden") == "false") return;
        
        if($F('tb_name') == "") {
            $('tb_name').focus();
            return
        }
        if($F('tb_password') == "") {
            $('tb_password').focus();
            return
        }
        var success = function(response) {
            eval("var user = " + response);
            user.password = $F("tb_password");
            jeLoginManager.setLoggedInUser(user);
            $('lbl_message').value = "登录成功，正在同步数据";
            jeBookmarkManager.sync(window.arguments[0]);
        };
        var auth = function(response) {
            $('lbl_message').value = "用户名或密码错误";
            $('img_spinner').setAttribute("hidden", "true");
        };
        $('img_spinner').setAttribute("hidden", "false");
        new Request(LOGIN_URL, {
            onsuccess: success,
            onauth: auth,
            auth_name: $F('tb_name'),
            auth_password: $F('tb_password')
        }).send();
    },

    logout: function() {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        prefs.deleteBranch("extensions.{appname}@loggedin.user");
    },
    
    getLoggedInUser: function() {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        try{
            var user = {};
            user.id = prefs.getCharPref("extensions.{appname}@loggedin.user.id");
            user.name = getUnicodePref("extensions.{appname}@loggedin.user.name", prefs);
            user.password = getUnicodePref("extensions.{appname}@loggedin.user.password", prefs);
            user.domain = prefs.getCharPref("extensions.{appname}@loggedin.user.domain");
            return user;
        }catch(e){
            return false;
        }
    },

    setLoggedInUser: function(user) {
        this._user = user;
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        prefs.setCharPref("extensions.{appname}@loggedin.user.id", user.id);
        setUnicodePref("extensions.{appname}@loggedin.user.name", user.name, prefs);
        setUnicodePref("extensions.{appname}@loggedin.user.password", user.password, prefs);
        prefs.setCharPref("extensions.{appname}@loggedin.user.domain", user.domain);
    }
}