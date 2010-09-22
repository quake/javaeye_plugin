const CREATE_TWITTER_URL = "{javaeyeApiUrl}/twitters/create"
const DELETE_TWITTER_URL = "{javaeyeApiUrl}/twitters/destroy"
const GET_TWITTERS_URLS = {
    "list":"{javaeyeApiUrl}/twitters/list",
    "replies":"{javaeyeApiUrl}/twitters/replies",
    "all":"{javaeyeApiUrl}/twitters/all"
}
const INBOX_URL = "{javaeyeApiUrl}/messages/inbox"
const CREATE_MESSAGE_URL = "{javaeyeApiUrl}/messages/create"
const REPLY_MESSAGE_URL = "{javaeyeApiUrl}/messages/reply"
const USER_LOGO_URL = "http://www.javaeye.com"

var JETwitterNotifierPopupPrototypes = {
    init: function() {
        var panel = this.parentNode;
        panel.setAttribute("onpopuphidden", "jeTwitterNotifier.onPopupHidden(event)");
        var button = $("twitter-statusbar-button");
        if(jeLoginManager.getLoggedInUser()) {
            button.setAttribute("state", "active");
            button.setAttribute("context", "twitter-main-menupopup");
        }
        panel.openPopup(button, "before_end", 0, 0, false, false);
        panel.hidePopup();
        this.isOpen = false;
    },

    openPopup: function() {
        this.show();
        var panel = this.parentNode;
        var button = $("twitter-statusbar-button");
        panel.openPopup(button, "before_end", 0, 0, false, false);
        this.isOpen = true;
    },

    hidePopup: function() {
        this.hide();
        this.parentNode.hidePopup();
        this.isOpen = false;
        this._inReplyToId = null;
    }
};

function JavaEyeTwitterNotifier() {
    this._timer = null;
    this._localMessages = {};
    this._messageQueueLastId = {};
    this._messageQueue = {};
    this._inReplyToId = null;
}

