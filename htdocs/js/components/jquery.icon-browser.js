(function($) {

function IconBrowser($el, options) {
    var iconBrowser = this;
    var modalSelector = "#" + options.modalId;
    var scrollPositionDogear;

    $.extend(iconBrowser, {
        element: $el,
        modal: $(modalSelector),
        modalId: options.modalId
    });

    $(options.triggerSelector).attr("data-reveal-id", options.modalId);

    new Options(this.modal, options.preferences);

    $(document)
        .on('open.fndtn.reveal', modalSelector, function(e) {
            // hackety hack -- being triggered on both 'open' and 'open.fndtn.reveal'; just want one
            if (e.namespace === "") return;

            // If the page scrolled sideways, don't put the modal way out in left field.
            iconBrowser.modal.css('left', window.scrollX);

            iconBrowser.loadIcons();
            iconBrowser.registerListeners();
        })
        // Save and restore the scroll position when opening and closing the
        // modal. This is crucial on mobile if you have dozens of icons, because
        // otherwise it'll ditch you miles out into the comment thread, as you
        // wonder where you left your reply form and whether you have enough
        // water to survive the walk back to the gas station.
        .on('opened.fndtn.reveal', modalSelector, function(e) {
            // hackety hack -- being triggered on both 'opened' and 'opened.fndtn.reveal'; just want one
            if (e.namespace === "") return;

            scrollPositionDogear = $(window).scrollTop();
            iconBrowser.modal.removeAttr('tabindex'); // WHY does foundation.reveal set this.
            iconBrowser.focusSearch();
        })
        .on('closed.fndtn.reveal', modalSelector, function(e) {
            // hackety hack -- being triggered on both 'closed' and 'closed.fndtn.reveal'; just want one
            if (e.namespace === "") return;

            if ( Math.abs( $(window).scrollTop() - scrollPositionDogear ) > 500 ) {
                $(window).scrollTop(scrollPositionDogear);
            }

            // the browser blew away the user's tab-through position, so restore
            // it on the icon menu, since that's what they just indirectly set a
            // value for.
            $el.focus();
        });
}

IconBrowser.prototype = {
    kwToIcon: {},
    selectedId: undefined,
    selectedKeyword: undefined,
    isLoaded: false,
    listenersRegistered: false,
    loadIcons: function() {
        var iconBrowser = this;
        if ( iconBrowser.isLoaded ) {
            iconBrowser.resetFilter();
            iconBrowser.initializeKeyword();
        } else {
            var searchField = $("#js-icon-browser-search");
            searchField.prop("disabled", true);

            var url = Site.currentJournalBase ? "/" + Site.currentJournal + "/__rpc_userpicselect" : "/__rpc_userpicselect";
            $.getJSON(url).then(function(data) {
                var $content = $("#js-icon-browser-content");
                var $status = $content.find(".icon-browser-status");

                if ( !data ) {
                    $status.html("<p>Unable to load icons</p>");
                    return;
                }

                if ( data.alert ) {
                    $status.html("<p>" + data.alert + "</p>");
                    return;
                }

                $status.remove();

                var $iconslist = $content.find("ul");
                $iconslist.empty();

                var pics = data.pics;
                $.each(data.ids, function(index,id) {
                    var icon = pics[id];
                    var idstring = "js-icon-browser-icon-"+id;

                    var $img = $("<img />").attr( {
                            src: icon.url,
                            alt: icon.alt,
                            height: icon.height,
                            width: icon.width,
                            role: "button",
                            tabindex: "0",
                            "class": "th" } )
                        .wrap("<a>").parent()
                        .wrap("<div class='icon-browser-icon-image'></div>").parent();
                    var $keywords = "";
                    if ( icon.keywords ) {
                        $keywords = $("<div class='keywords'></div>");

                        $.each(icon.keywords, function(i, kw) {
                            iconBrowser.kwToIcon[kw] = idstring;
                            $keywords
                                .append( $("<a class='keyword radius' role='button' tabindex='0' data-kw='" + kw + "'></a>").text(kw) )
                                .append(document.createTextNode(" "));

                        });
                    }

                    var $comment = ( icon.comment != "" ) ? $("<small class='icon-browser-item-comment'></small>").text( icon.comment ) : "";

                    var $meta = $("<div class='icon-browser-item-meta'></div>").append($keywords).append($comment);
                    var $item = $("<div class='icon-browser-item'></div>").append($img).append($meta);
                    $("<li></li>").append($item).appendTo($iconslist)
                        .data( "keywords", icon.keywords.join(" ").toLocaleUpperCase() )
                        .data( "comment", icon.comment.toLocaleUpperCase() )
                        .data( "alt", icon.alt.toLocaleUpperCase() )
                        .data( "defaultkw", icon.keywords[0] )
                        .attr( "id", idstring );
                });

                searchField.prop("disabled", false);

                iconBrowser.initializeKeyword();
            });
            iconBrowser.isLoaded = true;
        }
    },
    deregisterListeners: function() {
        $(document).off('keydown.icon-browser');
    },
    registerListeners: function() {
        $(document).on('keydown.icon-browser', this.keyboardNav.bind(this));

        if ( this.listenersRegistered ) return;

        $("#js-icon-browser-content")
            .on("click", ".icon-browser-item", this.selectByClick.bind(this))
            .on("dblclick", ".icon-browser-item", this.selectByDoubleClick.bind(this));

        this.modal
            .find(".keyword-menu")
                .on("click", ".keyword", this.selectByKeywordMenuClick.bind(this))
                .on("dblclick", ".keyword", this.selectByKeywordMenuDoubleClick.bind(this));

        $("#js-icon-browser-search").on("keyup click", this.filter.bind(this));
        $("#js-icon-browser-select").on("click", this.updateOwner.bind(this));

        $(document)
            .on('closed.fndtn.reveal', '#' + this.modalId, this.deregisterListeners.bind(this));

        this.listenersRegistered = true;
    },
    focusSearch: function() {
        $('#js-icon-browser-search').focus();
    },
    keyboardNav: function(e) {
        if ( $(e.target).is('#js-icon-browser-search') ) return;

        if ( e.key === 'Enter' || (! e.key && e.keyCode === 13) ) {
            $(e.target).trigger('click');
        } else if ( e.key === '/' || (! e.key && e.keyCode === 191) ) {
            e.preventDefault();
            $("#js-icon-browser-search").focus();
        }
    },
    selectByClick: function(e) {
        e.stopPropagation();
        e.preventDefault();

        // Some browsers don't focus buttons or role=buttons on click, and we
        // want predictable behavior when people combine click + tab/enter.
        e.target.focus();

        // If this is the second click, treat it as confirmation:
        if ( $(e.target).hasClass("active") ) {
            this.updateOwner.call(this, e);
        } else {
            // this may be on either the icon or the keyword
            var container = $(e.target).closest("li");
            var keyword = $(e.target).closest("a.keyword");

            this.doSelect(container, keyword.length > 0 ? keyword.text() : null, true);

            // If they chose a keyword, treat it as confirmation:
            if (keyword.length > 0) {
                this.updateOwner.call(this, e);
            }
        }
    },
    selectByDoubleClick: function(e) {
        this.selectByClick.call(this, e);
        this.updateOwner.call(this, e);
    },
    selectByKeywordMenuClick: function(e) {
        e.stopPropagation();
        e.preventDefault();

        var keyword = $(e.target).text();
        var id = this.kwToIcon[keyword];
        if ( id ) {
            this.doSelect($("#" + id), keyword, false);
            // If they chose a keyword, treat it as confirmation:
            this.updateOwner.call(this, e);
        }
    },
    selectByKeywordMenuDoubleClick: function(e) {
        this.selectByKeywordMenuClick(e);
    },
    initializeKeyword: function() {
        var keyword = this.element.val();
        this.doSelect($("#" + this.kwToIcon[keyword]), keyword, true);
    },
    doSelect: function($container, keyword, replaceKwMenu) {
        var iconBrowser = this;

        $("#" + iconBrowser.selectedId).find(".th, a").removeClass("active");

        if ( ! $container || $container.length === 0 ) {
            // more like DON'Tselect.
            iconBrowser.selectedKeyword = undefined;
            iconBrowser.selectedId = undefined;
            // move keyword menu and select button back to their original spots
            $("#js-icon-browser-content").before(
                iconBrowser.modal.find("#inline-keyword-menu, #icon-browser-select-button-wrapper")
            )
            return;
        }

        // select keyword
        if ( keyword != null ) {
            // select by keyword
            iconBrowser.selectedKeyword = keyword;
        } else {
            // select by picid (first keyword)
            iconBrowser.selectedKeyword = $container.data("defaultkw");
        }

        iconBrowser.selectedId = $container.attr("id");
        $container
            .show()
            .find(".th, a[data-kw='" + iconBrowser.selectedKeyword + "']")
                .addClass("active");

        // update keyword menus, move inline menu and select button
        if ( replaceKwMenu ) {
            var $currentKeywords = $container.find(".keywords");
            var $oldKeywords = iconBrowser.modal.find(".keyword-menu")
                .find(".keywords");
            $currentKeywords.clone().replaceAll($oldKeywords);
            // adopt inline menu as sibling:
            $container.after( $('#inline-keyword-menu') );
            // adopt select button as child:
            $container.append( $('#icon-browser-select-button-wrapper') );
        } else {
            iconBrowser.modal.find(".keyword-menu .active")
                .removeClass("active");
        }

        // selected element in the keyword menu (can't use cached query because
        // we may have replaced the keyword-menu element)
        iconBrowser.modal.find(".keyword-menu .keyword")
            .filter(function() {
                return $(this).text() == iconBrowser.selectedKeyword;
            })
            .addClass("active");
    },
    updateOwner: function(e) {
        if (this.selectedKeyword) {
            this.element
                .val(this.selectedKeyword)
                .triggerHandler("change");
        }

        this.close();
    },
    close: function() {
        this.modal.foundation('reveal', 'close');
    },
    filter: function(e) {
        if (this.selectedKeyword) {
            if ( e.key === 'Enter' || (! e.key && e.keyCode === 13) ) {
                this.updateOwner.call(this, e);
                return;
            }
        }

        var val = $(e.target).val().toLocaleUpperCase();

        if ( ! this.contentElement ) {
            this.contentElement = $("#js-icon-browser-content");
        }

        this.contentElement
            .find("li").each(function(i, item) {
                if ( $(this).data("keywords").indexOf(val) == -1
                    && $(this).data("comment").indexOf(val) == -1
                    && $(this).data("alt").indexOf(val) == -1 ) {

                    $(this).css('display', 'none');
                } else {
                    $(this).css('display', ''); // Reason we aren't using .show() is bc it forcibly sets 'display: block'.
                }
            });

        var $visible = $("#js-icon-browser-content li:visible");
        if ( $visible.length == 1 ) {
            this.doSelect($visible, null, true);
        } else if ( ! $visible.is('#' + this.selectedId) ) {
            // The previously selected icon doesn't match the filter anymore, so deselect it.
            this.doSelect(null, null, true);
        }
    },
    resetFilter: function() {
        $("#js-icon-browser-search").val("");
        $("#js-icon-browser-content li").show();
    }
};

function Options(modal, prefs) {
    $.extend(this, {
        modal: modal
    });
    $("#js-icon-browser-meta-toggle a")
        .click(this.toggleMetaText.bind(this))
        .filter(prefs.metatext ? "[data-action='text']" : "[data-action='no-text']")
            .triggerHandler("click", true);

    $("#js-icon-browser-size-toggle a")
        .click(this.toggleIconSize.bind(this))
        .filter(prefs.smallicons ? "[data-action='small']" : "[data-action='large']")
            .triggerHandler("click", true);
}

function toggleLinkState($el, init) {
    $el.addClass("inactive-toggle")
        .siblings()
            .removeClass("inactive-toggle");
}

Options.prototype = {
    toggleMetaText: function(e, init) {
        e.preventDefault();

        var $link = $(e.target);
        if ( $link.data("action") === "text" ) {
            this.modal.removeClass("no-meta");
            if ( !init ) this.save( "metatext", true );
        } else {
            this.modal.addClass("no-meta");
            if ( !init ) this.save( "metatext", false );
        }

        toggleLinkState($link);
    },
    toggleIconSize: function(e, init) {
        e.preventDefault();

        var $link = $(e.target);
        if ( $link.data("action") === "large" ) {
            this.modal.removeClass("small-icons");

            if ( !init ) this.save( "smallicons", false );
        } else {
            this.modal.addClass("small-icons");

            if ( !init ) this.save( "smallicons", true );
        }

        toggleLinkState($link);
    },
    save: function(option, value) {
        var params = {};
        params[option] = value;

        // this is a best effort thing, so be silent about success/error
        $.post( "/__rpc_iconbrowser_save", params );
    }
};

$.fn.extend({
    iconBrowser: function(options) {

        return $(this).each(function(){
            var defaults = {
                // triggerSelector: "#icon-browse-button, #icon-preview",
                // modalId: "icon-browser",
                // preferences: { metatext: true, smallicons: false }
            };

            new IconBrowser($(this), $.extend({}, defaults, options));
        });

    }
});

})(jQuery);
