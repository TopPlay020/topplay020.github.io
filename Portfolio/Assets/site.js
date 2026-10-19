/* Beghdad Amine · Portfolio
   data.json drives every piece of content. Each item carries both languages ({ en, ar }),
   so the two languages cannot drift apart. Validate with: node scripts/check-data.mjs */
(() => {
    'use strict';

    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const root = document.documentElement;

    const state = { data: null, lang: pickLang(), filter: 'all', typing: 0, counted: false, started: false };

    function pickLang() {
        const q = new URLSearchParams(location.search).get('lang');
        if (q === 'ar' || q === 'en') return q;
        try { const s = localStorage.getItem('lang'); if (s === 'ar' || s === 'en') return s; } catch (e) { /* storage blocked */ }
        return (navigator.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
    }

    // Arabic text containing Latin terms (C#, C++, .NET, Full Stack ...) is wrapped in LTR isolates,
    // otherwise the bidi algorithm scrambles punctuation ("#C", "NET.") and word order.
    const LATIN_WORD = String.raw`\.?[A-Za-z][A-Za-z0-9]*(?:[-.\/][A-Za-z0-9]+)*[#+]*`;
    const LATIN_RUN = new RegExp(`${LATIN_WORD}(?: ${LATIN_WORD})*`, 'g');
    const fx = (s) => (state.lang === 'ar' && typeof s === 'string' ? s.replace(LATIN_RUN, (m) => '⁦' + m + '⁩') : s);
    const mapStrings = (v) => typeof v === 'string' ? fx(v) : Array.isArray(v) ? v.map(mapStrings)
        : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x)])) : v;

    const L = (v) => (v && typeof v === 'object' ? fx(v[state.lang]) : fx(v));
    const uiCache = {};
    const ui = () => uiCache[state.lang] || (uiCache[state.lang] = mapStrings(state.data.ui[state.lang]));
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pad = (n) => String(n).padStart(2, '0');
    const icon = (name) => `<i class="ph ${name}"></i>`;

    /* ---------- Headline word-mask splitting ---------- */
    function splitWords(text, hl = false, start = 0) {
        return text.trim().split(/\s+/).map((w, i) =>
            `<span class="w"><i${hl ? ' class="hl"' : ''} style="--i:${start + i}">${esc(w)}</i></span>`).join(' ');
    }
    function setTitle(el, t) {
        const pre = splitWords(t.pre);
        const hl = t.hl ? splitWords(t.hl, true, t.pre.trim().split(/\s+/).length) : '';
        el.innerHTML = pre + (hl ? ' ' + hl : '');
        el.setAttribute('aria-label', `${t.pre} ${t.hl || ''}`.trim());
    }

    /* ---------- Preloader ---------- */
    const NAME = 'BEGHDAD AMINE';
    $('#plName').innerHTML = NAME.split('').map((c, i) => `<span style="animation-delay:${i * 45}ms">${c === ' ' ? '&nbsp;' : c}</span>`).join('');

    function runPreloader(ready) {
        const pct = $('#plPct'), bar = $('.pl-bar'), t0 = performance.now(), MIN = reduced ? 0 : 1000;
        let done = false, isReady = false;
        // rAF pauses in background tabs, so a timer guarantees the curtain always lifts
        ready.then(() => { isReady = true; setTimeout(() => { if (!done) { done = true; finish(); } }, MIN + 500); });
        (function frame(t) {
            const p = Math.min((t - t0) / MIN, 1);
            const shown = isReady ? p : Math.min(p, .92);
            pct.textContent = pad(Math.round(shown * 100)) + '%';
            bar.style.setProperty('--p', shown);
            if (isReady && p >= 1 && !done) { done = true; finish(); return; }
            requestAnimationFrame(frame);
        })(t0);
    }
    function finish() {
        $('#preloader').classList.add('done');
        setTimeout(startReveals, reduced ? 0 : 350);
    }

    /* ---------- Boot ---------- */
    const dataReady = fetch('data.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1600))]);
    const ready = Promise.all([dataReady, fontsReady]).then(([d]) => { state.data = d; init(); });
    runPreloader(ready.catch(() => { }));
    ready.catch((err) => {
        console.error('Could not load data.json', err);
        $('#preloader').classList.add('done');
        $('#main').innerHTML = '<div class="wrap" style="padding:180px var(--gutter) 120px"><h2 class="sec-title">Could not load the portfolio data.</h2><p class="sec-lede" style="justify-self:start;margin-top:16px">If you opened this file directly, serve the folder over HTTP (for example <code>npx serve</code>), because browsers block <code>fetch</code> on <code>file://</code>.</p></div>';
    });

    /* ---------- Renderers ---------- */
    function renderChrome() {
        const u = ui(), site = state.data.site;
        $('#skipLink').textContent = u.skip;
        $('#brandName').textContent = site.name[state.lang];
        $('#menuBtn').setAttribute('aria-label', u.menu);
        $('#toTop').setAttribute('aria-label', u.toTop);
        $('#navCtaText').textContent = u.hero.primary;
        $('#navCta').href = '#contact';

        const links = [['features', '#features'], ['services', '#services'], ['portfolio', '#portfolio'], ['process', '#process'], ['contact', '#contact']];
        $('#navLinks').innerHTML = links.filter(([k]) => k !== 'contact').map(([k, h]) =>
            `<a class="nav-link" href="${h}" data-spy="${h}">${esc(u.nav[k])}</a>`).join('');
        $('#mobileLinks').innerHTML = links.map(([k, h], i) =>
            `<a class="m-link" href="${h}"><small class="mono">${pad(i + 1)}</small>${esc(u.nav[k])}</a>`).join('');

        const dock = [['home', '#home', 'ph-house', u.home], ['features', '#features', 'ph-lightning', u.nav.features],
            ['services', '#services', 'ph-stack', u.nav.services], ['portfolio', '#portfolio', 'ph-briefcase', u.nav.portfolio],
            ['contact', '#contact', 'ph-paper-plane-tilt', u.nav.contact]];
        $('#dock-items').innerHTML = dock.map(([k, h, ic, label]) =>
            `<a class="dock-item${k === 'contact' ? ' cta' : ''}" href="${h}" data-spy="${h}">${icon(ic)}<span>${esc(label)}</span></a>`).join('');
        $$('.dock-item').forEach((a) => a.addEventListener('click', buzz));

        const social = (cls) => site.social.map((s) =>
            `<a href="${esc(s.href)}" target="_blank" rel="noopener" aria-label="${esc(s.name)}">${icon(s.icon)}</a>`).join('');
        $('#mobileSocial').innerHTML = social();
        $('#footerSocial').innerHTML = social();
        const mail = $('#mobileMail');
        mail.textContent = site.email; mail.href = 'mailto:' + site.email;
        $('#footerText').innerHTML = `&copy; ${new Date().getFullYear()} ${esc(site.name[state.lang])}. ${esc(u.footer)}`;
        document.title = state.lang === 'ar' ? 'بغداد أمين · مطوّر Full Stack .NET' : 'Beghdad Amine · Full Stack .NET Developer';
    }

    function renderHero() {
        const u = ui(), h = u.hero, site = state.data.site, d = state.data;
        $('#heroBadge').textContent = h.badge;
        const t = $('#heroTitle'); t.style.setProperty('--base', '200ms'); setTitle(t, h.title);
        $('#rolesPrefix').textContent = h.rolesPrefix;
        $('#heroDesc').textContent = h.description;
        $('#heroPrimary').href = site.contactLink;
        $('#heroPrimaryText').textContent = h.primary;
        $('#heroSecondaryText').textContent = h.secondary;
        $('#sealText').textContent = state.data.ui.en.hero.seal;
        const stats = [
            { v: site.yearsExperience, suffix: '+', label: h.stats.years },
            { v: d.projects.length, suffix: '', label: h.stats.projects },
            { v: d.technologies.length, suffix: '', label: h.stats.tech }
        ];
        $('#stats').innerHTML = stats.map((s) => `
            <div class="stat"><b><span data-count="${s.v}">${state.counted ? s.v : 0}</span>${s.suffix ? `<em>${s.suffix}</em>` : ''}</b><span>${esc(s.label)}</span></div>`).join('');
    }

    function renderSections() {
        const s = ui().sections;
        [['features', 'featuresTitle'], ['services', 'servicesTitle'], ['stack', 'stackTitle'], ['portfolio', 'portfolioTitle'], ['process', 'processTitle']]
            .forEach(([k, id]) => setTitle($('#' + id), s[k]));
        [['features', 'featuresLede'], ['services', 'servicesLede'], ['stack', 'stackLede'], ['portfolio', 'portfolioLede'], ['process', 'processLede']]
            .forEach(([k, id]) => { $('#' + id).textContent = s[k].lede || ''; });
    }

    function renderFeatures() {
        $('#featuresGrid').innerHTML = state.data.features.map((f, i) => `
            <article class="tile" data-reveal style="--d:${(i % 2) * .08}s">
                <span class="num">${pad(i + 1)}</span>
                ${icon(f.icon).replace('class="ph', 'class="mark ph')}
                <div class="ico">${icon(f.icon)}</div>
                <h3>${esc(L(f.title))}</h3>
                <p>${esc(L(f.text))}</p>
            </article>`).join('');
    }

    function renderServices() {
        $('#servicesList').innerHTML = state.data.services.map((s, i) => `
            <a class="svc" href="#contact" data-reveal style="--d:${Math.min(i, 4) * .04}s">
                <span class="svc-num">${pad(i + 1)}</span>
                <span class="svc-ico">${icon(s.icon)}</span>
                <h3 class="svc-title">${esc(L(s.title))}</h3>
                <p class="svc-text">${esc(L(s.text))}</p>
                <span class="svc-go">${icon('ph-arrow-up-right')}</span>
            </a>`).join('');
    }

    function renderMarquee() {
        const tech = state.data.technologies.map(L);
        const half = Math.ceil(tech.length / 2);
        const row = (arr) => { const html = arr.map((t) => `<span class="mq-item">${esc(t)}</span>`).join(''); return html + html; };
        $('#mq1').innerHTML = row(tech.slice(0, half));
        $('#mq2').innerHTML = row(tech.slice(half));
        $('#stackList').innerHTML = tech.map((t) => `<li>${esc(t)}</li>`).join('');
    }

    function renderProjects() {
        const d = state.data, u = ui();
        // filters (counts come straight from the data, so they are always right)
        const cats = ['all', ...Object.keys(u.filters).filter((k) => k !== 'all' && d.projects.some((p) => p.categories.includes(k)))];
        if (!cats.includes(state.filter)) state.filter = 'all';
        const countOf = (c) => c === 'all' ? d.projects.length : d.projects.filter((p) => p.categories.includes(c)).length;
        $('#filters').innerHTML = '<span class="filter-pill" id="filterPill"></span>' + cats.map((c) =>
            `<button type="button" class="filter" data-filter="${c}" aria-pressed="${c === state.filter}">${esc(u.filters[c])}<sup>${countOf(c)}</sup></button>`).join('');
        $$('.filter').forEach((b) => b.addEventListener('click', () => { if (state.filter !== b.dataset.filter) { buzz(); state.filter = b.dataset.filter; applyFilter(true); } }));

        $('#projects').innerHTML = d.projects.map((p, i) => {
            const title = esc(L(p.title)), link = p.link ? esc(p.link) : '';
            return `
            <article class="pcard${p.featured ? ' featured' : ''}" data-reveal data-cats="${p.categories.join(' ')}"${link ? ` data-link="${link}"` : ''} style="--d:${(i % 3) * .08}s">
                <div class="p-media">
                    <img src="${esc(p.image)}" alt="${title}" loading="lazy" decoding="async">
                    ${p.featured ? `<span class="p-badge">${esc(u.project.featured)}</span>` : ''}
                </div>
                <div class="p-info">
                    <div class="tags">${p.tags.map((t) => `<span class="tag">${esc(L(t))}</span>`).join('')}</div>
                    <h3>${link ? `<a class="p-link" href="${link}">${title}</a>` : title}</h3>
                    <p class="p-sub">${esc(L(p.subtitle))}</p>
                    <p class="p-desc">${esc(L(p.description))}</p>
                    ${link ? `<span class="p-go">${esc(u.project.open)}<i>${icon('ph-arrow-up-right')}</i></span>` : ''}
                </div>
            </article>`;
        }).join('');
        applyFilter(false);
    }

    const visibleCards = () => $$('.pcard').filter((c) => !c.classList.contains('hidden'));

    function applyFilter(animate) {
        const f = state.filter;
        let n = 0;
        $$('.pcard').forEach((c) => {
            const show = f === 'all' || c.dataset.cats.split(' ').includes(f);
            const wasHidden = c.classList.contains('hidden');
            c.classList.toggle('hidden', !show);
            c.classList.remove('enter');
            if (show) {
                if (animate && !reduced) { c.style.setProperty('--i', n); void c.offsetWidth; c.classList.add('enter'); }
                if (animate) c.classList.add('in');
                n++;
            }
        });
        $$('.filter').forEach((b) => b.setAttribute('aria-pressed', b.dataset.filter === f));
        $('#workCount').textContent = `${pad(n)} / ${pad(state.data.projects.length)} ${ui().project.count}`;
        const grid = $('#projects');
        if (animate) grid.scrollTo({ left: 0 });
        $('#projectDots').innerHTML = visibleCards().map((_, i) => `<span class="dot-i${i === 0 ? ' active' : ''}" data-i="${i}"></span>`).join('');
        $$('.dot-i').forEach((dot) => dot.addEventListener('click', () => visibleCards()[+dot.dataset.i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })));
        movePill($('.filters'), $('#filterPill'), '.filter[aria-pressed="true"]');
        setupTouch();
    }

    function movePill(box, pill, sel) {
        const b = $(sel, box);
        if (!b || !pill) return;
        pill.style.width = b.offsetWidth + 'px';
        pill.style.transform = `translateX(${b.offsetLeft}px)`;
    }

    function renderProcess() {
        $('#steps').innerHTML = state.data.process.map((s, i) => `
            <article class="step" data-reveal style="--d:${i * .18}s">
                <span class="node"></span>
                <div class="step-n">${pad(i + 1)}</div>
                <div class="ico">${icon(s.icon)}</div>
                <h3>${esc(L(s.title))}</h3>
                <p>${esc(L(s.text))}</p>
            </article>`).join('');
    }

    function renderContact() {
        const u = ui(), c = u.contact, site = state.data.site;
        setTitle($('#contactTitle'), u.sections.contact);
        $('#contactText').textContent = c.text;
        $('#contactPrimary').href = site.contactLink;
        $('#contactPrimaryText').textContent = c.primary;
        $('#copyMailText').textContent = c.copy;
        $('#mailText').textContent = site.email;
        $('#socialRows').innerHTML = site.social.map((s) =>
            `<a class="social-row" href="${esc(s.href)}" target="_blank" rel="noopener"><span>${icon(s.icon)}${esc(s.name)}</span>${icon('ph-arrow-up-right')}</a>`).join('');
    }

    /* ---------- Typing roles ---------- */
    function startTyping() {
        const roles = ui().hero.roles, el = $('#typed'), token = ++state.typing;
        if (reduced) { el.textContent = roles[0]; return; }
        let ri = 0, ci = 0, del = false;
        (function tick() {
            if (token !== state.typing) return;
            const word = roles[ri];
            ci += del ? -1 : 1;
            el.textContent = word.slice(0, ci);
            let delay = del ? 28 : 62;
            if (!del && ci === word.length) { del = true; delay = 1800; }
            else if (del && ci === 0) { del = false; ri = (ri + 1) % roles.length; delay = 380; }
            setTimeout(tick, delay);
        })();
    }

    /* ---------- Reveals, counters ---------- */
    let revealIO = null, countIO = null;
    function observeReveals() {
        if (!state.started) return;
        revealIO = revealIO || new IntersectionObserver((es) => es.forEach((e) => {
            if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
        }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
        $$('[data-reveal]:not(.in), .split:not(.in)').forEach((el) => revealIO.observe(el));

        countIO = countIO || new IntersectionObserver((es) => es.forEach((e) => {
            if (!e.isIntersecting) return;
            countIO.unobserve(e.target);
            countUp(e.target, +e.target.dataset.count);
        }), { threshold: .6 });
        if (!state.counted) $$('[data-count]').forEach((el) => countIO.observe(el));
    }
    function startReveals() {
        state.started = true;
        observeReveals();
        // anything already on screen reveals right away (also covers background tabs where observers are paused)
        setTimeout(() => $$('[data-reveal]:not(.in), .split:not(.in)').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.top < innerHeight * .94 && r.bottom > 0) el.classList.add('in');
        }), 30);
    }

    function countUp(el, target) {
        if (reduced) { el.textContent = target; state.counted = true; return; }
        const t0 = performance.now(), dur = 1500;
        (function step(t) {
            const p = Math.min((t - t0) / dur, 1);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
            if (p < 1) requestAnimationFrame(step); else state.counted = true;
        })(t0);
    }

    /* ---------- Pointer effects (desktop) ---------- */
    function setupPointer() {
        if (!finePointer) return;
        // spotlight on tiles + project cards
        document.addEventListener('pointermove', (e) => {
            const el = e.target.closest && e.target.closest('.tile, .pcard');
            if (!el) return;
            const r = el.getBoundingClientRect();
            el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            el.style.setProperty('--my', (e.clientY - r.top) + 'px');
        }, { passive: true });

        if (reduced) return;
        // custom cursor
        const dot = $('#cursor-dot'), ring = $('#cursor-ring');
        let mx = -100, my = -100, rx = -100, ry = -100, live = false;
        document.addEventListener('pointermove', (e) => {
            mx = e.clientX; my = e.clientY;
            if (!live) { live = true; rx = mx; ry = my; root.classList.add('has-cursor'); loop(); }
        }, { passive: true });
        document.addEventListener('pointerover', (e) => ring.classList.toggle('hover', !!(e.target.closest && e.target.closest('a, button, .pcard'))));
        document.addEventListener('mouseleave', () => root.classList.remove('has-cursor'));
        document.addEventListener('mouseenter', () => live && root.classList.add('has-cursor'));
        function loop() {
            rx += (mx - rx) * .18; ry += (my - ry) * .18;
            dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
            ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
            requestAnimationFrame(loop);
        }

        // hero: spotlight follows the pointer, portrait drifts a little
        const hero = $('.hero'), portrait = $('#portrait');
        let raf = 0, px = 0, py = 0;
        hero.addEventListener('pointermove', (e) => {
            const r = hero.getBoundingClientRect();
            px = (e.clientX - r.left) / r.width; py = (e.clientY - r.top) / r.height;
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                hero.style.setProperty('--sx', (px * 100) + '%');
                hero.style.setProperty('--sy', (py * 100) + '%');
                portrait.style.transform = `translate(${(px - .5) * 18}px, ${(py - .5) * 12}px)`;
            });
        }, { passive: true });
        hero.addEventListener('pointerleave', () => { portrait.style.transform = ''; });

        // magnetic buttons
        const mags = $$('[data-magnetic]');
        document.addEventListener('pointermove', (e) => {
            mags.forEach((el) => {
                const r = el.getBoundingClientRect();
                const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
                const dist = Math.hypot(dx, dy), reach = 110;
                el.style.translate = dist < reach ? `${dx * (1 - dist / reach) * .25}px ${dy * (1 - dist / reach) * .25}px` : '';
            });
        }, { passive: true });
    }

    /* ---------- Touch: "hover" follows the viewport centre ---------- */
    let touchA = null, touchB = null;
    function setupTouch() {
        if (finePointer) return;
        touchA && touchA.disconnect(); touchB && touchB.disconnect();
        touchA = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('touch', e.isIntersecting)), { rootMargin: '-42% 0px -42% 0px' });
        $$('.tile, .svc').forEach((el) => touchA.observe(el));
        touchB = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('touch', e.isIntersecting && e.intersectionRatio > .7)), { threshold: [.5, .75] });
        $$('.pcard').forEach((el) => touchB.observe(el));
    }

    function setupGyro() {
        if (finePointer || reduced) return;
        const portrait = $('#portrait');
        let busy = false;
        addEventListener('deviceorientation', (e) => {
            if (e.beta == null || e.gamma == null || busy) return;
            busy = true;
            requestAnimationFrame(() => {
                const gx = Math.max(-1, Math.min(1, e.gamma / 30)), gy = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
                portrait.style.transform = `translate(${gx * 10}px, ${gy * 8}px)`;
                busy = false;
            });
        }, { passive: true });
    }

    /* ---------- Project carousel dots (mobile) ---------- */
    function setupCarousel() {
        const grid = $('#projects');
        let t;
        grid.addEventListener('scroll', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                const cards = visibleCards(), gr = grid.getBoundingClientRect(), mid = gr.left + gr.width / 2;
                let best = 0, bd = Infinity;
                cards.forEach((c, i) => { const r = c.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = i; } });
                $$('.dot-i').forEach((d, i) => d.classList.toggle('active', i === best));
            }, 60);
        }, { passive: true });
    }

    /* ---------- Nav, menu, scroll UI ---------- */
    function buzz() { if (!finePointer && navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* needs a user gesture */ } } }

    function setMenu(open) {
        const menu = $('#mobile-menu');
        menu.classList.toggle('open', open);
        menu.setAttribute('aria-hidden', String(!open));
        $('#menuBtn').setAttribute('aria-expanded', String(open));
        $('#menuBtn').innerHTML = icon(open ? 'ph-x' : 'ph-list');
        root.style.overflow = open ? 'hidden' : '';
        $('#dock').classList.toggle('hide', open);
    }

    function setupNav() {
        $('#menuBtn').addEventListener('click', () => { buzz(); setMenu(!$('#mobile-menu').classList.contains('open')); });
        $('#mobile-menu').addEventListener('click', (e) => { if (e.target.closest('a')) { buzz(); setMenu(false); } });
        addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
        addEventListener('resize', () => { if (innerWidth >= 900) setMenu(false); movePill($('.lang'), $('#langPill'), '.lang button[aria-pressed="true"]'); movePill($('.filters'), $('#filterPill'), '.filter[aria-pressed="true"]'); }, { passive: true });

        const spy = new IntersectionObserver((es) => es.forEach((e) => {
            if (!e.isIntersecting) return;
            const id = '#' + e.target.id;
            $$('.nav-link, .dock-item').forEach((l) => l.classList.toggle('active', l.dataset.spy === id));
        }), { rootMargin: '-40% 0px -55% 0px' });
        $$('section[id]').forEach((s) => spy.observe(s));

        const nav = $('#nav'), toTop = $('#toTop'), bar = $('#progress');
        const nativeProgress = CSS.supports && CSS.supports('animation-timeline: scroll()');
        let ticking = false;
        const update = () => {
            ticking = false;
            const y = scrollY;
            nav.classList.toggle('scrolled', y > 24);
            toTop.classList.toggle('show', y > 700);
            if (!nativeProgress) { const max = root.scrollHeight - innerHeight; bar.style.setProperty('--p', max > 0 ? y / max : 0); }
        };
        addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
        update();
        toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
    }

    /* ---------- Contact: copy email + toast ---------- */
    let toastTimer;
    function toast(msg) {
        $('#toastText').textContent = msg;
        const t = $('#toast'); t.classList.add('show');
        clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
    }
    function setupCopy() {
        $('#copyMail').addEventListener('click', async () => {
            const mail = state.data.site.email, c = ui().contact;
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
    function setLanguage(lang, first) {
        state.lang = lang;
        try { localStorage.setItem('lang', lang); } catch (e) { /* storage blocked */ }
        root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
        $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
        renderAll();
        movePill($('.lang'), $('#langPill'), '.lang button[aria-pressed="true"]');
        if (!first) buzz();
    }

    function renderAll() {
        renderChrome(); renderHero(); renderSections(); renderFeatures(); renderServices(); renderMarquee();
        renderProjects(); renderProcess(); renderContact(); startTyping(); observeReveals(); setupTouch();
    }

    function init() {
        $$('.lang button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.lang !== state.lang) setLanguage(b.dataset.lang); }));
        setLanguage(state.lang, true);
        setupNav(); setupCopy(); setupCarousel(); setupPointer(); setupGyro();
        // pills depend on final font metrics
        if (document.fonts) document.fonts.ready.then(() => { movePill($('.lang'), $('#langPill'), '.lang button[aria-pressed="true"]'); movePill($('.filters'), $('#filterPill'), '.filter[aria-pressed="true"]'); });
    }
})();
