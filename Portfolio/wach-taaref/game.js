/* Wach Ta3ref page: language switch, reveals, counters, parallax, screenshot rail, day/night slider, playable board. */
(() => {
    'use strict';

    // The game is live on Google Play: every .play-link opens the store listing.
    const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.wachtaaref.game';

    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
    const root = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* ---------- Language ---------- */
    const lang = () => root.lang;
    function movePill() {
        const b = $('.lang button[aria-pressed="true"]'), pill = $('#langPill');
        if (!b || !pill) return;
        pill.style.width = b.offsetWidth + 'px';
        pill.style.transform = `translateX(${b.offsetLeft}px)`;
    }
    function applyLang(l) {
        root.lang = l; root.dir = l === 'ar' ? 'rtl' : 'ltr';
        try { localStorage.setItem('lang', l); } catch (e) { /* storage blocked */ }
        $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
        $$('[data-alt-ar]').forEach((img) => { img.alt = img.dataset['alt' + (l === 'ar' ? 'Ar' : 'En')]; });
        $$('#railPrev, #railNext').forEach((b, i) => { b.setAttribute('aria-label', l === 'ar' ? (i ? 'التالي' : 'السابق') : (i ? 'Next' : 'Previous')); });
        $('#rail') && $('#rail').setAttribute('aria-label', l === 'ar' ? 'لقطات من اللعبة' : 'Game screenshots');
        $('#board') && $('#board').setAttribute('aria-label', l === 'ar' ? 'لوحة الحروف' : 'Letter board');
        movePill();
        updateRail();
        showQuestion();
    }
    $$('.lang button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.lang !== lang()) applyLang(b.dataset.lang); }));

    /* ---------- Play buttons ---------- */
    $$('.play-link').forEach((a) => { a.href = PLAY_URL; a.target = '_blank'; a.rel = 'noopener'; });
    let toastTimer;
    function toast(msg) {
        const t = $('#toast'); t.textContent = msg; t.classList.add('show');
        clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
    }

    /* ---------- Nav state + sticky download (phones) ---------- */
    const nav = $('#nav'), mGet = $('#mGet');
    function onScroll() {
        nav.classList.toggle('scrolled', scrollY > 24);
        const nearEnd = innerHeight + scrollY > document.documentElement.scrollHeight - 420;
        mGet && mGet.classList.toggle('show', scrollY > innerHeight * .7 && !nearEnd);
    }
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ---------- Reveals + counters ---------- */
    function countUp(el) {
        const target = +el.dataset.count;
        if (reduced) { el.textContent = target; return; }
        const t0 = performance.now(), dur = 1500;
        (function step(t) {
            const p = Math.min((t - t0) / dur, 1);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
            if (p < 1) requestAnimationFrame(step);
        })(t0);
    }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in'); io.unobserve(e.target);
        $$('[data-count]', e.target).forEach(countUp);
    }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal]').forEach((el) => io.observe(el));
    $$('[data-count]').forEach((el) => { el.textContent = '0'; });
    // anything already on screen shows right away (observers pause in background tabs)
    setTimeout(() => $$('[data-reveal]:not(.in)').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight * .94 && r.bottom > 0) { el.classList.add('in'); $$('[data-count]', el).forEach(countUp); }
    }), 60);

    /* ---------- Pointer parallax (hero) + tile spotlight ---------- */
    if (finePointer && !reduced) {
        const hero = $('.hero'), stage = $('#stage');
        let raf = 0, nx = 0, ny = 0;
        hero.addEventListener('pointermove', (e) => {
            const r = hero.getBoundingClientRect();
            nx = (e.clientX - r.left) / r.width - .5; ny = (e.clientY - r.top) / r.height - .5;
            if (raf) return;
            raf = requestAnimationFrame(() => { raf = 0; stage.style.setProperty('--px', nx.toFixed(3)); stage.style.setProperty('--py', ny.toFixed(3)); });
        }, { passive: true });
        hero.addEventListener('pointerleave', () => { stage.style.setProperty('--px', 0); stage.style.setProperty('--py', 0); });
        document.addEventListener('pointermove', (e) => {
            const t = e.target.closest && e.target.closest('.tile');
            if (!t) return;
            const r = t.getBoundingClientRect();
            t.style.setProperty('--mx', (e.clientX - r.left) + 'px'); t.style.setProperty('--my', (e.clientY - r.top) + 'px');
        }, { passive: true });
    }

    /* ---------- Screenshot rail: drag, arrows, progress ---------- */
    const rail = $('#rail'), bar = $('#railBar');
    function updateRail() {
        if (!rail) return;
        const max = rail.scrollWidth - rail.clientWidth;
        const p = max > 0 ? Math.abs(rail.scrollLeft) / max : 1;
        bar.style.setProperty('--p', Math.max(.12, Math.min(1, .12 + p * .88)));
    }
    function step(dir) {
        const card = $('.shot', rail), w = card.getBoundingClientRect().width + 20;
        // scrollLeft is negative in RTL, so "next" always means moving in the reading direction
        rail.scrollBy({ left: dir * w * (root.dir === 'rtl' ? -1 : 1), behavior: reduced ? 'auto' : 'smooth' });
    }
    $('#railPrev').addEventListener('click', () => step(-1));
    $('#railNext').addEventListener('click', () => step(1));
    rail.addEventListener('scroll', updateRail, { passive: true });
    rail.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); step(root.dir === 'rtl' ? -1 : 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); step(root.dir === 'rtl' ? 1 : -1); }
    });
    let down = false, startX = 0, startLeft = 0, moved = 0;
    rail.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return; // touch scrolls natively
        down = true; moved = 0; startX = e.clientX; startLeft = rail.scrollLeft;
        rail.classList.add('drag'); rail.setPointerCapture(e.pointerId);
    });
    rail.addEventListener('pointermove', (e) => {
        if (!down) return;
        moved = e.clientX - startX;
        rail.scrollLeft = startLeft - moved;
    });
    const endDrag = (e) => { if (!down) return; down = false; rail.classList.remove('drag'); try { rail.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ } };
    rail.addEventListener('pointerup', endDrag);
    rail.addEventListener('pointercancel', endDrag);

    /* ---------- Day / night: a sun/moon switch, the map fades between them ---------- */
    const compare = $('#compare'), dnSwitch = $('.dn-switch');
    if (compare && dnSwitch) {
        let auto = 0, visible = false, touched = false;
        const section = compare.closest('.daynight');
        const setNight = (on) => {
            compare.classList.toggle('is-night', on);
            section && section.classList.toggle('is-night', on);
            dnSwitch.classList.toggle('night', on);
            $$('button', dnSwitch).forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.dn === 'night') === on)));
        };
        $$('button', dnSwitch).forEach((b) => b.addEventListener('click', () => { touched = true; clearInterval(auto); setNight(b.dataset.dn === 'night'); }));
        // left alone, it alternates by itself while on screen
        if (!reduced) {
            new IntersectionObserver((es) => {
                visible = es[0].isIntersecting;
                clearInterval(auto);
                if (visible && !touched) {
                    setTimeout(() => { if (visible && !touched) setNight(true); }, 700);
                    auto = setInterval(() => { if (!touched) setNight(!compare.classList.contains('is-night')); }, 3200);
                }
            }, { threshold: .5 }).observe(compare);
        }
    }

    /* ---------- The playable board ---------- */
    const QUESTIONS = [
        { cat: { ar: 'ولاية البليدة', en: 'Blida' }, text: 'البليدة يسميوها مدينة …', gloss: 'Blida is nicknamed “the city of …”', answer: 'الورود' },
        { cat: { ar: 'الدارجة', en: 'Darija' }, text: 'كيفاش نقولو «الثلاجة» بالدارجة؟', gloss: 'How do we say “fridge” in darija?', answer: 'فريجيدار' },
        { cat: { ar: 'الأمثال', en: 'Proverbs' }, text: 'كمّل المثل: «القرد في عين أمو …»', gloss: 'Finish the proverb: “In his mother\'s eyes, the monkey is a …”', answer: 'غزال' }
    ];
    const FILL = 'ابتجحدرزسشصطعفقكلمنهوي';
    const svg = $('#board');
    let showQuestion = () => { };
    if (svg) {
        const NS = 'http://www.w3.org/2000/svg', R = 2, SIZE = 50, SQ3 = Math.sqrt(3);
        const cells = [];
        for (let q = -R; q <= R; q++) for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) cells.push({ q, r });
        const byKey = new Map(cells.map((c, i) => [c.q + ',' + c.r, i]));
        const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
        const neighbors = (i) => DIRS.map(([dq, dr]) => byKey.get((cells[i].q + dq) + ',' + (cells[i].r + dr))).filter((v) => v !== undefined);
        const W = SIZE * SQ3 * (2 * R + 1) + 16, H = SIZE * (3 * R + 2) + 26;
        svg.setAttribute('viewBox', `${-W / 2} ${-H / 2} ${W} ${H}`);
        const pts = (cx, cy, s) => [0, 1, 2, 3, 4, 5].map((k) => { const a = Math.PI / 180 * (60 * k - 90); return (cx + s * Math.cos(a)).toFixed(1) + ',' + (cy + s * Math.sin(a)).toFixed(1); }).join(' ');
        const els = cells.map((c, i) => {
            const x = SIZE * SQ3 * (c.q + c.r / 2), y = SIZE * 1.5 * c.r;
            const g = document.createElementNS(NS, 'g');
            g.setAttribute('class', 'cell'); g.dataset.i = i;
            g.innerHTML = `<polygon class="side" points="${pts(x, y + 6, SIZE * .93)}"/><polygon class="face" points="${pts(x, y, SIZE * .93)}"/><text x="${x}" y="${y - 2}"></text>`;
            svg.appendChild(g); return g;
        });

        const wordEl = $('#qWord'), dots = $$('#qDots i'), scoreEl = $('#qScore'), winEl = $('#qWin');
        let qi = 0, path = [], letters = [], sel = [], selecting = false, score = 0, hints = 0, solved = false;

        function randomPath(n) {
            for (let tries = 0; tries < 300; tries++) {
                const p = [Math.floor(Math.random() * cells.length)];
                const walk = () => {
                    if (p.length === n) return true;
                    const opts = neighbors(p[p.length - 1]).filter((v) => !p.includes(v)).sort(() => Math.random() - .5);
                    for (const o of opts) { p.push(o); if (walk()) return true; p.pop(); }
                    return false;
                };
                if (walk()) return p;
            }
            return null;
        }
        showQuestion = () => {
            const Q = QUESTIONS[Math.min(qi, QUESTIONS.length - 1)];
            $('#qText').textContent = Q.text;
            $('#qGloss').textContent = Q.gloss;
            $('#qCat').textContent = Q.cat[lang()] || Q.cat.ar;
        };
        function load() {
            const ans = Array.from(QUESTIONS[qi].answer.replace(/\s/g, ''));
            path = randomPath(ans.length);
            letters = cells.map(() => FILL[Math.floor(Math.random() * FILL.length)]);
            path.forEach((c, k) => { letters[c] = ans[k]; });
            els.forEach((g, i) => { g.classList.remove('sel', 'done', 'hint'); g.querySelector('text').textContent = letters[i]; });
            dots.forEach((d, k) => { d.className = k < qi ? 'ok' : k === qi ? 'on' : ''; });
            sel = []; hints = 0; solved = false;
            wordEl.textContent = ''; wordEl.className = '';
            showQuestion();
        }
        const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); const g = el && el.closest && el.closest('.cell'); return g ? +g.dataset.i : -1; };
        function paint() {
            els.forEach((g, i) => g.classList.toggle('sel', sel.includes(i)));
            wordEl.className = ''; wordEl.textContent = sel.map((i) => letters[i]).join('');
        }
        function add(i) {
            if (i < 0 || solved) return;
            const last = sel[sel.length - 1];
            if (i === last) return;
            if (sel.length >= 2 && i === sel[sel.length - 2]) { sel.pop(); paint(); return; } // going back one letter
            if (sel.includes(i) || (sel.length && !neighbors(last).includes(i))) return;
            sel.push(i);
            els[i].classList.remove('pop'); void els[i].getBBox(); els[i].classList.add('pop');
            paint();
        }
        svg.addEventListener('pointerdown', (e) => {
            if (solved) return;
            const i = cellAt(e.clientX, e.clientY);
            if (i < 0) return;
            selecting = true; sel = [];
            try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            add(i);
        });
        svg.addEventListener('pointermove', (e) => { if (selecting) add(cellAt(e.clientX, e.clientY)); });
        const release = () => {
            if (!selecting) return;
            selecting = false;
            const ok = sel.length === path.length && sel.every((v, k) => letters[v] === letters[path[k]]);
            if (ok) win(false);
            else if (sel.length > 1) {
                wordEl.className = 'bad';
                setTimeout(() => { sel = []; paint(); }, 450);
            } else { sel = []; paint(); }
        };
        svg.addEventListener('pointerup', release);
        svg.addEventListener('pointercancel', release);

        function win(revealed) {
            solved = true;
            path.forEach((i) => { els[i].classList.remove('sel', 'hint'); els[i].classList.add('done'); });
            wordEl.textContent = QUESTIONS[qi].answer; wordEl.className = 'ok';
            if (!revealed) { score += 100 + 25 * Math.max(0, 3 - hints); confetti(26); }
            scoreEl.textContent = score;
            setTimeout(() => {
                qi++;
                if (qi < QUESTIONS.length) load();
                else {
                    dots.forEach((d) => { d.className = 'ok'; });
                    winEl.classList.add('show');
                    confetti(70);
                }
            }, 1400);
        }
        $('#qHint').addEventListener('click', () => {
            if (solved || hints >= path.length) return;
            els[path[hints]].classList.add('hint'); hints++;
            if (hints === 1) toast(lang() === 'ar' ? 'الحرف الأول يبرق 💡' : 'The first letter is glowing 💡');
        });
        $('#qShow').addEventListener('click', () => { if (!solved) win(true); });
        $('#qAgain').addEventListener('click', () => { qi = 0; score = 0; scoreEl.textContent = '0'; winEl.classList.remove('show'); load(); });
        load();
    }

    function confetti(n) {
        if (reduced) return;
        const colors = ['#22c07a', '#ffffff', '#e5545d', '#ffc93c'];
        for (let k = 0; k < n; k++) {
            const c = document.createElement('i');
            c.className = 'confetti';
            c.style.left = Math.random() * 100 + 'vw';
            c.style.background = colors[k % 4];
            c.style.borderRadius = k % 3 ? '2px' : '50%';
            c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
            c.style.animationDelay = (Math.random() * .3) + 's';
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 3600);
        }
    }

    /* ---------- Background effect: drifting hexagons + low-poly parallax ---------- */
    function fillDrift(box, count) {
        if (!box) return;
        const tints = [['#ffffff', 'none'], ['#ffffff', 'none'], ['#ffffff', 'none'], ['#ffc93c', 'none'], ['#31c58a', 'rgba(49,197,138,.25)']];
        for (let k = 0; k < count; k++) {
            const [stroke, fill] = tints[k % tints.length];
            const s = document.createElement('span');
            const size = 34 + Math.random() * 96, t = 26 + Math.random() * 30;
            s.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;--s:${size.toFixed(0)}px;--t:${t.toFixed(1)}s;--dl:${(-Math.random() * t).toFixed(1)}s;` +
                `--dx:${((Math.random() - .5) * 120).toFixed(0)}px;--r:${(Math.random() < .5 ? -1 : 1) * (60 + Math.random() * 120) | 0}deg;` +
                `--o:${(.08 + Math.random() * .14).toFixed(2)};--c:${stroke};--f:${fill}`;
            s.innerHTML = '<svg viewBox="0 0 86.6 100"><polygon points="43.3,2 84.6,26 84.6,74 43.3,98 2,74 2,26"/></svg>';
            box.appendChild(s);
        }
    }
    // stars for the night sky of the day/night section
    const stars = $('#stars');
    if (stars) {
        for (let k = 0; k < (innerWidth < 700 ? 45 : 80); k++) {
            const i = document.createElement('i');
            i.style.cssText = `left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 78).toFixed(2)}%;` +
                `--z:${(1 + Math.random() * 2.2).toFixed(1)}px;--t:${(2 + Math.random() * 3.5).toFixed(1)}s;--dl:${(-Math.random() * 5).toFixed(1)}s`;
            stars.appendChild(i);
        }
    }
    // every animated background pauses while it is off-screen
    const fxIo = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('off', !e.isIntersecting)), { rootMargin: '120px 0px' });
    $$('.sec-fx, .hero-fx').forEach((el) => fxIo.observe(el));

    if (!reduced) {
        const small = innerWidth < 700;
        fillDrift($('#drift'), small ? 9 : 16);
        fillDrift($('#driftCta'), 7);
        $$('.sec-fx .drift[data-drift]').forEach((box) => fillDrift(box, Math.ceil(+box.dataset.drift * (small ? .6 : 1))));
        const poly = $('#heroPoly');
        let praf = 0;
        addEventListener('scroll', () => {
            if (praf || !poly || scrollY > innerHeight * 1.3) return;
            praf = requestAnimationFrame(() => { praf = 0; poly.style.setProperty('--sy', (scrollY * .28).toFixed(1) + 'px'); });
        }, { passive: true });
    }

    applyLang(lang());
    if (document.fonts) document.fonts.ready.then(movePill);
    addEventListener('resize', () => { movePill(); updateRail(); }, { passive: true });
})();
