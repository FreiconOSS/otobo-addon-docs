// "Open in my OTOBO": the reader enters the address of their own OTOBO once; every
// setting in the reference then gets a link straight to it in the admin interface.
// The address stays in this browser (localStorage) and is never sent anywhere.
(function () {
    'use strict';

    var StorageKey = 'otoboSysconfigBaseUrl';

    function load() {
        try {
            return window.localStorage.getItem(StorageKey) || '';
        } catch (e) {
            return '';
        }
    }

    function save(value) {
        try {
            if (value) {
                window.localStorage.setItem(StorageKey, value);
            } else {
                window.localStorage.removeItem(StorageKey);
            }
        } catch (e) {
            // private window or blocked storage: the link still works for this page view
        }
    }

    // Accepts "otobo.example.com", "https://otobo.example.com", ".../otobo/" or
    // ".../otobo/index.pl" and returns "https://host/path/index.pl", or '' if unusable.
    function normalize(input) {
        var value = (input || '').trim();
        if (!value) {
            return '';
        }
        if (!/^https?:\/\//i.test(value)) {
            value = 'https://' + value;
        }
        var url;
        try {
            url = new URL(value);
        } catch (e) {
            return '';
        }
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
            return '';
        }
        var path = url.pathname.replace(/\/+$/, '');
        if (!/index\.pl$/.test(path)) {
            path = (path || '/otobo') + '/index.pl';
        }
        return url.origin + path;
    }

    function settingUrl(base, name) {
        return base + '?Action=AdminSystemConfiguration;Subaction=View;Setting=' + encodeURIComponent(name);
    }

    // A branch of the navigation tree, e.g. "Frontend::Agent::View::TicketZoom".
    function groupUrl(base, navigation) {
        return base + '?Action=AdminSystemConfigurationGroup;RootNavigation=' + encodeURIComponent(navigation);
    }

    // Any hand-picked list of settings, shown and editable on one page.
    function customGroupUrl(base, names) {
        return base + '?Action=AdminSystemConfiguration;Subaction=ViewCustomGroup;' +
            names.map(function (name) { return 'Names=' + encodeURIComponent(name); }).join(';');
    }

    function headingText(heading) {
        var clone = heading.cloneNode(true);
        clone.querySelectorAll('.headerlink, .otobo-open').forEach(function (el) { el.remove(); });
        return clone.textContent.trim();
    }

    function setLink(parent, className, text, href) {
        var link = parent.querySelector(':scope > .' + className);
        if (!href) {
            if (link) {
                link.remove();
            }
            return;
        }
        if (!link) {
            link = document.createElement('a');
            link.className = 'otobo-open ' + className;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = text;
            parent.appendChild(link);
        }
        link.href = href;
    }

    function settingName(dt) {
        var sig = dt.querySelector('.sig-name');
        if (sig) {
            return sig.textContent.trim();
        }
        var clone = dt.cloneNode(true);
        clone.querySelectorAll('.headerlink, .otobo-open').forEach(function (el) { el.remove(); });
        return clone.textContent.trim();
    }

    function renderLinks(base) {
        // every setting of the reference
        document.querySelectorAll('dl.setting > dt').forEach(function (dt) {
            setLink(dt, 'otobo-open-setting', 'In meinem OTOBO öffnen ↗',
                base && settingUrl(base, settingName(dt)));
        });

        // reference pages: every heading that is a navigation path opens that branch
        // (not on the 11.1 page, whose new groups do not exist on an 11.0 system)
        var isVersionPage = /version-11-1\.html$/.test(window.location.pathname);
        document.querySelectorAll('section > h2, section > h3').forEach(function (heading) {
            var section = heading.parentElement;
            if (!section.querySelector(':scope > dl.setting')) {
                return;
            }
            var navigation = headingText(heading);
            var valid = !isVersionPage && /^[A-Za-z]+(::[A-Za-z0-9]+)*$/.test(navigation);
            setLink(heading, 'otobo-open-group', 'Gruppe in meinem OTOBO öffnen ↗',
                base && valid && groupUrl(base, navigation));
        });

        // topic chapters: a section that mentions several settings opens all of them at once
        document.querySelectorAll('section > h2').forEach(function (heading) {
            var section = heading.parentElement;
            if (section.querySelector('dl.setting')) {
                return;
            }
            var names = [];
            section.querySelectorAll('code.std-setting').forEach(function (code) {
                var name = code.textContent.replace(/\s+/g, ' ').trim();
                if (names.indexOf(name) === -1) {
                    names.push(name);
                }
            });
            setLink(heading, 'otobo-open-group',
                'Alle ' + names.length + ' Einstellungen in meinem OTOBO öffnen ↗',
                base && names.length >= 2 && customGroupUrl(base, names));
        });
    }

    function buildBox() {
        var anchor = document.querySelector('.sidebar-search-container');
        if (!anchor) {
            return null;
        }
        var box = document.createElement('div');
        box.className = 'otobo-base';
        box.innerHTML =
            '<label for="otobo-base-input">Mein OTOBO</label>' +
            '<div class="otobo-base-row">' +
            '<input id="otobo-base-input" type="text" inputmode="url" autocomplete="url" ' +
            'placeholder="otobo.example.com" spellcheck="false">' +
            '<button type="button">Merken</button>' +
            '</div>' +
            '<p class="otobo-base-hint"></p>';
        anchor.insertAdjacentElement('afterend', box);
        return box;
    }

    function init() {
        var base = load();
        var box = buildBox();
        renderLinks(base);
        if (!box) {
            return;
        }
        var input = box.querySelector('input');
        var button = box.querySelector('button');
        var hint = box.querySelector('.otobo-base-hint');

        function showState(current) {
            input.value = current;
            hint.textContent = current
                ? 'Einstellungen und Gruppen öffnen sich in diesem System. Die Adresse bleibt nur in Ihrem Browser.'
                : 'Adresse eintragen, dann führen Einstellungen und ganze Abschnitte direkt in Ihr OTOBO.';
        }

        function apply() {
            var raw = input.value;
            var normalized = normalize(raw);
            if (raw.trim() && !normalized) {
                hint.textContent = 'Das ist keine gültige Adresse.';
                return;
            }
            save(normalized);
            renderLinks(normalized);
            showState(normalized);
        }

        button.addEventListener('click', apply);
        input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                apply();
            }
        });
        showState(base);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