JavaEyeTwitterNotifier.prototype = {
    load: function() {
        //TODO setup hotkey for insert link
        //this.initKeyConfig();

        // Don't init when the window is popup.
        if (window.toolbar.visible == false) {
            var btn = $("twitter-statusbar-button");
            btn.parentNode.removeChild(btn);
            return;
        }
        
        // Create panel
        this._panel = this.getPanel();

        // Create popup window
        this._popup = document.createElement("vbox");
        this._popup.className = "twitter-popup";
        this._popup.style.display = "none";
        this._popup.text = "";
        this._panel.appendChild(this._popup);

        for (var i in JETwitterNotifierPopupPrototypes) {
            this._popup[i] = JETwitterNotifierPopupPrototypes[i];
        }

        this._unescapeHTML = Components.classes["@mozilla.org/feed-unescapehtml;1"].getService(Components.interfaces.nsIScriptableUnescapeHTML);

        this._popup.init();

        $("twitter-menuitem-togglepopup").setAttribute("checked", this._getPopup());
        if(jeLoginManager.getLoggedInUser()) this.setNextTimer();
    },

    onClickStatusbarIcon: function(e) {
        if(!jeLoginManager.getLoggedInUser()) {
            jeLoginManager.promptUserLogin(function() {
                window.close();
                $("twitter-statusbar-button").setAttribute("state", "active");
                $("twitter-statusbar-button").setAttribute("context", "twitter-main-menupopup");
                jeTwitterNotifier.setNextTimer();
            });
            return;
        }
        if (e.button == 0) {
            this.onOpenPopup();
        }
    },

    onTogglePopup: function(e) {
        var menu = $("twitter-menuitem-togglepopup");
        this._setPopup(!this._getPopup());
        menu.setAttribute("checked", this._getPopup());
    },

    onOpenPopup: function() {
        if (this._popup.isOpen) {
            this.closePopup();
        } else {
            this._showFetchedData(this._popup.getUnreadTab());
        }
    },

    backGroundFetchData: function() {
        this._showFetchedData("list", true);
        this._showFetchedData("inbox", true);
    },

    //TODO: refactor this function
    _showFetchedData: function(type, background) {
        if(!background) {
            this.showPopup({
                "type":type
            });
        }

        var success = function(response) {
            if(background) {
                eval("var messages = " + response);
                if(messages.length > 0) {
                    jeTwitterNotifier._messageQueue[type] = new Array();
                    var unReadCount = 0;
                    var lastId = jeTwitterNotifier._getLastId(type);
                    for(var i in messages) {
                        var msg = messages[i];
                        if(lastId < msg.id) {
                            jeTwitterNotifier._messageQueue[type].push(msg);
                            unReadCount++;
                        }
                    }
                    if(unReadCount > 0) {
                        jeTwitterNotifier.updateBalloon(type);
                        jeTwitterNotifier.setUnreadCount(unReadCount, type);
                    }
                }
            }else if(jeTwitterNotifier._popup.isOpen && jeTwitterNotifier._popup.activeTab == type) { //if current active tab has changed or popup closed, do nothing
                eval("var messages = " + response);
                jeTwitterNotifier.showPopup({
                    "msgs": messages,
                    "type": type
                });
            }
            jeTwitterNotifier.hideProgress();
            jeTwitterNotifier.setNextTimer();
        }
        var url = type != "inbox" ? GET_TWITTERS_URLS[type] : INBOX_URL;

        this._popup.showProgress(true);
        var req = new Request(url, {
            onsuccess: success
        });

        var localLastId = 0;
        if(this._localMessages[type] && this._localMessages[type].length > 0) {
            localLastId = this._localMessages[type][0].id;
            if(background && this._messageQueueLastId[type] && this._messageQueueLastId[type] > localLastId)
                localLastId = this._messageQueueLastId[type];
        }

        req.send({
            last_id: localLastId
        });
    },

    showPopup: function(data) {
        if (!isActiveWindow()) {
            return;
        }
        
        this.removeBalloon();
        if(data.type == "inbox") {
            $("private-message-container").setAttribute("hidden", "false");
        }else{
            $("private-message-container").setAttribute("hidden", "true");
        }
        var msgs = new Array();
        var unReadCount = 0;
        var lastId = this._getLastId(data.type);
        if(data.msgs) {
            for(var i in data.msgs) {
                var msg = data.msgs[i];
                if(lastId < msg.id) {
                    msg.unread = true;
                    unReadCount++;
                }
                msgs.push(msg);
            }
            if(unReadCount > 0) {
                this._setLastId(data.msgs[0].id, data.type);
            }
            this.setUnreadCount(unReadCount, data.type);
        }

        if(this._localMessages[data.type]) {
            for(var i in this._localMessages[data.type]) {
                msgs.push(this._localMessages[data.type][i]);
            }
        }

        this._localMessages[data.type] = msgs;
        
        this._popup.removeStatuses();

        this._popup.openPopup();

        if (navigator.platform.match("Mac")) {
            this._popup.input.style.padding = "0px";
        }

        var pm = data.type == "inbox";
        
        for (var i in msgs) {
            if (msgs.hasOwnProperty(i)) {
                var elem = this.createMessageBalloon(msgs[i], true, pm);
                this._popup.appendChild(elem);
            }
        }

        this._popup.setActiveTab(data);

        this._popup.currentUser = jeLoginManager.getLoggedInUser().name;
    },

    updateBalloon: function(type) {
        this._messageQueueLastId[type] = this._messageQueue[type][0].id;
        if(this._getPopup() && this._localMessages[type])
            this.showBalloon(this._messageQueue[type].shift(), type);
    },

    showBalloon: function(message, type) {
        var elem = this.createMessageBalloon(message, false, type == "inbox");
        elem.setAttribute("type", "balloon");
        this.popupBalloon(elem);
    },

    popupBalloon: function(elem) {
        var box = document.createElement("vbox");
        box.id = "twitter-notifier-balloon";

        box.appendChild(elem);
        this._panel.appendChild(box);

        this._balloonTimer = setTimeout("jeTwitterNotifier.onTimeoutBalloon()", 3000);

        elem.setAttribute("boxstyle", "FF3");
        var statusbar = $("status-bar");
        this._panel.openPopup(statusbar, "before_end", -16, 2, false, true);
    },

    onBalloonMouseOver: function(e) {
        this._onFocus = true;
    },

    onBalloonMouseOut: function(e) {
        this._onFocus = false;
        if (this._needToUpdate) {
            this._needToUpdate = false;
            if (this._balloonTimer) {
                clearTimeout(this._balloonTimer);
            }
            this._balloonTimer = setTimeout("jeTwitterNotifier.onTimeoutBalloon()", 1000);
        }
    },

    onTimeoutBalloon: function() {
        if (this._onFocus) {
            this._needToUpdate = true;
            return;
        }

        this.removeBalloon();
        
        if (this._messageQueue["inbox"].length) {
            this.updateBalloon("inbox");
        }else if(this._messageQueue["list"].length) {
            this.updateBalloon("list");
        }
    },

    removeBalloon: function() {
        if (this._balloonTimer) {
            clearTimeout(this._balloonTimer);
        }

        try {
            this._panel.removeChild($("twitter-notifier-balloon"));
            this._panel.hidePopup();
        }
        catch (e) {}
    },

    changeTab: function(name) {
        if(name == this._popup.activeTab) return;
        this._showFetchedData(name);
    },

    refreshCurrentTab: function() {
        this._showFetchedData(this._popup.activeTab);
    },

    closePopup: function() {
        if (this._popup.isOpen) {
            this.setUnreadCount(0);
            this._popup.hidePopup();
        }
    },

    setUnreadCount: function(count, type) {
        $("twitter-statusbar-text").setAttribute("value", count > 0 ? count : "");
        if(type) {
            this._popup.setUnreadCount(count, type);
        }
    },

    getPanel: function() {
        var panel = document.createElement("panel");
        panel.setAttribute("noautofocus", "true");
        panel.setAttribute("noautohide", "true");
        panel.id = "javaeye-twitter-notifier-panel";
        var popupset = $("twitter-popupset");
        popupset.appendChild(panel);
        return panel;
    },

    setFocusToInput: function() {
        this._popup.input.value = this._popup.text;
        this._popup.input.select();
        var pos = this._popup.input.value.length;
        try {
            this._popup.input.setSelectionRange(pos, pos);
        }
        catch (e) {};
    },

    onRevertText: function(text) {
        if (text.value == "") {
            this.closePopup();
        }
        else {
            this._popup.resetText();
            text.select();
        }
        this._inReplyToId = null;
        return true;
    },

    onInsertURL: function() {
        var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Components.interfaces.nsIClipboardHelper);

        clipboard.copyString(content.document.location.toString() + " ");

        var text = $("twitter-notifier-message-input");
        if (!text) {
            return;
        }

        text.focus();
        goDoCommand("cmd_paste");
    },

    onSendMessage: function() {
        if(this._popup.activeTab == "inbox")
            return this.onSendPrivateMessage();
        
        var input = this._popup.input;

        // Ignore autocomplete result
        var re = new RegExp('^@[^ ]+$');
        if (re.test(input.value)) {
            return true;
        }

        if (input.value == '' || input.value.length > 140) {
            return false;
        }

        var success = function(response) {
            jeTwitterNotifier.refreshCurrentTab();
        }

        this._popup.showProgress(true);
        var req = new Request(CREATE_TWITTER_URL, {
            onsuccess: success
        });
        if(this._inReplyToId) {
            req.send({
                body: input.value,
                via: "javaeye_plugin",
                reply_to_id: this._inReplyToId
            });
        }else{
            req.send({
                body: input.value,
                via: "javaeye_plugin"
            });
        }
        this._popup.resetText();
        this._inReplyToId = null;
    },

    onSendPrivateMessage: function() {
        if($F('pm_receiver').strip().length == 0) {
            $('pm_receiver').focus();
            return;
        }
        if($F('pm_title').strip().length == 0) {
            $('pm_title').focus();
            return;
        }
        var input = this._popup.input;
        if(input.value.strip().length == 0) {
            input.focus();
            return;
        }
        var success = function(response) {
            alert("站内短信发送成功");
            jeTwitterNotifier.hideProgress();
            jeTwitterNotifier._popup.resetText();
        }

        var error = function(response) {
            alert("出错了，请检查收件人是否正确");
            jeTwitterNotifier.hideProgress();
        }

        var reply = this._inReplyToId && this._inReplyToName == $("pm_receiver").value;

        var url = reply ? REPLY_MESSAGE_URL : CREATE_MESSAGE_URL;

        var req = new Request(url, {
            onsuccess: success,
            onerror: error
        });
        this._popup.showProgress(true);
        if(reply) {
            req.send({
                title: $("pm_title").value,
                body: input.value,
                receiver_name: $("pm_receiver").value,
                id: this._inReplyToId
            });
        }else{
            req.send({
                title: $("pm_title").value,
                body: input.value,
                receiver_name: $("pm_receiver").value
            });
        }
    },

    deleteTweet: function(target) {
        var tweet = target.parentNode.node;
        var success = function(response) {
            jeTwitterNotifier._popup.removeChild(tweet);
        }
        var req = new Request(DELETE_TWITTER_URL, {
            onsuccess: success
        });
        req.send({
            id: tweet.getAttribute("messageId")
        });
    },

    hideProgress: function() {
        this._popup.showProgress(false);

        var input = this._popup.input;
        input.select();
        input.focus();
    },

    createMessageBalloon: function(msg, highlight, pm) {
        var elem = document.createElement("vbox");
        elem.className = "twitter-notifier-status";
        elem.id = "tooltip-balloon-" + msg.id;
        elem.setAttribute("attr", "list");
        elem.setAttribute("messageId", msg.id);

        var user = pm ? msg.sender : msg.user
        try {
            elem.setAttribute("href", pm ? "http://app.javaeye.com/messages/" + msg.id : "http://" + user.domain + ".javaeye.com/blog/chat");

            elem.setAttribute("screen_name", user.name);
            elem.setAttribute("name", user.domain);
            if (highlight) {
                elem.setAttribute("unread", !msg.unread);
                if(msg.unread) msg.unread = false;
            }

            var time_and_source = this.getLocalTimeForDate(msg.created_at);
            if(pm) {
                time_and_source = msg.title + time_and_source;
            }else{
                if (msg.via == "javaeye_plugin") {
                    time_and_source += " 通过Firefox插件";
                }else{
                    time_and_source += " 通过网页";
                }
            }

            elem.setAttribute("time", time_and_source);

            var body = pm ? msg.plain_body : msg.body
            var textnode = this.replaceLinkText(body);

            elem.setAttribute("text", body);
            if (textnode.getAttribute("attr") == "replies") {
                elem.setAttribute("attr", "replies");
            }

            textnode.setAttribute("tooltiptext", time_and_source);
            elem.appendChild(textnode);


            elem.setAttribute("profile_image_url", user.logo ? USER_LOGO_URL + user.logo.replace(/(\.[a-zA-Z]*$)/, "-thumb$1") : "http://www.javaeye.com/images/user-logo-thumb.gif");
            if(pm) {
                elem.setAttribute("private_message", "true");
                elem.setAttribute("title", msg.title);
            }
        }
        catch (e) {
            this.log("Failed to create message balloon: " + e.message);
        }

        return elem;
    },

    replaceLinkText : function(text) {

        text = this._unescapeHTML.unescape(text.replace(/&amp;/g,"&"));

        var elem = document.createElement("description");
        elem.className = "twitter-notifier-message-body";

        var pat = /((http(s?))\:\/\/)([0-9a-zA-Z\-]+\.)+[a-zA-Z]{2,6}(\:[0-9]+)?(\/([\w#!:.?+=&%@~*\';,\-\/\$])*)?/g;
        var re = /[.,;:]$/;
        while (pat.exec(text) != null) {
            var left = RegExp.leftContext;
            var url = RegExp.lastMatch;
            text = RegExp.rightContext;
            if (re.test(url)) {
                text = RegExp.lastMatch + text;
                url = url.replace(re, '');
            }

            elem.appendChild(document.createTextNode(left));

            var urltext = url;
            if (url.length > 27) {
                urltext = url.substr(0, 27) + "...";
            }
            var anchor = this.createAnchorText(url, urltext, true);
            elem.appendChild(anchor);
            pat.lastIndex = 0;
        }

        if (text) {
            elem.appendChild(document.createTextNode(text));
        }

        return elem;
    },

    createAnchorText: function(link, text, doTinyURL) {
        var anchor = document.createElement("a");
        anchor.className = "twitter-notifier-hyperlink";
        anchor.setAttribute("href", link);

        anchor.setAttribute("tooltiptext", link);

        if (doTinyURL && link.match(this._tinyURL)) {
            anchor.setAttribute("onmouseover", "gTwitterNotifier.onHoverTinyURL(this)");
        }
        anchor.appendChild(document.createTextNode(text));

        return anchor;
    },

    getLocalTimeForDate: function(time) {

        system_date = new Date(time);
        user_date = new Date();
        delta_minutes = Math.floor((user_date - system_date) / (60 * 1000));
        if (Math.abs(delta_minutes) <= (8 * 7 * 24 * 60)) { // eight weeks... I'm lazy to count days for longer than that
            return this.distanceOfTimeInWords(delta_minutes);
        } else {
            return system_date.toLocaleDateString();
        }
    },

    // a vague copy of rails' inbuilt function,
    // but a bit more friendly with the hours.
    distanceOfTimeInWords: function(minutes) {
        if (minutes.isNaN) return "";

        minutes = Math.abs(minutes);
        if (minutes < 50) return minutes + " 分钟前";
        else if (minutes < 90) return "1 小时前"
        else if (minutes < 1080) {
            minutes = Math.round(minutes / 60);
            return minutes + " 小时前"
        }
        else if (minutes < 1440) return "昨天"
        else if (minutes < 2880) return "1 天前"
        else {
            minutes = Math.round(minutes / 1440);
            return minutes + " 天前";
        }
    },

    onPopupHidden: function(event) {
        if (event.target.nodeName == "panel") {
            this.closePopup();
        }
    },

    onBalloonClick: function(e) {
        var node = e.target;
        if (e.button == 0) {
            var url = node.getAttribute('href');

            if (url) {
                this.openURL(url);
            }
        } else if (e.button == 2) {
            var menu = $("twitter-notifier-status-menupopup");
            while (!node.id) {
                node = node.parentNode;
            }
            menu.node = node;
            menu.lastChild.disabled = true;

            if (this._popup.activeTab != "inbox" && jeLoginManager.getLoggedInUser().name.toLowerCase() == node.getAttribute("screen_name").toLowerCase()) {
                menu.lastChild.disabled = false;
            }
        }
    },

    onReply: function(msg, pm) {
        if (!this._popup.isOpen) {
            this.onOpenPopup();
        }

        if(pm) {
            $("pm_receiver").value = msg.getAttribute("screen_name");
            if(msg.getAttribute("private_message") == "true") {
                $("pm_title").value = "Re: " + msg.getAttribute("title");
                this._inReplyToId = msg.getAttribute("messageId");
                this._inReplyToName = msg.getAttribute("screen_name");
            }else{
                this._inReplyToId = null;
            }
            this.changeTab("inbox");
        }else{
            if(this._popup.activeTab == "inbox")
                this.changeTab("list");
            this._inReplyToId = msg.getAttribute("messageId");

            var input = this._popup.input;
            var reply = "@" + msg.getAttribute("screen_name") + " ";

            var text = reply + input.value;
            this._popup.text = text;
            input.value = text;
            this._popup.showTextBox(true);

            this._popup.setAttribute("charcount", text.length == 0 ? "" : 140 - text.length);
            this._popup.setAttribute("charover", (text.length > 140) ? 1 : 0);

            input.focus();
            input.value = text;
        }
    },

    logout: function() {
        jeLoginManager.logout();
        $("twitter-statusbar-button").removeAttribute("state");
        $("twitter-statusbar-button").removeAttribute("context");
        this.closePopup();
        if(this._timer) {
            this._timer.cancel();
        }
    },

    setDelayTask: function(delay, func, data, type) {
        var timer = Components.classes["@mozilla.org/timer;1"]
        .createInstance(Components.interfaces.nsITimer);

        var target = this;

        if (type == null) {
            type = Components.interfaces.nsITimer.TYPE_ONE_SHOT;
        }

        timer.initWithCallback({
            notify: function() {
                target[func](data);
            }
        },
        delay,
        type);
        return timer;
    },

    setNextTimer: function() {
        if(this._timer) {
            this._timer.cancel();
        }
        this._timer = this.setDelayTask(300000, "backGroundFetchData");//5 minutes
    },

    copyMessage: function(target) {
        var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Components.interfaces.nsIClipboardHelper);

        clipboard.copyString(target.parentNode.node.getAttribute("text"));
    },

    retweet: function(target) {
        var tweet = target.parentNode.node;
        var text = "转: @" + tweet.getAttribute("screen_name") + ": " + tweet.getAttribute("text");

        this._popup.text = text;
        this._popup.input.value = text;
        this._popup.showTextBox(true);
        this._popup.input.focus();
    },

    openMessage: function(target) {
        var ele = target.parentNode.node;

        var url = ele.getAttribute("private_message") == "true" ? ("http://app.javaeye.com/messages/" + ele.getAttribute("messageId")) : ("http://" + ele.getAttribute("name") + ".javaeye.com/blog/chat/" + ele.getAttribute("messageId"));
        this.openURL(url);
    },

    openURL: function(url) {
        var browser = $B();
        var newTab = browser.addTab(url);
        browser.selectedTab = newTab;
    },

    _getLastId: function(type) {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        try{
            return prefs.getCharPref("extensions.{appname}@loggedin.user.lastid_" + type);
        }catch(e){
            return 0;
        }
    },

    _setLastId: function(id, type) {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        prefs.setCharPref("extensions.{appname}@loggedin.user.lastid_" + type, id);
    },

    _getPopup: function() {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        try{
            return prefs.getBoolPref("extensions.{appname}@loggedin.user.twitter_popup");
        }catch(e){
            return true;
        }
    },

    _setPopup: function(popup) {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        prefs.setBoolPref("extensions.{appname}@loggedin.user.twitter_popup", popup);
    }
}

var jeTwitterNotifier = new JavaEyeTwitterNotifier();

window.addEventListener("load", function(e) { 
    jeTwitterNotifier.load(e);
}, false);
window.addEventListener("unload", function(e) { 
    jeTwitterNotifier.unload(e);
}, false);
