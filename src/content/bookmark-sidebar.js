/* TODO refactor duplicate callback code */
var jeBookmarkSidebar = {
    populateTree: function(items) {
        this._populateBookmarksTree(items);
        this._populateTagsTree(jeBookmarkManager.categoryByTag(items));
    },
    
    _populateBookmarksTree: function(items) {
        this.bookmarksTreeView.items = items;
        this.bookmarksTreeView.rowCount = items.length;
        $('tree-bookmarks').view = this.bookmarksTreeView;
        $('lbl_bookmarks_count').value = items.length;
    },

    _populateTagsTree: function(tags) {
        this.tagsTreeView.items = tags;
        this.tagsTreeView.rowCount = tags.length;
        $('tree-tags').view = this.tagsTreeView;
        $('lbl_tags_count').value = tags.length;
    },

    tagsTreeView: {
        items: [],
        rowCount : 0,
        getCellText : function(row,column){
            if (column.id == "th_tag_name") return this.items[row][0];
            if (column.id == "th_tag_num") return this.items[row][1].length;
            return null;
        },
        getImageSrc : function(row, col) {
            return null;
        },
        setTree: function(treebox){
            this.treebox = treebox;
        },
        isContainer: function(row){
            return false;
        },
        isSeparator: function(row){
            return false;
        },
        isSorted: function(){
            return false;
        },
        getLevel: function(row){
            return 0;
        },
        getRowProperties: function(row,props){},
        getCellProperties: function(row,col,props){},
        getColumnProperties: function(colid,col,props){}
    },
    
    bookmarksTreeView: {
        items: [],
        rowCount : 0,
        getCellText : function(row,column){
            if (column.id == "th_bookmark_title") return this.items[row].title;
            if (column.id == "th_bookmark_description") return this.items[row].description;
            if (column.id == "th_bookmark_created_at") return this.items[row].created_at;
            if (column.id == "th_bookmark_url") return this.items[row].url;
            return null;
        },
        getImageSrc : function(row, col) {
            if ("th_bookmark_description" === col.id && this.items[row].description != "") {
                return "chrome://{appname}/skin/note.gif";
            }else{
                return null;
            }
        },
        setTree: function(treebox){ 
            this.treebox = treebox;
        },
        isContainer: function(row){ 
            return false;
        },
        isSeparator: function(row){ 
            return false;
        },
        isSorted: function(){ 
            return false;
        },
        getLevel: function(row){ 
            return 0;
        },
        getRowProperties: function(row,props){},
        getCellProperties: function(row,col,props){},
        getColumnProperties: function(colid,col,props){}
    },

    openItem: function(tree, new_tab) {
        try {
            var row = tree.currentIndex;
            if (tree.view.rowCount <= 0) {
                return;
            }

            this.openUrl(this.bookmarksTreeView.items[row].url, new_tab);
        } catch (e) {
        //ignore
        }
    },

    editItem: function(tree) {
        try {
            var row = tree.currentIndex;
            if (tree.view.rowCount <= 0) {
                return;
            }

            jeBookmarkManager.open(this.bookmarksTreeView.items[row]);
        } catch (e) {
        //ignore
        }
    },

    openUrl: function(url, new_tab) {
        if(new_tab) {
            var browser = $B();
            var newTab = browser.addTab(url);
            browser.selectedTab = newTab;
        }else{
            content.document.location.href = url;
        }
    },

    filterByTag: function(tree) {
        try {
            var row = tree.currentIndex;
            if (tree.view.rowCount <= 0) {
                return;
            }
            this._populateBookmarksTree(this.tagsTreeView.items[row][1]);
        } catch (e) {
        //ignore
        }
    },

    search: function(query) {
        if(query != "") {
            $('search-reset').setAttribute("disabled", "false");
            this.populateTree(jeBookmarkManager.search(query));
        }
    },

    sortTree: function(treeName, orderBy) {
        if(treeName == "tags") {
            this.tagsTreeView.items = this.tagsTreeView.items.sort(this.sortFunctions[orderBy]);
        }else{
            this.bookmarksTreeView.items = this.bookmarksTreeView.items.sort(this.sortFunctions[orderBy]);
        }
    },

    sortFunctions: {
        tag_alpha: function(a, b) {
            return a[0].localeCompare(b[0]);
        },
        tag_number: function(a, b) {
            return b[1].length - a[1].length;
        },
        bookmark_alpha: function(a, b) {
            return a.title.localeCompare(b.title);
        },
        bookmark_date: function(a, b) {
            return a.created_at - b.created_at;
        },
        bookmark_site: function(a, b) {
            return a.url.localeCompare(b.url);
        }
    },

    sync: function() {
        if(!jeLoginManager.getLoggedInUser()) {
            jeLoginManager.promptUserLogin(function(){
                jeBookmarkSidebar.populateTree(jeBookmarkManager.findAll());
                $("lbl_user_name").value = decodeURIComponent(jeLoginManager.getLoggedInUser().name);
                $("lbl_logout").setAttribute("hidden", "false");
                $("lbl_login").setAttribute("hidden", "true");
                window.close();
            });
        }else{
            $('sync_spinner').setAttribute("hidden", "false");
            jeBookmarkManager.sync(function(){
                jeBookmarkSidebar.populateTree(jeBookmarkManager.findAll());
                $('sync_spinner').setAttribute("hidden", "true");
            });
        }
    },

    reset: function() {
        $("tree-tags").view.selection.clearSelection();
        $("tree-bookmarks").view.selection.clearSelection();
        $('search-reset').setAttribute("disabled", "true");
        $('tb_query').value = '';
        this.populateTree(jeBookmarkManager.findAll());
    },

    logout: function() {
        this._populateBookmarksTree([]);
        this._populateTagsTree([]);
        $('search-reset').setAttribute("disabled", "true");
        $('tb_query').value = '';
        jeLoginManager.logout();
        $("lbl_user_name").value = "";
        $("lbl_logout").setAttribute("hidden", "true");
        $("lbl_login").setAttribute("hidden", "false");
    }
}

function je_bookmark_sidebar_onLoad(event) {
    if(!jeLoginManager.getLoggedInUser().id) {
        jeLoginManager.promptUserLogin(function(){
            jeBookmarkSidebar.populateTree(jeBookmarkManager.findAll());
            $("lbl_user_name").value = decodeURIComponent(jeLoginManager.getLoggedInUser().name);
            $("lbl_logout").setAttribute("hidden", "false");
            $("lbl_login").setAttribute("hidden", "true");
        });
    }else{
        jeBookmarkSidebar.populateTree(jeBookmarkManager.findAll());
        $("lbl_user_name").value = decodeURIComponent(jeLoginManager.getLoggedInUser().name);
        $("lbl_logout").setAttribute("hidden", "false");
        $("lbl_login").setAttribute("hidden", "true");
    }
}

window.addEventListener("load", je_bookmark_sidebar_onLoad, false);
