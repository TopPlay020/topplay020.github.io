/* Topplay020 · Portfolio
   data.json drives every piece of content. Each item carries both languages ({ en, ar }),
   so the two languages cannot drift apart. Validate with: node scripts/check-data.mjs
   The low-poly 3D world lives in scene.js and is loaded after the page is readable. */
(() => {
    'use strict';

    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;

    const state = { data: null, lang: root.lang === 'ar' ? 'ar' : 'en' };
    let scene = null;

    // Arabic text containing Latin terms (C#, C++, .NET, Full Stack ...) is wrapped in LTR isolates,
    // otherwise the bidi algorithm scrambles punctuation ("#C", "NET.") and word order.
    const LATIN_WORD = String.raw`\.?[0-9]*[A-Za-z][A-Za-z0-9]*(?:[-.\/][A-Za-z0-9]+)*[#+]*`;
    const LATIN_RUN = new RegExp(`${LATIN_WORD}(?: (?:& )?${LATIN_WORD})*`, 'g');
    const fx = (s) => (state.lang === 'ar' && typeof s === 'string' ? s.replace(LATIN_RUN, (m) => '⁦' + m + '⁩') : s);
    const mapStrings = (v) => typeof v === 'string' ? fx(v) : Array.isArray(v) ? v.map(mapStrings)
        : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x)])) : v;

    const L = (v) => (v && typeof v === 'object' ? fx(v[state.lang]) : fx(v));
    const uiCache = {};
    const ui = () => uiCache[state.lang] || (uiCache[state.lang] = mapStrings(state.data.ui[state.lang]));
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pad = (n) => String(n).padStart(2, '0');
    const icon = (name) => `<svg class="i" aria-hidden="true"><use href="Assets/icons.svg#${name}"></use></svg>`;
    const isExternal = (href) => /^https?:/.test(href);

    const heading = (t) => `${esc(t.pre)}${t.hl ? ` <span class="hl">${esc(t.hl)}</span>` : ''}`;

    // Top to bottom, the way the camera walks down them.
    const FLOORS = ['home', 'portfolio', 'services', 'stack', 'features', 'process', 'contact'];

    /* ---------- Renderers ---------- */
    function renderChrome() {
        const u = ui(), site = state.data.site;
        $('#skipLink').textContent = u.skip;
        $('#menuBtn').setAttribute('aria-label', isMenuOpen() ? u.close : u.menu);
        $('#navCta').textContent = u.hero.primary;
        const links = ['portfolio', 'services', 'stack', 'features', 'process'];
        $('#navLinks').innerHTML = links.map((k) => `<a href="#${k}" data-spy="${k}">${esc(u.nav[k])}</a>`).join('');
        $('#mobileLinks').innerHTML = [...links, 'contact'].map((k) =>
            `<a href="#${k}"><small>${pad(FLOORS.indexOf(k))}</small>${esc(u.nav[k])}</a>`).join('');
        $('#floors').innerHTML = FLOORS.map((k, i) => {
            const label = k === 'home' ? u.home : u.nav[k];
            return `<a href="#${k}" data-spy="${k}" aria-label="${esc(label)}"><span>${pad(i)} ${esc(label)}</span><i></i></a>`;
        }).join('');
        $('#footerText').textContent = `© ${new Date().getFullYear()} ${site.name}. ${state.data.ui[state.lang].footer}`;
        const m = messengers();
        const channels = [
            ...(m.whatsapp ? [{ name: 'WhatsApp', href: m.whatsapp, icon: 'ph-whatsapp-logo' }] : []),
            ...(m.telegram ? [{ name: 'Telegram', href: m.telegram, icon: 'ph-telegram-logo' }] : []),
            ...site.social
        ];
        $('#footerSocial').innerHTML = channels.map((s) =>
            `<a href="${esc(s.href)}" target="_blank" rel="noopener">${icon(s.icon)}${esc(s.name)}</a>`).join('');
        $('#mobileChannels').innerHTML = channels.filter((s) => s.name !== 'GitHub').map((s) =>
            `<a href="${esc(s.href)}" target="_blank" rel="noopener">${icon(s.icon)}${esc(s.name)}</a>`).join('');
        document.title = state.data.ui[state.lang].meta.title;
        $$('[data-floor]').forEach((el) => { el.textContent = pad(FLOORS.indexOf(el.closest('section').id)); });
        syncMotionBtn();
        syncThemeUi();
    }

    function renderHero() {
        const u = ui(), h = u.hero, site = state.data.site, d = state.data;
        $('#heroBadge').textContent = h.badge;
        $('#heroSub').innerHTML = `${esc(h.title.pre)} <em>${esc(h.title.hl)}</em>`;
        $('#heroDesc').textContent = h.description;
        // Filled from the raw text: the Arabic direction fix would wrap the placeholders' Latin names.
        $('#heroFact').textContent = fx(d.ui[state.lang].hero.fact
            .replace('{years}', site.yearsExperience)
            .replace('{projects}', d.projects.length)
            .replace('{tech}', d.technologies.length));
        $('#heroPrimary').href = '#contact';
        $('#heroPrimary').innerHTML = `${esc(h.primary)}${icon('ph-chats-circle')}`;
        $('#heroSecondary').innerHTML = `${esc(h.secondary)}${icon('ph-arrow-down')}`;
    }

    function renderSections() {
        const s = ui().sections;
        ['features', 'services', 'stack', 'portfolio', 'process'].forEach((k) => {
            $(`#${k}Title`).innerHTML = heading(s[k]);
            $(`#${k}Lede`).textContent = s[k].lede;
        });
    }

    const TILT = [-3, 2, -1.5, 3, -2, 1.5];
    function renderProjects() {
        const u = ui();
        $('#projects').innerHTML = state.data.projects.map((p, i) => {
            const title = esc(L(p.title));
            const thumb = esc(p.image.replace('Assets/', 'Assets/thumbs/'));
            const ext = p.link && isExternal(p.link);
            const attrs = p.link ? `href="${esc(p.link)}"${ext ? ' target="_blank" rel="noopener"' : ''}` : '';
            const small = thumb.replace('.webp', '-480.webp');
            const media = `<img src="${thumb}" srcset="${small} 480w, ${thumb} 960w" sizes="(max-width: 999px) 92vw, 44vw" alt="${title}" width="${p.size[0]}" height="${p.size[1]}" loading="lazy" decoding="async">`;
            const cats = p.categories.map((c) => u.filters[c]);
            return `
            <article class="row${p.featured ? ' featured' : ''}" data-stop data-hl="work:${i}">
                <div class="window" aria-hidden="true"></div>
                ${p.link ? `<a class="thumb" ${attrs} tabindex="-1" aria-hidden="true">${media}</a>` : `<div class="thumb">${media}</div>`}
                <div class="row-body">
                    <p class="row-meta">${cats.map((c) => `<span>${esc(c)}</span>`).join('')}${p.featured ? `<span>${esc(u.project.featured)}</span>` : ''}</p>
                    <h3>${p.link ? `<a ${attrs}>${title}</a>` : title}</h3>
                    <p class="row-sub">${esc(L(p.subtitle))}</p>
                    ${p.stickers ? `<div class="stickers">${p.stickers.map((t, k) => `<span class="sticker" style="--k:${k};--r:${TILT[(i * 2 + k) % TILT.length]}deg">${esc(L(t))}</span>`).join('')}</div>` : ''}
                    <p class="row-desc">${esc(L(p.description))}</p>
                    ${p.points ? `<ul class="row-points">${p.points.map((t) => `<li>${esc(L(t))}</li>`).join('')}</ul>` : ''}
                    <div class="tags">${p.tags.map((t) => `<span class="tag">${esc(L(t))}</span>`).join('')}</div>
                    ${p.link ? `<a class="go" ${attrs}>${esc(ext ? u.project.visit : u.project.open)}${icon('ph-arrow-up-right')}</a>` : ''}
                </div>
            </article>`;
        }).join('');
    }

    function renderLists() {
        const d = state.data;
        $('#servicesList').innerHTML = d.services.map((s, i) => `
            <li class="svc" data-hl="service:${i}">${icon(s.icon)}<h3>${esc(L(s.title))}</h3><p>${esc(L(s.text))}</p></li>`).join('');
        $('#stackList').innerHTML = d.technologies.map((t, i) => `<li data-hl="tech:${i}">${esc(L(t))}</li>`).join('');
        $('#featuresGrid').innerHTML = d.features.map((f, i) => `
            <li data-hl="feature:${i}"><div class="why-top">${icon(f.icon)}<h3>${esc(L(f.title))}</h3></div><p>${esc(L(f.text))}</p></li>`).join('');
        $('#steps').innerHTML = d.process.map((s, i) => `
            <li data-hl="process:${i}"><b>${pad(i + 1)}</b><div><h3>${esc(L(s.title))}</h3><p>${esc(L(s.text))}</p></div></li>`).join('');
    }

    // Only what data.json actually has: an empty field means no button anywhere on the page.
    function messengers() {
        const site = state.data.site, out = {};
        const digits = String(site.whatsapp || '').replace(/\D/g, '');
        const user = String(site.telegram || '').trim().replace(/^@/, '');
        if (digits) out.whatsapp = `https://wa.me/${digits}`;
        if (user) out.telegram = `https://t.me/${encodeURIComponent(user)}`;
        return out;
    }

    function renderContact() {
        const u = ui(), c = u.contact, site = state.data.site;
        $('#contactTitle').innerHTML = heading(u.sections.contact);
        $('#contactText').textContent = c.text;
        $('#contactPrimary').innerHTML = `${esc(c.primary)}${icon('ph-envelope-simple')}`;
        $('#contactPrimary').href = `mailto:${site.email}`;
        $('#copyMail').innerHTML = `${esc(c.copy)}${icon('ph-copy')}`;
        $('#mailBig').textContent = site.email;
        $('#mailBig').href = `mailto:${site.email}`;
        const links = messengers();
        for (const m of [['whatsapp', 'ph-whatsapp-logo', 'WhatsApp'], ['telegram', 'ph-telegram-logo', 'Telegram']]) {
            const a = $(`#contact${m[2]}`), href = links[m[0]];
            a.hidden = !href;
            if (href) { a.href = href; a.innerHTML = `${m[2]}${icon(m[1])}`; }
        }
    }

    function renderAll() {
        renderChrome(); renderHero(); renderSections(); renderProjects(); renderLists(); renderContact();
    }

    /* ---------- Menu ---------- */
    const isMenuOpen = () => $('#mobile-menu').classList.contains('open');
    function setMenu(open) {
        const menu = $('#mobile-menu'), btn = $('#menuBtn');
        menu.classList.toggle('open', open);
        menu.setAttribute('aria-hidden', String(!open));
        menu.inert = !open;
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? ui().close : ui().menu);
        $('use', btn).setAttribute('href', `Assets/icons.svg#${open ? 'ph-x' : 'ph-list'}`);
        root.style.overflow = open ? 'hidden' : '';
    }

    /* ---------- Nav state ---------- */
    function setupNav() {
        $('#menuBtn').addEventListener('click', () => setMenu(!isMenuOpen()));
        $('#mobile-menu').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
        addEventListener('keydown', (e) => { if (e.key === 'Escape' && isMenuOpen()) { setMenu(false); $('#menuBtn').focus(); } });
        addEventListener('resize', () => { if (innerWidth >= 1000 && isMenuOpen()) setMenu(false); }, { passive: true });

        const nav = $('#nav');
        const onScroll = () => nav.classList.toggle('scrolled', scrollY > 24);
        addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        const spy = new IntersectionObserver((es) => es.forEach((e) => {
            if (!e.isIntersecting) return;
            $$('[data-spy]').forEach((l) => {
                const on = l.dataset.spy === e.target.id;
                l.classList.toggle('active', on);
                if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
            });
        }), { rootMargin: '-45% 0px -50% 0px' });
        $$('section[id]').forEach((s) => spy.observe(s));
    }

    /* ---------- Copy email ---------- */
    let toastTimer;
    function toast(msg) {
        const t = $('#toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
    }
    function setupCopy() {
        $('#copyMail').addEventListener('click', async () => {
            const mail = state.data.site.email, c = state.data.ui[state.lang].contact;
            try {
                await navigator.clipboard.writeText(mail);
                toast(c.copied);
            } catch (e) {
                const ta = Object.assign(document.createElement('textarea'), { value: mail });
                document.body.appendChild(ta); ta.select();
                let ok = false; try { ok = document.execCommand('copy'); } catch (err) { /* ignore */ }
                ta.remove();
                toast(ok ? c.copied : c.copyFailed + mail);
            }
        });
    }

    /* ---------- Language ---------- */
    function setLanguage(lang) {
        state.lang = lang;
        try { localStorage.setItem('lang', lang); } catch (e) { /* storage blocked */ }
        root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
        $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
        renderAll();
        markReveals();
        if (scene) scene.relayout();
    }

    /* ---------- Words slide in from their own side, once ---------- */
    let revealIO = null;
    const REVEAL = '.sec:not(.hero) .floor, .sec:not(.hero) h2, .sec:not(.hero) .lede, .row-meta, .row h3, .row-sub, .stickers, .row-desc, .row-points, .tags, .go, .thumb, .svc, .chips li, .why li, .steps li, .mail-big, .contact .cta';
    function markReveals() {
        if (reduced || !('IntersectionObserver' in window)) return;
        root.classList.add('anim');
        if (!revealIO) revealIO = new IntersectionObserver((es) => es.forEach((e) => {
            if (!e.isIntersecting) return;
            revealIO.unobserve(e.target);
            e.target.classList.add('in');
            // Handing the element back keeps its own hover transitions working.
            setTimeout(() => { e.target.removeAttribute('data-r'); e.target.classList.remove('in'); }, 1500);
        }), { rootMargin: '0px 0px -7% 0px' });
        const wide = !isStacked();
        $$(REVEAL).forEach((el) => {
            const parent = el.parentElement, i = Math.min(Array.prototype.indexOf.call(parent.children, el), 11);
            const r = el.getBoundingClientRect();
            el.style.setProperty('--i', i);
            el.style.setProperty('--from', wide ? (r.left + r.width / 2 < innerWidth / 2 ? -46 : 46) : 0);
            el.setAttribute('data-r', '');
            revealIO.observe(el);
        });
    }

    /* ---------- Themes: the new one spreads from the click across the whole page ---------- */
    const THEMES = ['prism', 'ember', 'aurora', 'arctic', 'paper'];
    const THEME_MS = 1500;
    function syncThemeUi() {
        const u = ui().theme, current = root.dataset.theme;
        $('#themeBtn').setAttribute('aria-label', u.label);
        $('#themeMenu').setAttribute('aria-label', u.label);
        $('#themeMenu').innerHTML = THEMES.map((id) => `<button type="button" class="swatch" data-theme="${id}" data-set="${id}" aria-pressed="${id === current}" aria-label="${esc(u[id])}" title="${esc(u[id])}"><span class="hexa"></span></button>`).join('');
    }
    function paintTheme(id, x, y, animate) {
        root.dataset.theme = id;
        try { localStorage.setItem('theme', id); } catch (e) { /* storage blocked */ }
        const meta = $('meta[name="theme-color"]');
        if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim();
        $$('#themeMenu .swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === id)));
        if (scene) scene.setTheme(x, y, animate);
    }
    // A jagged edge rather than a circle: the same low-poly shape as everything else on the page.
    function edge(cx, cy, r, jag) {
        return jag.map((j, i) => {
            const a = i / jag.length * Math.PI * 2;
            return `${(cx + Math.cos(a) * r * j).toFixed(1)}px ${(cy + Math.sin(a) * r * j).toFixed(1)}px`;
        });
    }
    function setTheme(id, x, y) {
        if (id === root.dataset.theme) return;
        if (reduced || !document.startViewTransition) { paintTheme(id, x, y, false); return; }
        const rim = $('#themeRim');
        const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        const jag = Array.from({ length: 26 }, () => .74 + Math.random() * .46);
        const end = far / .74 * 1.05, band = Math.max(10, Math.min(innerWidth, innerHeight) * .018);
        const vt = document.startViewTransition(() => { rim.style.display = 'block'; paintTheme(id, x, y, true); });
        vt.ready.then(() => {
            const shape = (r) => `polygon(${edge(x, y, r, jag).join(', ')})`;
            const ring = (r) => {
                const inner = edge(x, y, r, jag), outer = edge(x, y, r + band, jag);
                return `polygon(evenodd, ${outer.join(', ')}, ${outer[0]}, ${inner.join(', ')}, ${inner[0]}, ${outer[0]})`;
            };
            const timing = { duration: THEME_MS, easing: 'cubic-bezier(.42, .16, .46, 1)', fill: 'both' };
            root.animate({ clipPath: [shape(0), shape(end)] }, { ...timing, pseudoElement: '::view-transition-new(root)' });
            root.animate({ clipPath: [ring(0), ring(end)], opacity: [1, 1, .9, 0], offset: [0, .1, .85, 1] }, { ...timing, pseudoElement: '::view-transition-new(theme-rim)' });
        }).catch(() => { /* a newer click took over */ });
        vt.finished.finally(() => { rim.style.display = ''; });
    }
    function setupThemes() {
        const btn = $('#themeBtn'), menu = $('#themeMenu');
        const open = (v) => { menu.hidden = !v; btn.setAttribute('aria-expanded', String(v)); };
        btn.addEventListener('click', () => open(menu.hidden));
        menu.addEventListener('click', (e) => {
            const b = e.target.closest('.swatch');
            if (!b) return;
            const r = b.getBoundingClientRect();
            setTheme(b.dataset.set, r.left + r.width / 2, r.top + r.height / 2);
        });
        document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#themeBox')) open(false); });
        addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); } });
    }

    /* ---------- Pause the motion ---------- */
    let motionPaused = false;
    function syncMotionBtn() {
        const b = $('#motionBtn');
        b.setAttribute('aria-pressed', String(motionPaused));
        b.setAttribute('aria-label', motionPaused ? ui().play : ui().pause);
        $('use', b).setAttribute('href', `Assets/icons.svg#${motionPaused ? 'ph-play' : 'ph-pause'}`);
    }
    function setupMotionBtn() {
        try { motionPaused = localStorage.getItem('motion') === 'off'; } catch (e) { /* storage blocked */ }
        syncMotionBtn();
        root.classList.toggle('motion-off', motionPaused);
        $('#motionBtn').addEventListener('click', () => {
            motionPaused = !motionPaused;
            try { localStorage.setItem('motion', motionPaused ? 'off' : 'on'); } catch (e) { /* storage blocked */ }
            syncMotionBtn();
            root.classList.toggle('motion-off', motionPaused);
            if (scene) scene.setPaused(motionPaused);
        });
    }

    /* ---------- 3D ---------- */
    // Phones and portrait tablets stack everything in one column; landscape phones keep the side-by-side layout.
    // The same query is in site.css.
    const isStacked = () => matchMedia('(max-width: 639px), (max-width: 999px) and (min-height: 501px), (max-width: 999px) and (orientation: portrait)').matches;
    // The walk stops at each row of work and at each section; stacked, at each open space for the scene.
    function stopElements() {
        const small = isStacked();
        const at = (id) => { const s = $('#' + id); return small ? $('.window', s) : s; };
        const rows = $$('#projects .row');
        return [at('home'), ...(small ? rows.map((r) => $('.window', r)) : rows), at('services'), at('stack'), at('features'), at('process'), at('contact')];
    }
    // Where the shape stands at each stop: beside that stop's words, or in that stop's own open space.
    function textOfStops() {
        return [$('#home .col'), ...$$('#projects .row-body'), $('#services .col'), $('#stack .col'), $('#features .col'), $('#process .col'), $('#contact .col')];
    }
    function focus() {
        const w = innerWidth;
        if (isStacked()) {
            return { split: false, spots: stopElements().map((el) => { const r = el.getBoundingClientRect(); return { cy: r.top + scrollY + r.height / 2, h: r.height }; }) };
        }
        const rtl = root.dir === 'rtl', rail = w < 1000 ? 16 : 70, margin = 20;
        const spots = textOfStops().map((el) => {
            const r = el.getBoundingClientRect();
            const freeRight = w - r.right > r.left;
            const from = freeRight ? r.right + margin : (rtl ? rail : margin);
            const to = freeRight ? w - (rtl ? margin : rail) : r.left - margin;
            return { x: (from + to) / 2, avail: to - from };
        });
        return { split: true, spots };
    }
    function glPossible() {
        if (navigator.connection && navigator.connection.saveData) return false;
        try {
            return !!document.createElement('canvas').getContext('webgl2');
        } catch (e) { return false; }
    }
    function sceneFailed() {
        // The list of work gets its thumbnails back, so no project is ever left without a picture.
        root.classList.remove('gl-capable');
        root.classList.add('no-gl');
    }
    function loadScene() {
        if (!root.classList.contains('gl-capable')) { sceneFailed(); return; }
        import('./scene.js')
            .then((m) => m.createScene({
                canvas: $('#scene'), data: state.data, reduced, stops: stopElements, focus,
                onFirstFrame: () => root.classList.add('gl-on')
            }))
            .then((s) => { scene = s; if (motionPaused) s.setPaused(true); })
            .catch((err) => { console.warn('3D scene unavailable', err); sceneFailed(); });
    }

    // Hovering or focusing a line of the page lifts the matching piece of the shape.
    function setupHighlights() {
        const set = (el) => {
            if (!scene) return;
            if (!el) { scene.highlight(null); return; }
            const [kind, i] = el.dataset.hl.split(':');
            scene.highlight(kind, +i);
        };
        document.addEventListener('pointerover', (e) => set(e.target.closest && e.target.closest('[data-hl]')), { passive: true });
        document.addEventListener('focusin', (e) => set(e.target.closest && e.target.closest('[data-hl]')));
    }

    /* ---------- Boot ---------- */
    fetch('data.json')
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((d) => {
            state.data = d;
            // Decided before the first render, so the list never reflows when the scene arrives.
            root.classList.toggle('gl-capable', glPossible());
            $$('.lang button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.lang !== state.lang) setLanguage(b.dataset.lang); }));
            setLanguage(state.lang);
            setupNav(); setupCopy(); setupHighlights(); setupMotionBtn(); setupThemes();
            root.classList.add('ready');
            // The page is readable now; the scene can take its time.
            if ('requestIdleCallback' in window) requestIdleCallback(loadScene, { timeout: 800 }); else setTimeout(loadScene, 200);
        })
        .catch((err) => {
            console.error('Could not load data.json', err);
            root.classList.add('ready', 'no-gl');
            $('#portfolioTitle').textContent = 'Could not load the portfolio data.';
            $('#portfolioLede').textContent = 'If you opened this file directly, serve the folder over HTTP (for example: python -m http.server), because browsers block fetch on file://.';
        });
})();
