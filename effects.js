/* Motion & micro-interactions. Everything is additive: without JS the site stays static and readable. */
(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    if (finePointer) {
        // Chrome does not blend against backgrounds propagated to the canvas,
        // so mirror the body paint on a real layer for the difference cursor.
        const backdrop = document.createElement('div');
        backdrop.className = 'fx-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        const paintBackdrop = () => {
            const cs = getComputedStyle(document.body);
            backdrop.style.backgroundColor = cs.backgroundColor;
            backdrop.style.backgroundImage = cs.backgroundImage;
            backdrop.style.backgroundSize = cs.backgroundSize;
            backdrop.style.backgroundPosition = cs.backgroundPosition;
            backdrop.style.backgroundRepeat = cs.backgroundRepeat;
        };
        paintBackdrop();
        document.body.appendChild(backdrop);
        window.addEventListener('resize', paintBackdrop);
    }

    const progress = document.createElement('div');
    progress.className = 'fx-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);

    let queued = false;
    const updateProgress = () => {
        queued = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    };
    const queueProgress = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(updateProgress);
    };
    updateProgress();
    window.addEventListener('scroll', queueProgress, { passive: true });
    window.addEventListener('resize', queueProgress);

    document.querySelectorAll('.ni, .arrow-tile, .cta-tile, .reactions span, .pcard-link span, .clover').forEach((icon) => {
        icon.classList.add('fx-icon');
    });

    const skipText = '.nav, .ruler, .ticker, .marquee, .hero-time, .btn, .contact-btn, .cta-contact, .cta-tile, .arrow-tile, .chip, .reactions, .nav-mail, .brand, .site-badge, .fx-cursor, .fx-backdrop, .note, .sticker-note, .poem-note, .page-deco, .mark, .cursor, .pcard-link, [aria-hidden="true"]';
    const textRoots = document.querySelectorAll('main p, main h1, main h2, main h3, main blockquote, main figcaption, main dd, main dt, main li, main .poem-lines, main .hand');
    const seenRoots = new Set();
    const wordNodes = [];

    textRoots.forEach((root) => {
        if (seenRoots.has(root) || root.closest(skipText)) return;
        seenRoots.add(root);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent || parent.closest(skipText) || parent.closest('.fx-word')) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        while (walker.nextNode()) wordNodes.push(walker.currentNode);
    });

    wordNodes.forEach((node) => {
        const parent = node.parentElement;
        if (!parent) return;
        const isTitle = Boolean(parent.closest('h1, h2, h3, .display-title, .hero-name'));
        const fragment = document.createDocumentFragment();
        node.nodeValue.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
                fragment.appendChild(document.createTextNode(part));
                return;
            }
            const word = document.createElement('span');
            word.className = isTitle ? 'fx-word fx-word-pop' : 'fx-word';
            word.textContent = part;
            fragment.appendChild(word);
        });
        node.parentNode.replaceChild(fragment, node);
    });

    const cascadeTargets = document.querySelectorAll('.hero-name, .display-title, .section-hand, .about-hand, .page-title');
    cascadeTargets.forEach((root) => {
        root.querySelectorAll('.fx-word').forEach((word, index) => {
            word.style.setProperty('--fx-i', String(index));
        });
    });

    if (!reduce) {
        setTimeout(() => {
            document.querySelectorAll('.hero-name, .page-title').forEach((el) => {
                el.classList.add('fx-title-in');
            });
        }, 430);
    }

    if (!reduce && finePointer) {
        const items = [];
        let pointerX = -9999;
        let pointerY = -9999;
        let raf = 0;
        let measureTimer = 0;

        const measure = () => {
            items.length = 0;
            const targets = document.querySelectorAll('.fx-icon, .fx-word, .btn, .contact-btn, .nav-mail, .brand');
            targets.forEach((el) => {
                el.style.removeProperty('--fx-tx');
                el.style.removeProperty('--fx-ty');
                el.style.removeProperty('--fx-s');
                el.style.removeProperty('--fx-r');
                if (el.matches('.btn, .contact-btn, .nav-mail, .brand')) el.style.removeProperty('translate');
            });
            const sx = window.scrollX;
            const sy = window.scrollY;
            targets.forEach((el) => {
                const r = el.getBoundingClientRect();
                if (r.width < 1 || r.height < 1) return;
                const icon = el.classList.contains('fx-icon');
                const title = el.classList.contains('fx-word-pop');
                const brand = !icon && !title && el.classList.contains('brand');
                const button = !icon && !title && !brand && el.matches('.btn, .contact-btn, .nav-mail');
                items.push({
                    el,
                    cx: r.left + r.width / 2 + sx,
                    cy: r.top + r.height / 2 + sy,
                    hw: r.width / 2,
                    hh: r.height / 2,
                    button,
                    brand,
                    radius: brand ? 74 : button ? 58 : icon ? 64 : title ? 106 : 58,
                    pull: brand ? 6 : button ? 8 : icon ? 13 : title ? 17 : 5,
                    pullX: brand || button || icon || title ? 1 : .4,
                    grow: brand ? 0 : button ? 0 : icon ? .24 : title ? .03 : .03,
                    tilt: brand ? 3 : button ? 0 : icon ? 14 : title ? 1.8 : 2.4,
                    tx: 0,
                    ty: 0,
                    s: 1,
                    r: 0
                });
            });
            queue();
        };

        const scheduleMeasure = () => {
            clearTimeout(measureTimer);
            measureTimer = setTimeout(measure, 180);
        };

        const frame = () => {
            raf = 0;
            const px = pointerX + window.scrollX;
            const py = pointerY + window.scrollY;
            const live = pointerX > -999;
            items.forEach((it) => {
                let strength = 0;
                let dx = 0;
                let dy = 0;
                if (live) {
                    dx = px - it.cx;
                    dy = py - it.cy;
                    const ox = Math.max(Math.abs(dx) - it.hw, 0);
                    const oy = Math.max(Math.abs(dy) - it.hh, 0);
                    const dist = Math.sqrt(ox * ox + oy * oy);
                    if (dist < it.radius) {
                        const t = 1 - dist / it.radius;
                        strength = t * t * (3 - 2 * t);
                    }
                }
                const len = Math.sqrt(dx * dx + dy * dy);
                const ux = len > .5 ? dx / len : 0;
                const uy = len > .5 ? dy / len : 0;
                const tx = ux * it.pull * strength * it.pullX;
                const ty = uy * it.pull * strength;
                const s = 1 + it.grow * strength;
                const r = Math.max(-1, Math.min(1, dx / it.radius)) * it.tilt * strength;
                if (Math.abs(it.tx - tx) < .05 && Math.abs(it.ty - ty) < .05 && Math.abs(it.s - s) < .002 && Math.abs(it.r - r) < .05) return;
                it.tx = tx;
                it.ty = ty;
                it.s = s;
                it.r = r;
                if (it.button || it.brand) {
                    it.el.style.translate = tx.toFixed(1) + 'px ' + ty.toFixed(1) + 'px';
                } else {
                    it.el.style.setProperty('--fx-tx', tx.toFixed(1) + 'px');
                    it.el.style.setProperty('--fx-ty', ty.toFixed(1) + 'px');
                    it.el.style.setProperty('--fx-s', s.toFixed(3));
                    it.el.style.setProperty('--fx-r', r.toFixed(2) + 'deg');
                }
            });
        };

        const queue = () => {
            if (!raf) raf = requestAnimationFrame(frame);
        };

        window.addEventListener('pointermove', (event) => {
            if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
            pointerX = event.clientX;
            pointerY = event.clientY;
            queue();
        }, { passive: true });

        const rest = () => {
            pointerX = -9999;
            pointerY = -9999;
            queue();
        };
        document.addEventListener('mouseleave', rest);
        window.addEventListener('blur', rest);
        window.addEventListener('scroll', () => {
            queue();
            scheduleMeasure();
        }, { passive: true });
        window.addEventListener('resize', scheduleMeasure);

        measure();
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => setTimeout(measure, 350));
        }
        window.addEventListener('load', () => setTimeout(measure, 300));
        setTimeout(measure, 1600);
    }

    if (!reduce) {
        const nav = document.querySelector('.nav');
        if (nav) {
            const syncNav = () => nav.classList.toggle('fx-stuck', window.scrollY > 24);
            syncNav();
            window.addEventListener('scroll', syncNav, { passive: true });
        }

        const needle = document.createElement('span');
        needle.className = 'fx-ruler-needle';
        needle.setAttribute('aria-hidden', 'true');
        document.body.appendChild(needle);
        let needleRaf = 0;
        const placeNeedle = () => {
            needleRaf = 0;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
            needle.style.transform = 'translate3d(' + (ratio * (window.innerWidth - 24) + 12).toFixed(1) + 'px,0,0)';
        };
        const queueNeedle = () => {
            if (!needleRaf) needleRaf = requestAnimationFrame(placeNeedle);
        };
        placeNeedle();
        window.addEventListener('scroll', queueNeedle, { passive: true });
        window.addEventListener('resize', queueNeedle);
    }

    if (!reduce && finePointer) {
        const glow = document.createElement('div');
        glow.className = 'fx-glow';
        glow.setAttribute('aria-hidden', 'true');
        document.body.appendChild(glow);
        window.addEventListener('pointermove', (event) => {
            if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
            glow.style.transform = 'translate3d(' + event.clientX + 'px,' + event.clientY + 'px,0)';
        }, { passive: true });

        const sparkColors = ['#36c5f0', '#e01e5a', '#e8b43c', '#111212'];
        document.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
            const x = event.clientX;
            const y = event.clientY;

            const ring = document.createElement('span');
            ring.className = 'fx-ripple';
            ring.style.left = x + 'px';
            ring.style.top = y + 'px';
            document.body.appendChild(ring);
            ring.addEventListener('animationend', () => ring.remove());

            const inkRing = document.createElement('span');
            inkRing.className = 'fx-ripple fx-ripple-ink';
            inkRing.style.left = x + 'px';
            inkRing.style.top = y + 'px';
            document.body.appendChild(inkRing);
            inkRing.addEventListener('animationend', () => inkRing.remove());

            for (let i = 0; i < 10; i++) {
                const spark = document.createElement('span');
                spark.className = 'fx-spark';
                const angle = (Math.PI * 2 * i) / 10 + Math.random() * .4;
                const dist = 34 + Math.random() * 46;
                spark.style.left = x + 'px';
                spark.style.top = y + 'px';
                spark.style.background = sparkColors[i % sparkColors.length];
                spark.style.setProperty('--sx', (Math.cos(angle) * dist).toFixed(1) + 'px');
                spark.style.setProperty('--sy', (Math.sin(angle) * dist).toFixed(1) + 'px');
                spark.style.setProperty('--sr', Math.round(Math.random() * 320 - 160) + 'deg');
                spark.style.animationDelay = (Math.random() * .06).toFixed(2) + 's';
                document.body.appendChild(spark);
                spark.addEventListener('animationend', () => spark.remove());
            }
        }, { passive: true });
    }

    const hero = [
        ['.hero-time', 0],
        ['.note-a', 120],
        ['.note-b', 200],
        ['.hand-wrap', 80],
        ['.name-frame', 160],
        ['.avail', 240],
        ['.avatar-sticker.one', 300],
        ['.avatar-sticker.two', 380],
        ['.sticker-note.role', 420],
        ['.sticker-note.loc', 480],
        ['.hero-note', 320],
        ['.hero-actions', 420],
        ['.hero .cursor', 540],
        ['.page-hero-top', 0],
        ['.page-frame', 90],
        ['.page-sub', 170],
        ['.page-deco', 250]
    ];

    hero.forEach(([selector, delay]) => {
        document.querySelectorAll(selector).forEach((el) => {
            el.classList.add('fx-hero');
            el.style.setProperty('--fx-hd', delay + 'ms');
        });
    });

    void document.body.offsetHeight;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => document.body.classList.add('fx-loaded'));
    });

    if ('IntersectionObserver' in window) {
        const targets = [
            '.about-hand', '.about-arc', '.select-label', '.about-statement',
            '.skill-card', '.about-sign',
            '.showcase .eyebrow', '.showcase .section-hand', '.showcase .display-title',
            '.section-meta', '.pcard',
            '.poem-wrap .eyebrow', '.poem-wrap .section-hand', '.poem-wrap .display-title',
            '.poem-note', '.poem-lines', '.poem-foot',
            '.footer-brand', '.comment-card', '.cta-banner', '.footer-bottom',
            '.profile-card', '.profile-stats', '.data-card', '.profile-quote',
            '.profile-wrap .hero-actions',
            '.log-foot', '.gallery-note', '.polaroid', '.quote-card'
        ];
        const seen = new Set();
        const revealer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('fx-in');
                const title = entry.target.matches('.display-title, .section-hand, .about-hand')
                    ? entry.target
                    : entry.target.querySelector('.display-title, .section-hand, .about-hand');
                if (title) title.classList.add('fx-title-in');
                revealer.unobserve(entry.target);
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

        targets.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el) => {
                if (seen.has(el) || el.closest('.rise') || el.closest('.fx-hero')) return;
                seen.add(el);
                const siblings = el.parentElement
                    ? Array.from(el.parentElement.children).filter((sib) => sib.classList.contains(el.classList[0]))
                    : [el];
                const index = Math.max(0, siblings.indexOf(el));
                el.style.setProperty('--fx-d', Math.min(index, 6) * 70 + 'ms');
                el.classList.add('fx-reveal');
                revealer.observe(el);
            });
        });

        const stats = reduce ? [] : Array.from(document.querySelectorAll('.stat b'));
        if (stats.length) {
            const counter = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    counter.unobserve(entry.target);
                    const el = entry.target;
                    const label = el.textContent.trim();
                    const goal = parseInt(label, 10);
                    if (!Number.isFinite(goal)) return;
                    const started = performance.now();
                    const duration = 1100;
                    const step = (now) => {
                        const value = Math.min(1, (now - started) / duration);
                        const eased = 1 - Math.pow(1 - value, 3);
                        el.textContent = String(Math.round(goal * eased)).padStart(label.length, '0');
                        if (value < 1) requestAnimationFrame(step);
                    };
                    requestAnimationFrame(step);
                });
            }, { threshold: 0.6 });
            stats.forEach((el) => counter.observe(el));
        }
    }

    if (!reduce && finePointer && window.innerWidth > 900) {
        document.querySelectorAll('.pcard-media').forEach((card) => {
            card.addEventListener('pointermove', (event) => {
                const rect = card.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - 0.5;
                const y = (event.clientY - rect.top) / rect.height - 0.5;
                card.style.transform = `perspective(1100px) rotateX(${(-y * 4.6).toFixed(2)}deg) rotateY(${(x * 4.6).toFixed(2)}deg)`;
            });
            card.addEventListener('pointerleave', () => {
                card.style.transform = '';
            });
        });

        document.querySelectorAll('.polaroid').forEach((card) => {
            card.addEventListener('pointermove', (event) => {
                const rect = card.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - 0.5;
                const y = (event.clientY - rect.top) / rect.height - 0.5;
                card.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-4px)`;
            });
            card.addEventListener('pointerleave', () => {
                card.style.transform = '';
            });
        });
    }

    if (finePointer) {
        const cursor = document.createElement('div');
        cursor.className = 'fx-cursor';
        cursor.setAttribute('aria-hidden', 'true');
        cursor.innerHTML = '<span class="fx-cursor-echo"></span><span class="fx-cursor-echo"></span><span class="fx-cursor-echo"></span><span class="fx-cursor-echo"></span><span class="fx-cursor-dot"></span><span class="fx-cursor-tag">You</span>';
        document.body.appendChild(cursor);

        const dot = cursor.querySelector('.fx-cursor-dot');
        const tag = cursor.querySelector('.fx-cursor-tag');
        const echoes = Array.from(cursor.querySelectorAll('.fx-cursor-echo'));
        const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

        let tx = window.innerWidth / 2;
        let ty = window.innerHeight / 2;
        let px = tx;
        let py = ty;
        let speed = 0;
        let dotScale = 1;
        let pressed = false;
        let running = false;
        let shown = false;

        cursor.style.transform = 'translate3d(' + px + 'px, ' + py + 'px, 0)';

        const frame = () => {
            const dx = tx - px;
            const dy = ty - py;
            const glide = reduce ? 1 : 0.42;
            px += dx * glide;
            py += dy * glide;
            speed += (Math.hypot(dx, dy) - speed) * 0.22;
            if (reduce) speed = 0;

            const inflate = Math.min(1.45, speed * 0.05);
            const targetScale = (1 + inflate) * (pressed ? 0.62 : 1);
            dotScale += (targetScale - dotScale) * 0.3;

            const spread = Math.min(26, speed * 0.5);
            const echoScale = Math.max(0.4, 1 - speed * 0.014);
            const echoOpacity = Math.min(1, Math.max(0, (speed - 5) / 14));

            cursor.style.transform = 'translate3d(' + px.toFixed(2) + 'px, ' + py.toFixed(2) + 'px, 0)';
            dot.style.transform = 'scale(' + dotScale.toFixed(3) + ')';
            tag.style.transform = 'translate(' + ((dotScale - 1) * 10).toFixed(2) + 'px, ' + ((dotScale - 1) * 10).toFixed(2) + 'px)';
            echoes.forEach((el, index) => {
                const [cx, cy] = corners[index];
                el.style.transform = 'translate(' + (cx * spread).toFixed(2) + 'px, ' + (cy * spread).toFixed(2) + 'px) scale(' + echoScale.toFixed(3) + ')';
                el.style.opacity = echoOpacity.toFixed(2);
            });

            if (Math.abs(dx) > 0.15 || Math.abs(dy) > 0.15 || speed > 0.2 || Math.abs(dotScale - targetScale) > 0.004) {
                requestAnimationFrame(frame);
            } else {
                running = false;
            }
        };

        const start = () => {
            if (running) return;
            running = true;
            requestAnimationFrame(frame);
        };

        window.addEventListener('pointermove', (event) => {
            if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
            tx = event.clientX;
            ty = event.clientY;
            if (!shown) {
                shown = true;
                px = tx;
                py = ty;
            }
            cursor.classList.add('fx-cursor-on');
            start();
        }, { passive: true });

        window.addEventListener('pointerdown', () => {
            pressed = true;
            start();
        });
        window.addEventListener('pointerup', () => {
            pressed = false;
            start();
        });
        document.addEventListener('mouseleave', () => cursor.classList.remove('fx-cursor-on'));
        window.addEventListener('blur', () => cursor.classList.remove('fx-cursor-on'));
    }

    if (!reduce && finePointer && window.innerWidth > 900) {
        const root = document.documentElement;
        const backdrop = document.querySelector('.fx-backdrop');
        const trail = document.createElement('span');
        trail.className = 'fx-trail';
        trail.setAttribute('aria-hidden', 'true');
        document.body.appendChild(trail);

        let targetMx = 0;
        let targetMy = 0;
        let mx = 0;
        let my = 0;
        let lean = 0;
        let speed = 0;
        let angle = 0;
        let atX = window.innerWidth / 2;
        let atY = window.innerHeight / 2;
        let lastX = null;
        let lastY = null;
        let raf = 0;

        const paint = () => {
            root.style.setProperty('--fx-mx', mx.toFixed(3));
            root.style.setProperty('--fx-my', my.toFixed(3));
            root.style.setProperty('--fx-sv', lean.toFixed(3));
            if (backdrop) {
                backdrop.style.backgroundPosition = (mx * -8).toFixed(1) + 'px ' + (my * -6).toFixed(1) + 'px';
            }
            trail.style.width = (14 + speed * 110).toFixed(1) + 'px';
            trail.style.opacity = Math.min(.9, speed * 1.25).toFixed(2);
            trail.style.transform = 'translate3d(' + atX.toFixed(1) + 'px,' + atY.toFixed(1) + 'px,0) rotate(' + angle.toFixed(1) + 'deg) translate(-100%,0)';
        };

        const frame = () => {
            raf = 0;
            mx += (targetMx - mx) * .085;
            my += (targetMy - my) * .085;
            lean *= .88;
            speed *= .9;
            paint();
            if (Math.abs(targetMx - mx) > .0015 || Math.abs(targetMy - my) > .0015 || Math.abs(lean) > .01 || speed > .01) {
                raf = requestAnimationFrame(frame);
            }
        };

        const kick = () => {
            if (!raf) raf = requestAnimationFrame(frame);
        };

        window.addEventListener('pointermove', (event) => {
            if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
            targetMx = (event.clientX / window.innerWidth) * 2 - 1;
            targetMy = (event.clientY / window.innerHeight) * 2 - 1;
            atX = event.clientX;
            atY = event.clientY;
            if (lastX !== null) {
                const dx = event.clientX - lastX;
                const dy = event.clientY - lastY;
                if (Math.abs(dx) + Math.abs(dy) > 1) {
                    angle = Math.atan2(dy, dx) * 180 / Math.PI;
                    speed = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 26);
                    lean = Math.max(-1, Math.min(1, dx / 24));
                }
            }
            lastX = event.clientX;
            lastY = event.clientY;
            kick();
        }, { passive: true });

        const calm = () => {
            targetMx = 0;
            targetMy = 0;
            lastX = null;
            lastY = null;
            speed = 0;
            kick();
        };
        document.addEventListener('mouseleave', calm);
        window.addEventListener('blur', calm);

        window.addEventListener('resize', () => {
            if (window.innerWidth <= 900) {
                targetMx = 0;
                targetMy = 0;
                mx = 0;
                my = 0;
                lean = 0;
                speed = 0;
                root.style.setProperty('--fx-mx', '0');
                root.style.setProperty('--fx-my', '0');
                root.style.setProperty('--fx-sv', '0');
                trail.style.opacity = '0';
            }
        });
    }
})();
