const SAVE_ITEM_URL = "{javaeyeApiUrl}/user_favorites/create"
const UPDATE_ITEM_URL = "{javaeyeApiUrl}/user_favorites/update"
const DESTROY_ITEM_URL = "{javaeyeApiUrl}/user_favorites/destroy"
const LIST_ITEMS_URL = "{javaeyeApiUrl}/user_favorites/list"

var CC = Components.classes;
var CI = Components.interfaces;

var jeBookmarkManager = {
    item: {
        url: '',
        title: '',
        tags: '',
        description: '',
        created_at: null,
        shared: "true",
        remote_id: -1
    },

    storageService: CC["@mozilla.org/storage/service;1"].getService(CI.mozIStorageService),

    open: function(item) {
        if(!jeLoginManager.getLoggedInUser()) {
            jeLoginManager.promptUserLogin(function() {
                window.close();
            });
        }
        if(jeLoginManager.getLoggedInUser()) {
            if(item) {
                this.item = item;
            }else{
                this._getDoc(window);
            }
            window.openDialog("chrome://{appname}/content/bookmark-editor.xul", "AddBookMarks", "chrome,dialog,centerscreen,resizable=no", this.item);
        }
    },
    
    cancel: function() {
        window.close();
    },

    save_item: function() {
        if($('img_save_spinner').getAttribute("hidden") == "false" || $('img_delete_spinner').getAttribute("hidden") == "false") return;
        
        if($F('tb_title') == "") {
            $('tb_title').focus();
            return;
        }
        if($F('tb_url') == "") {
            $('tb_url').focus();
            return;
        }
        $('img_save_spinner').setAttribute("hidden", "false");
        $("btn_save").setAttribute("disabled", "true");
        $("btn_delete").setAttribute("disabled", "true");
        var success = function(response) {
            eval("var bookmark = " + response);
            jeBookmarkManager.insertRecord(bookmark);
            window.close();
        }
        var req = new Request(this.item.remote_id == -1 ? SAVE_ITEM_URL : UPDATE_ITEM_URL, {
            onsuccess: success
        });
        req.send({
            id: this.item.remote_id,
            title: $F('tb_title'),
            url: $F('tb_url'),
            description: $F('tb_description'),
            tag_list: $F('tb_tags'),
            share: $('cb_no_share').getAttribute("checked") ? "false" : "true"
        });
    },

    sync: function(callback) {
        var success = function(response) {
            eval("var bookmarks = " + response);
            jeBookmarkManager.deleteAll();
            for (i = 0; i < bookmarks.length; i++) {
                jeBookmarkManager.insertRecord(bookmarks[i]);
            }
            if(callback) callback.call();
            window.close();
        };
        new Request(LIST_ITEMS_URL, {
            onsuccess: success
        }).send();
    },
    
    delete_item: function() {
        if($('img_save_spinner').getAttribute("hidden") == "false" || $('img_delete_spinner').getAttribute("hidden") == "false") return;
        var success = function(response) {
            jeBookmarkManager.deleteRecord(response);
            window.close();
        };
        var error = function(response) {
            //ignore not found error
            window.close();
        };
        $('img_delete_spinner').setAttribute("hidden", "false");
        $("btn_delete").setAttribute("disabled", "true");
        $("btn_save").setAttribute("disabled", "true");
        var req = new Request(DESTROY_ITEM_URL, {
            onsuccess: success
        });
        req.send({
            id: this.item.remote_id
            });
    },

    init_item: function() {
        this.item = window.arguments[0];
        var oldItem = this.findByUrl(this.item.url);
        if(oldItem) {
            this.item.title = oldItem.title;
            this.item.tags = oldItem.tags;
            this.item.description = oldItem.description;
            this.item.created_at = oldItem.created_at;
            this.item.remote_id = oldItem.remote_id;
            this.editOp = true;
        }else{
            this.item.tags = "";
            this.item.description = "";
            this.item.created_at = null;
            this.item.remote_id = -1;
            this.editOp = false;
        }

        document.title = $("dlg-bookmark-editor").getAttribute(oldItem ? "editTitle" : "addTitle");
        $("btn_delete").setAttribute("hidden", !this.editOp);
        $("tb_url").value = this.item.url;
        $("tb_title").value = this.item.title;
        $("tb_description").value = this.item.description;
        $("tb_tags").value = this.item.tags;
        $("lbl_user_name").value = decodeURIComponent(jeLoginManager.getLoggedInUser().name);
        if(this.item.created_at != null) $("lbl_created_at").value = "收藏于 " + new Date(this.item.created_at).toLocaleString();
    },
    
    uninit: function() {
        
    },

    _getDoc: function(currWindow) {
        var browser = currWindow.getBrowser();
        var webNav = browser.webNavigation;
        if( webNav.currentURI ) {
            this.item.url = webNav.currentURI.spec;
        }
        if( webNav.document.title ) {
            this.item.title = webNav.document.title;
        }
        else {
            this.item.title = this.item.url;
        }
    },

    init_tags: function() {
        var tags = new Array();
        this.stmFindTags.bindInt64Parameter(0, jeLoginManager.getLoggedInUser().id);
        while(this.stmFindTags.executeStep()) {
            tags.push(this.stmFindTags.getUTF8String(0));
        }
        this.stmFindTags.reset();
        var hash = {};
        for (i = 0; i < tags.length; i++) {
            var t = tags[i].split(",");
            for (j = 0; j < t.length; j++) {
                var tag = t[j].strip();
                if(!hash[tag]) {
                    hash[tag] = 0;
                }
                hash[tag] += 1;
            }
        }
        var result = [];
        for(var key in hash) {
            result.push([key, hash[key]]);
        }
        if(result.length > 0) {
            result.sort(function(a, b) {
                a[0].localeCompare(b[0])
            });
            for (i = 0; i < result.length; i++) {
                if(i % 10 == 0) {
                    $('saved_tags').appendChild(document.createElement("hbox"));
                }
                this._createTagLabel(result[i]);
            }
            $('saved_tags').parentNode.setAttribute("hidden", false);
        }
    },
    
    _createTagLabel: function(tag) {
        var lbl = document.createElement("label");
        lbl.setAttribute("value", tag[0] + " (" + tag[1] + ")" );
        lbl.setAttribute("onclick", "jeBookmarkManager.tagClick('" + tag[0] +"');");
        lbl.setAttribute("class", "label-link");
        lbl.setAttribute("tabindex", "-1" );
        $('saved_tags').lastChild.appendChild(lbl);
    },

    tagClick: function(value) {
        if($F('tb_tags').strip() == "") {
            $('tb_tags').value = value;
        }else{
            $('tb_tags').value = $('tb_tags').value + "," + value;
        }
    },

    init_local_store: function(){
        try {
            if(this._initialized) {
                return;
            }

            this._dbFileName = "javaeye_bookmarks.sqlite";

            this._createDB();
            this._dbConn = this.storageService.openDatabase(this._dbFile);
            this._dbConn.executeSimpleSQL("PRAGMA synchronous = OFF;");

            if (this._dbConn.connectionReady) {
                this._createTables();
                this._setupSQLStatements();
            }
            this._initialized = true;
        }catch (e) {
            throw e;
        }
    },

    _createDB: function(){
        try {
            var dirService = CC[ "@mozilla.org/file/directory_service;1" ].getService(CI.nsIProperties);
            this._dbFile = dirService.get( "ProfD", CI.nsILocalFile );
            this._dbFile.append( this._dbFileName );

            if( !this._dbFile.exists() ) {
                this._dbFile.create( CI.nsIFile.NORMAL_FILE_TYPE, 00644 );
            }

        } catch(e) {
        //ignore
        }
    },

    _createTables: function(){
        var bookmarksTableName = "bookmarks";
        var bookmarksTableSchema = 'url NOT NULL DEFAULT "", title NOT NULL DEFAULT "", description NOT NULL DEFAULT "", '
        + 'tags NOT NULL DEFAULT "", created_at UNSIGNED NOT NULL DEFAULT 0, remote_id UNSIGNED NOT NULL DEFAULT 0, user_id UNSIGNED NOT NULL DEFAULT 0';
        if(!this._dbConn.tableExists(bookmarksTableName)) this._dbConn.createTable(bookmarksTableName, bookmarksTableSchema);
        this._dbConn.executeSimpleSQL("CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title ASC)");
        this._dbConn.executeSimpleSQL("CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url ASC)");
        this._dbConn.executeSimpleSQL("CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_remote_id ON bookmarks(remote_id ASC)");
        this._dbConn.executeSimpleSQL("CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id ASC)");
    },

    _setupSQLStatements: function() {
        this.stmInsertBookmark = this._dbConn.createStatement("INSERT OR REPLACE INTO bookmarks VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)");
        this.stmDeleteBookmark = this._dbConn.createStatement("DELETE FROM bookmarks WHERE remote_id = ?1");
        this.stmFindByUrl = this._dbConn.createStatement("select * from bookmarks where url = ?1 and user_id = ?2");
        this.stmFindAll = this._dbConn.createStatement("select * from bookmarks where user_id = ?1 order by title");
        this.stmDeleteAll = this._dbConn.createStatement("DELETE FROM bookmarks");
        this.stmFindTags = this._dbConn.createStatement("select tags from bookmarks where user_id = ?1 and tags is not null and tags <> ''");
        this.stmSearch = this._dbConn.createStatement("select * from bookmarks where user_id = ?1 and (url like ?2 or title like ?2 or description like ?2 or tags like ?2)");
    },

    insertRecord: function(bookmark) {
        this.stmInsertBookmark.bindUTF8StringParameter(0, bookmark.url);
        this.stmInsertBookmark.bindUTF8StringParameter(1, bookmark.title);
        this.stmInsertBookmark.bindUTF8StringParameter(2, bookmark.description);
        this.stmInsertBookmark.bindUTF8StringParameter(3, bookmark.cached_tag_list);
        this.stmInsertBookmark.bindInt64Parameter(4, Date.parse(bookmark.created_at));
        this.stmInsertBookmark.bindInt64Parameter(5, bookmark.id);
        this.stmInsertBookmark.bindInt64Parameter(6, bookmark.user_id);

        this.stmInsertBookmark.execute();
        this.stmInsertBookmark.reset();
    },

    deleteRecord: function(remote_id) {
        this.stmDeleteBookmark.bindInt64Parameter(0, remote_id);
        this.stmDeleteBookmark.execute();
        this.stmDeleteBookmark.reset();
    },

    findByUrl: function(url) {
        this.stmFindByUrl.bindUTF8StringParameter(0, url);
        this.stmFindByUrl.bindInt64Parameter(1, jeLoginManager.getLoggedInUser().id);
        if(this.stmFindByUrl.executeStep()) {
            var bookmark = this._bookmarkMapper(this.stmFindByUrl);
            this.stmFindByUrl.reset();
            return bookmark;
        }else{
            this.stmFindByUrl.reset();
            return false;
        }
        
    },

    findAll: function() {
        var result = new Array();
        this.stmFindAll.bindInt64Parameter(0, jeLoginManager.getLoggedInUser().id);
        while(this.stmFindAll.executeStep()) {
            result.push(this._bookmarkMapper(this.stmFindAll));
        }
        this.stmFindAll.reset();
        return result;
    },

    deleteAll: function() {
        this.stmDeleteAll.execute();
        this.stmDeleteAll.reset();
    },

    search: function(query) {
        var result = new Array();
        this.stmSearch.bindInt64Parameter(0, jeLoginManager.getLoggedInUser().id);
        this.stmSearch.bindUTF8StringParameter(1, "%" + query + "%");
        while(this.stmSearch.executeStep()) {
            result.push(this._bookmarkMapper(this.stmSearch));
        }
        this.stmSearch.reset();
        return result;
    },

    _bookmarkMapper: function(statement) {
        try {
            var obj = {};
            obj.url = statement.getUTF8String(0);
            obj.title = statement.getUTF8String(1);
            obj.description = statement.getUTF8String(2);
            obj.tags = statement.getUTF8String(3);
            obj.created_at = statement.getInt64(4);
            obj.remote_id = statement.getInt64(5);
            obj.user_id = statement.getInt64(6);
            return obj;
        } catch(e) {
        //ignore
        }
    },

    categoryByTag: function(items) {
        var hash = {};
        for (i = 0; i < items.length; i++) {
            var item = items[i];
            if(item.tags && item.tags.strip() != "") {
                var tags = item.tags.split(",");
                for (j = 0; j < tags.length; j++) {
                    var tag = tags[j].strip();
                    if(!hash[tag]) {
                        hash[tag] = [];
                    }
                    hash[tag].push(item);
                }
            }else{
                if(!hash["_NO_TAG_"]) {
                    hash["_NO_TAG_"] = [];
                }
                hash["_NO_TAG_"].push(item);
            }
        }
        var result = [];
        for(var key in hash) {
            result.push([key, hash[key]]);
        }
        return result;
    }
}


/* Helper functions */
function je_bookmark_manager_onLoad(event) {
    try {
        jeBookmarkManager.init_local_store();
        jeBookmarkManager.init_tags();
        if(window.arguments[0].url) {
            jeBookmarkManager.init_item();
        }
    } catch (e) {
        throw e;
    }
}
/* End of Helper functions */

window.addEventListener("load", je_bookmark_manager_onLoad, false);