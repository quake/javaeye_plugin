var jeBookmarkMain = {
    onLoad: function() {
        this.strings = $("i18n-strings");
        this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        this.checkVersion();
    },

    checkVersion : function() {
        var currentVersionNum = this.strings.getString("version.number");
        try{
            //This will throw an exception for fresh install and in turn set the version number in prefs.
            var num = this.prefs.getCharPref("extensions.{appname}@version.number");
            if(num != currentVersionNum) {
        //we can run upgrade function here
        }
        } catch (e) {
            this.prefs.setCharPref("extensions.{appname}@version.number", currentVersionNum);
            this.addToolbarButtons();
        }
    },

    addToolbarButtons : function() {
        var toolbox = $("navigator-toolbox");

        var toolboxDocument = toolbox.ownerDocument;

        var hasViewBookmarksButton = false, hasEditBookmarkButton = false;

        for (var i = 0; i < toolbox.childNodes.length; ++i) {
            var toolbar = toolbox.childNodes[i];

            if (toolbar.localName == "toolbar"
                && toolbar.getAttribute("customizable")=="true") {

                if(toolbar.currentSet.indexOf("je-button-view-bookmarks") > -1)
                    hasViewBookmarksButton = true;
                if(toolbar.currentSet.indexOf("je-button-edit-bookmark")>-1)
                    hasEditBookmarkButton = true;
            }
        }

        if(!hasViewBookmarksButton || !hasEditBookmarkButton) {
            var toolbar = $("nav-bar");

            var newSet = "";
            var child = toolbar.firstChild;
            while(child){
                //Order of buttons is important
                if(!hasViewBookmarksButton && child.id == "urlbar-container") {
                    newSet += "je-button-view-bookmarks,";
                    hasViewBookmarksButton = true;
                }

                if(!hasEditBookmarkButton
                    && (child.id=="je-button-view-bookmarks"
                        || child.id=="urlbar-container")) {
                    newSet += "je-button-edit-bookmark,";
                    hasEditBookmarkButton = true;
                }

                newSet += child.id+",";
                child = child.nextSibling;
            }

            newSet = newSet.substring(0, newSet.length-1);
            toolbar.currentSet = newSet;
            toolbar.setAttribute("currentset", newSet);
            toolboxDocument.persist(toolbar.id, "currentset");
            try {
                BrowserToolboxCustomizeDone(true);
            } catch (e) {
            /* protect against future change */
            }
        }
    }
}

/* Helper functions */
function je_bookmark_onLoad(event) {
    try {
        jeBookmarkMain.onLoad(event);
    } catch (e) {
        throw e;
    }
}
/* End of Helper functions */

window.addEventListener("load", je_bookmark_onLoad, false);