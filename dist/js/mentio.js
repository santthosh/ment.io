(function () {

    'use strict';

    var popUnderMention = (function () {

        return function (triggerCharSet, selectionEl) {
            var coordinates;
            var mentionInfo = getAtMentionInfo(triggerCharSet);

            if (mentionInfo !== undefined) {

                if (selectedElementIsTextAreaOrInput()) {
                    coordinates = getTextAreaOrInputUnderlinePosition(document.activeElement, mentionInfo.mentionPosition);
                } else {
                    coordinates = getContentEditableCaretPosition(mentionInfo.mentionPosition);
                }
                // Move the button into place.
                selectionEl.css({
                    top: coordinates.top + 'px',
                    left: coordinates.left + 'px',
                    position: 'absolute',
                    zIndex: 100,
                    display: 'block'
                });
            } else {
                selectionEl.css({
                    display: 'none'
                });
            }
        };
    })();

    var selectedElementIsTextAreaOrInput = (function () {
        return function () {
            var element = document.activeElement;
            if (element !== null) {
                var nodeName = element.nodeName;
                if (nodeName === 'INPUT' || nodeName === 'TEXTAREA') {
                    return true;
                } else {
                    return false;
                }
            }
            return false;
        };
    })();

    var selectElement = (function () {
        return function (targetElement, path, offset) {
            var range;
            var elem = targetElement;
            for (var i = 0; i < path.length; i++) {
                elem = elem.childNodes[path[i]];
                if (elem === undefined) {
                    return;
                }
                while (elem.length < offset) {
                    offset -= elem.length;
                    elem = elem.nextSibling;
                }
            }
            if (document.selection && document.selection.createRange) {
                // Clone the TextRange and collapse
                range = document.selection.createRange().duplicate();
                range.select(elem);
                range.selectStartOffset(offset);
                range.selectEndOffset(offset);
                range.collapse(true);
                document.selection.removeAllRanges();
                document.selection.addRange(range);
            } else if (window.getSelection) {
                var sel = window.getSelection();

                range = document.createRange();
                range.setStart(elem, offset);
                range.setEnd(elem, offset);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                targetElement.focus();
            }
        };
    })();

    var pasteHtml = (function () {
        return function (html, startPos, endPos) {
            var range, sel;
            if (document.selection && document.selection.createRange) {
                range = document.selection.createRange().duplicate();
                range.selectStartOffset(startPos);
                range.selectEndOffset(endPos);
                range.collapse(false);
                range.deleteContents();

                range.pasteHTML(html);
            } else if (window.getSelection) {
                sel = window.getSelection();
                range = document.createRange();
                range.setStart(sel.anchorNode, startPos);
                range.setEnd(sel.anchorNode, endPos);
                range.deleteContents();

                var el = document.createElement('div');
                el.innerHTML = html;
                var frag = document.createDocumentFragment(),
                    node, lastNode;
                while ((node = el.firstChild)) {
                    lastNode = frag.appendChild(node);
                }
                range.insertNode(frag);

                // Preserve the selection
                if (lastNode) {
                    range = range.cloneRange();
                    range.setStartAfter(lastNode);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        };
    })();

    var resetSelection = (function () {
        return function (targetElement, path, offset) {
            var nodeName = targetElement.nodeName;
            if (nodeName === 'INPUT' || nodeName === 'TEXTAREA') {
                if (targetElement !== document.activeElement) {
                    targetElement.focus();
                }
            } else {
                selectElement(targetElement, path, offset);
            }
        };
    })();
       
   var replaceMacroText = (function () {
        return function (targetElement, path, offset, macros, text) {
             resetSelection(targetElement, path, offset);

            var macroMatchInfo = getMacroMatch(macros);

            if (macroMatchInfo !== undefined) {
                 if (selectedElementIsTextAreaOrInput()) {
                    var myField = document.activeElement;
                    //IE support
                    if (document.selection) {
                        myField.focus();
                        var sel = document.selection.createRange();
                        sel.selectStartOffset(macroMatchInfo.macroPosition);
                        sel.selectEndOffset(macroMatchInfo.macroPosition + macroMatchInfo.macroText.length);
                        sel.text = text;
                    }
                    //MOZILLA and others
                    else {
                        var startPos = macroMatchInfo.macroPosition;
                        var endPos = macroMatchInfo.macroPosition + macroMatchInfo.macroText.length;
                        myField.value = myField.value.substring(0, startPos) + text +
                            myField.value.substring(endPos, myField.value.length);
                        myField.selectionStart = startPos + text.length;
                        myField.selectionEnd = startPos + text.length;
                    }
                } else {
                    pasteHtml(text, macroMatchInfo.macroPosition,
                        macroMatchInfo.macroPosition + macroMatchInfo.macroText.length);
                }
            }
        };
    })();
       
    var replaceAtMentionText = (function () {
        return function (targetElement, path, offset, triggerCharSet, text) {
            resetSelection(targetElement, path, offset);

            var mentionInfo = getAtMentionInfo(triggerCharSet);

            if (mentionInfo !== undefined) {
                if (selectedElementIsTextAreaOrInput()) {
                    var myField = document.activeElement;
                    //IE support
                    if (document.selection) {
                        myField.focus();
                        var sel = document.selection.createRange();
                        sel.selectStartOffset(mentionInfo.mentionPosition);
                        sel.selectEndOffset(mentionInfo.mentionPosition + mentionInfo.mentionText.length);
                        sel.text = text;
                    }
                    //MOZILLA and others
                    else {
                        var startPos = mentionInfo.mentionPosition;
                        var endPos = mentionInfo.mentionPosition + mentionInfo.mentionText.length + 1;
                        myField.value = myField.value.substring(0, startPos) + text +
                            myField.value.substring(endPos, myField.value.length);
                        myField.selectionStart = startPos + text.length;
                        myField.selectionEnd = startPos + text.length;
                    }
                } else {
                    pasteHtml(text, mentionInfo.mentionPosition,
                        mentionInfo.mentionPosition + mentionInfo.mentionText.length + 1);
                }
            }

        };
    })();

    var getNodePositionInParent = (function () {
        return function (elem) {
            if (elem.parentNode === null) {
                return 0;
            }
            for (var i = 0; i < elem.parentNode.childNodes.length; i++) {
                var node = elem.parentNode.childNodes[i];
                if (node === elem) {
                    return i;
                }
            }
        };
    })();

    var getMacroMatch = (function () {
        return function (macros) {
            var selected, path = [],
                offset;
            if (selectedElementIsTextAreaOrInput()) {
                selected = document.activeElement;
            } else {
                // content editable
                var sel = window.getSelection();
                selected = sel.anchorNode;
                if (selected != null) {
                    var i;
                    var ce = selected.contentEditable;
                    while (selected !== null && ce !== 'true') {
                        i = getNodePositionInParent(selected);
                        path.push(i);
                        selected = selected.parentNode;
                        if (selected !== null) {
                            ce = selected.contentEditable;
                        }
                    }
                    path.reverse();
                    // getRangeAt may not exist, need alternative
                    offset = sel.getRangeAt(0).startOffset;
                }
            }
            var effectiveRange = getTextPrecedingCurrentSelection();
            if (effectiveRange !== undefined && effectiveRange !== null) {
                var triggerChar;
                for (var c in macros) {
                    var idx = effectiveRange.lastIndexOf(c);
                    if (idx >= 0 && c.length + idx === effectiveRange.length) {
                        var prevCharPos = idx - 1;
                        if (idx === 0 || effectiveRange.charAt(prevCharPos) === '\xA0' || effectiveRange.charAt(prevCharPos) === ' ' ) {
                            return { 
                                macroPosition: idx,
                                macroText: c,
                                macroSelectedElement: selected,
                                macroSelectedPath: path,
                                macroSelectedOffset: offset
                            };
                        }
                    }
                }
            }
        };
    })();
       
     var getAtMentionInfo = (function () {
        return function (triggerCharSet) {
            var selected, path = [],
                offset;
            if (selectedElementIsTextAreaOrInput()) {
                selected = document.activeElement;
            } else {
                // content editable
                var sel = window.getSelection();
                selected = sel.anchorNode;
                if (selected != null) {
                    var i;
                    var ce = selected.contentEditable;
                    while (selected !== null && ce !== 'true') {
                        i = getNodePositionInParent(selected);
                        path.push(i);
                        selected = selected.parentNode;
                        if (selected !== null) {
                            ce = selected.contentEditable;
                        }
                    }
                    path.reverse();
                    // getRangeAt may not exist, need alternative
                    offset = sel.getRangeAt(0).startOffset;
                }
            }
            var effectiveRange = getTextPrecedingCurrentSelection();
            if (effectiveRange !== undefined && effectiveRange !== null) {
                var mostRecentAtSymbol = -1;
                var triggerChar;
                triggerCharSet.forEach(function(c) {
                    var idx = effectiveRange.lastIndexOf(c);
                    if (idx > mostRecentAtSymbol) {
                        mostRecentAtSymbol = idx;
                        triggerChar = c;
                    }
                });
                if (mostRecentAtSymbol === 0 || /[\xA0\s]/g.test(
                    effectiveRange.substring(mostRecentAtSymbol - 1, mostRecentAtSymbol))) {
                    var currentAtMentionSnippet = effectiveRange.substring(mostRecentAtSymbol + 1, effectiveRange.length);
                    var triggerChar = effectiveRange.substring(mostRecentAtSymbol, mostRecentAtSymbol+1);
                    if (!(/[\xA0\s]/g.test(currentAtMentionSnippet))) {
                        return {
                            mentionPosition: mostRecentAtSymbol,
                            mentionText: currentAtMentionSnippet,
                            mentionSelectedElement: selected,
                            mentionSelectedPath: path,
                            mentionSelectedOffset: offset,
                            mentionTriggerChar: triggerChar
                        };
                    }
                }
            }
        };
    })();

    var getTextPrecedingCurrentSelection = (function () {
        return function () {
            var text;
            if (selectedElementIsTextAreaOrInput()) {
                var textComponent = document.activeElement;
                // IE version
                if (document.selection !== undefined) {
                    textComponent.focus();
                    var sel = document.selection.createRange();
                    text = sel.text;
                }
                // Mozilla version
                else if (textComponent.selectionStart !== undefined) {
                    var startPos = textComponent.selectionStart;
                    text = textComponent.value.substring(0, startPos);
                }

            } else {
                var selectedElem = window.getSelection().anchorNode; // taSelection.getSelectionElement();
                if (selectedElem != null) {
                    var workingNodeContent = selectedElem.textContent;
                    var selectStartOffset = window.getSelection().getRangeAt(0).startOffset;
                    if (selectStartOffset >= 0) {
                        text = workingNodeContent.substring(0, selectStartOffset);
                    }
                }
            }
            return text;
        };
    })();

    var getContentEditableCaretPosition = (function () {

        var markerTextChar = "\ufeff";
        var markerTextCharEntity = "&#xfeff;";

        var markerEl, markerId = "sel_" + new Date().getTime() + "_" + Math.random().toString().substr(2);

        return function (selectedNodePosition) {
            var range;
            if (document.selection && document.selection.createRange) {
                // Clone the TextRange and collapse
                range = document.selection.createRange().duplicate();
                range.selectStartOffset(selectedNodePosition);
                range.selectEndOffset(selectedNodePosition);
                range.collapse(false);

                // Create the marker element containing a single invisible character by creating literal HTML and insert it
                range.pasteHTML('<span id="' + markerId + '" style="position: relative;">' +
                    markerTextCharEntity + '</span>');
                markerEl = document.getElementById(markerId);
            } else if (window.getSelection) {
                var sel = window.getSelection();
                range = document.createRange();

                range.setStart(sel.anchorNode, selectedNodePosition);
                range.setEnd(sel.anchorNode, selectedNodePosition);

                range.collapse(false);

                // Create the marker element containing a single invisible character using DOM methods and insert it
                markerEl = document.createElement("span");
                markerEl.id = markerId;
                markerEl.appendChild(document.createTextNode(markerTextChar));
                range.insertNode(markerEl);
            }

            var obj = markerEl;
            var coordinates = {
                left: 0,
                top: markerEl.offsetHeight
            };
            do {
                coordinates.left += obj.offsetLeft;
                coordinates.top += obj.offsetTop;
            } while (obj = obj.offsetParent);

            markerEl.parentNode.removeChild(markerEl);
            return coordinates;
        };

    })();

    var getTextAreaOrInputUnderlinePosition = (function () {


        /* jshint browser: true */

        // The properties that we copy into a mirrored div.
        // Note that some browsers, such as Firefox,
        // do not concatenate properties, i.e. padding-top, bottom etc. -> padding,
        // so we have to do every single property specifically.
        var properties = [
            'direction', // RTL support
            'boxSizing',
            'width', // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
            'height',
            'overflowX',
            'overflowY', // copy the scrollbar for IE

            'borderTopWidth',
            'borderRightWidth',
            'borderBottomWidth',
            'borderLeftWidth',

            'paddingTop',
            'paddingRight',
            'paddingBottom',
            'paddingLeft',

            // https://developer.mozilla.org/en-US/docs/Web/CSS/font
            'fontStyle',
            'fontVariant',
            'fontWeight',
            'fontStretch',
            'fontSize',
            'fontSizeAdjust',
            'lineHeight',
            'fontFamily',

            'textAlign',
            'textTransform',
            'textIndent',
            'textDecoration', // might not make a difference, but better be safe

            'letterSpacing',
            'wordSpacing'
        ];

        var isFirefox = (window.mozInnerScreenX !== null);

        return function (element, position) {
            // mirrored div
            var div = document.createElement('div');
            div.id = 'input-textarea-caret-position-mirror-div';
            document.body.appendChild(div);

            var style = div.style;
            var computed = window.getComputedStyle ? getComputedStyle(element) : element.currentStyle; // currentStyle for IE < 9

            // default textarea styles
            style.whiteSpace = 'pre-wrap';
            if (element.nodeName !== 'INPUT') {
                style.wordWrap = 'break-word'; // only for textarea-s
            }

            // position off-screen
            style.position = 'absolute'; // required to return coordinates properly
            style.visibility = 'hidden'; // not 'display: none' because we want rendering

            // transfer the element's properties to the div
            properties.forEach(function (prop) {
                style[prop] = computed[prop];
            });

            if (isFirefox) {
                // Firefox adds 2 pixels to the padding - https://bugzilla.mozilla.org/show_bug.cgi?id=753662
                style.width = (parseInt(computed.width) - 2) + 'px';
                // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
                if (element.scrollHeight > parseInt(computed.height))
                    style.overflowY = 'scroll';
            } else {
                style.overflow = 'hidden'; // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
            }

            div.textContent = element.value.substring(0, position);
            // the second special handling for input type="text" vs textarea: spaces need to be
            // replaced with non-breaking spaces - http://stackoverflow.com/a/13402035/1269037
            if (element.nodeName === 'INPUT') {
                div.textContent = div.textContent.replace(/\s/g, "\u00a0");
            }

            var span = document.createElement('span');
            // Wrapping must be replicated *exactly*, including when a long word gets
            // onto the next line, with whitespace at the end of the line before (#7).
            // The  *only* reliable way to do that is to copy the *entire* rest of the
            // textarea's content into the <span> created at the caret position.
            // for inputs, just '.' would be enough, but why bother?

            // || because a completely empty faux span doesn't render at all
            span.textContent = element.value.substring(position) || '.';
            div.appendChild(span);

            var coordinates = {
                top: span.offsetTop + parseInt(computed.borderTopWidth) + span.offsetHeight,
                left: span.offsetLeft + parseInt(computed.borderLeftWidth)
            };

            var obj = element;
            do {
                coordinates.left += obj.offsetLeft;
                coordinates.top += obj.offsetTop;
            } while (obj = obj.offsetParent);

            document.body.removeChild(div);

            return coordinates;
        };
    })();

    angular.module('mentio', [])
    .directive('mentioMenu', 
        function () {
            return {
                restrict: 'E',
                require: 'ngModel',
                scope: {
                    bind: "&",
                    atVar: "=ngModel",
                    macros: "="
                },
                controller: function($scope, $timeout) {
                    this.addRule = function(rule) {
                        $scope.map[rule.triggerChar] = rule;
                        $scope.triggerCharSet.push(rule.triggerChar);
                        if (this.triggerCharSet === undefined) {
                            this.triggerCharSet = [];    
                        }
                        this.triggerCharSet.push(rule.triggerChar);
                    };
                    $scope.query = function (triggerChar, text) {
                        var remoteScope = $scope.map[triggerChar];
                        remoteScope.showMenu();
                        remoteScope.search({
                            term: $scope.atVar
                        });
                    };
                    this.replaceText = $scope.replaceText = function (triggerChar, item) {
                        // need to set up call to this
                        var remoteScope = $scope.map[triggerChar];
                        var text = remoteScope.select({
                            item: item
                        });
                        replaceAtMentionText($scope.targetElement, $scope.targetElementPath,
                            $scope.targetElementSelectedOffset, $scope.triggerCharSet, text);
                        $scope.atVar = '';
                    };

                    $scope.hideAll = function (text) {
                        for (var key in $scope.map) {
                          if ($scope.map.hasOwnProperty(key)) {
                            $scope.map[key].hideMenu();
                          }
                        }                      
                    };

                    $scope.replaceMacro = function(macro) {
                        var timer = $timeout(function() {
                            replaceMacroText($scope.targetElement, $scope.targetElementPath,
                                $scope.targetElementSelectedOffset, $scope.macros, $scope.macros[macro]);
                        }, 300);
                        $scope.$on('$destroy', function() {
                          $timeout.cancel(timer);
                        });
                    }
               },
                link: function (scope, element, attrs, timeout) {
                    scope.map = {};
                    scope.triggerCharSet = [];
                    scope.$watch(
                        function (scope) {
                            return scope.$eval(scope.bind);
                        },
                        function (value) {
                            var mentionInfo = getAtMentionInfo(scope.triggerCharSet);
                            if (mentionInfo !== undefined) {
                                /** save selection info about the target control for later re-selection */
                                scope.targetElement = mentionInfo.mentionSelectedElement;
                                scope.targetElementPath = mentionInfo.mentionSelectedPath;
                                scope.targetElementSelectedOffset = mentionInfo.mentionSelectedOffset;

                                /* store model */
                                scope.atVar =  mentionInfo.mentionText;
                                /* perform query */
                                scope.query(mentionInfo.mentionTriggerChar,
                                    mentionInfo.mentionText);
                            } else {
                                scope.atVar = '';
                                scope.hideAll();

                                var macroMatchInfo = getMacroMatch(scope.macros);
                                if(macroMatchInfo !== undefined) {
                                    scope.targetElement = macroMatchInfo.macroSelectedElement;
                                    scope.targetElementPath = macroMatchInfo.macroSelectedPath;
                                    scope.targetElementSelectedOffset = macroMatchInfo.macroSelectedOffset;
                                    scope.replaceMacro(macroMatchInfo.macroText);
                                }
                            }
                        }
                    );
                                    }
            };
        }
    )
    .directive('mentioRule', function () {
        var setupKeyCapture = function (scope, input) {
            angular.element(input).bind("keydown keypress", function (event) {
                if (!scope.hide) {
                    if (event.which === 27) {
                        scope.$apply(function () {
                            scope.hide = true;
                        });
                        event.preventDefault();
                    }

                    if (event.which === 40) {
                        event.preventDefault();
                        scope.$apply(function () {
                            scope.activateNextItem();
                        });
                    }

                    if (event.which === 38) {
                        event.preventDefault();
                        scope.$apply(function () {
                            scope.activatePreviousItem();
                        });
                    }

                    if (event.which === 13) {
                        event.preventDefault();
                        scope.$apply(function () {
                            scope.selectActive();
                        });
                    }
                }
            });
        };

        return {
            restrict: 'E',
            scope: {
                search: "&",
                select: "&",
                items: "="
            },
            require: '^mentioMenu',
            templateUrl: function(tElement, tAttrs) {
                return tAttrs.template;
            },
            controller: ['$scope', '$attrs', function ($scope, $attrs) {
                $scope.items = [];
                $scope.hide = true;

                $scope.triggerChar = $attrs.triggerChar;

                this.activate = $scope.activate = function (item) {
                    $scope.active = item;
                };

                $scope.activateNextItem = function () {
                    var index = $scope.items.indexOf($scope.active);
                    this.activate($scope.items[(index + 1) % $scope.items.length]);
                };

                $scope.activatePreviousItem = function () {
                    var index = $scope.items.indexOf($scope.active);
                    this.activate($scope.items[index === 0 ? $scope.items.length - 1 : index - 1]);
                };

                this.isActive = $scope.isActive = function (item) {
                    return $scope.active === item;
                };

                $scope.selectActive = function () {
                    $scope.selector($scope.active);
                };

                this.selector = $scope.selector = function (item) {
                    $scope.hide = true;
                    $scope.controller.replaceText($scope.triggerChar, item);
                };

                $scope.isVisible = function () {
                    return !$scope.hide;
                };

                $scope.showMenu = function () {
                    $scope.requestVisiblePendingSearch = true;
                };

                $scope.hideMenu = function () {
                    $scope.hide = true;
                };
                // $scope.query = function () {
                //     $scope.requestVisiblePendingSearch = true;
                //     $scope.search({
                //         term: $scope.atVar
                //     });
                // };
            }],

            link: function (scope, element, attrs, controller) {
                controller.addRule(scope);
                scope.controller = controller;

                var $list = element;
                element[0].parentNode.removeChild(element[0]);
                document.body.appendChild(element[0]);

                setupKeyCapture(scope, document.body);

                scope.$watch('items', function (items) {
                    if (items.length > 0) {
                        scope.activate(items[0]);
                        if (scope.hide && scope.requestVisiblePendingSearch) {
                            scope.hide = false;
                            scope.requestVisiblePendingSearch = false;
                        }
                    } else {
                        scope.hide = true;
                    }
                });

                scope.$watch('isVisible()', function (visible) {
                    if (visible) {
                        popUnderMention(controller.triggerCharSet, $list);
                    } else {
                        $list.css('display', 'none');
                    }
                });

            }
        };
    })
    .directive('mentioMenuItem', function () {
        return {
            restrict: 'A',
            scope: {
                mentioMenuItem: "="
            },
            require: '^mentioRule',
            link: function (scope, element, attrs, controller) {

                var item = scope.mentioMenuItem;

                scope.$watch(function () {
                    return controller.isActive(item);
                }, function (active) {
                    if (active) {
                        element.addClass('active');
                    } else {
                        element.removeClass('active');
                    }
                });

                element.bind('mouseenter', function (e) {
                    scope.$apply(function () {
                        controller.activate(item);
                    });
                });

                element.bind('click', function (e) {
                    scope.$apply(function () {
                        controller.selector(item);
                    });
                });
            }
        };
    });
})();