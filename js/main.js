/* ══════════════════════════════════════
   FIRST FOLD — HERO, CURSOR & SMOOTH SCROLL
══════════════════════════════════════ */
        (function () {
            gsap.registerPlugin(ScrollTrigger);

            /* ══════════════════════════════════════
               LENIS SMOOTH SCROLL
            ══════════════════════════════════════ */
            const lenis = new Lenis({
                duration: 1.2,
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                orientation: 'vertical',
                smoothWheel: true,
            });

            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add((time) => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);

            function lerp(a, b, t) { return a + (b - a) * t; }

            /* ══════════════════════════════════════
               ELEMENTS
            ══════════════════════════════════════ */
            const section = document.getElementById('hero-scroll-section');
            const video = document.getElementById('hero-video');
            const canvas = document.getElementById('hero-canvas');
            const ctx = canvas.getContext('2d');
            const loadingBar = document.getElementById('loading-bar');

            /* ══════════════════════════════════════
               CANVAS COVER-FIT RESIZE
            ══════════════════════════════════════ */
            const FRAME_COUNT = 90;
            const CAPTURE_W = 1280;
            const CAPTURE_H = 720;
            let displayW = 0, displayH = 0;
            let captureAspect = CAPTURE_W / CAPTURE_H;

            function resizeCanvas() {
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                displayW = window.innerWidth;
                displayH = window.innerHeight;
                canvas.width = displayW * dpr;
                canvas.height = displayH * dpr;
                canvas.style.width = displayW + 'px';
                canvas.style.height = displayH + 'px';
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            window.addEventListener('resize', resizeCanvas);
            resizeCanvas();

            /* ══════════════════════════════════════
               FRAME STORE + DRAW
            ══════════════════════════════════════ */
            const frames = [];
            let extractionDone = false;
            let framesReady = 0;

            function drawFrame(frameIndex) {
                const idx = Math.max(0, Math.min(Math.round(frameIndex), frames.length - 1));
                const img = frames[idx];
                if (!img) return;

                const vpAspect = displayW / displayH;
                let drawW, drawH, offsetX, offsetY;

                if (vpAspect > captureAspect) {
                    drawW = displayW;
                    drawH = displayW / captureAspect;
                    offsetX = 0;
                    offsetY = (displayH - drawH) / 2;
                } else {
                    drawH = displayH;
                    drawW = displayH * captureAspect;
                    offsetX = (displayW - drawW) / 2;
                    offsetY = 0;
                }

                ctx.clearRect(0, 0, displayW, displayH);
                ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
            }

            /* ══════════════════════════════════════
               SCROLL → FRAME MAPPING
            ══════════════════════════════════════ */
            let targetFrame = 0;
            let currentFrame = 0;
            let lastDrawnFrame = -1;

            ScrollTrigger.create({
                trigger: section,
                start: 'top top',
                end: 'bottom bottom',
                onUpdate: (self) => {
                    // Always map against the full frame range so the
                    // target stays stable while extraction completes
                    targetFrame = self.progress * (FRAME_COUNT - 1);
                },
            });

            function renderTick() {
                if (framesReady > 1) {
                    currentFrame = lerp(currentFrame, targetFrame, 0.22);
                    // Clamp to frames actually available
                    const idx = Math.max(0, Math.min(Math.round(currentFrame), framesReady - 1));
                    if (idx !== lastDrawnFrame) {
                        drawFrame(idx);
                        lastDrawnFrame = idx;
                    }
                }
                requestAnimationFrame(renderTick);
            }

            renderTick();

            /* ══════════════════════════════════════
               PROGRESSIVE FRAME EXTRACTION
               Page is shown immediately after frame 0.
               Remaining frames are extracted in the
               background — scroll works throughout.
            ══════════════════════════════════════ */
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = CAPTURE_W;
            tmpCanvas.height = CAPTURE_H;
            const tmpCtx = tmpCanvas.getContext('2d');

            async function extractFramesProgressive() {
                const duration = video.duration;
                captureAspect = (video.videoWidth || CAPTURE_W) / (video.videoHeight || CAPTURE_H);

                for (let i = 0; i < FRAME_COUNT; i++) {
                    video.currentTime = (i / (FRAME_COUNT - 1)) * duration;

                    await new Promise((resolve) => { video.addEventListener('seeked', resolve, { once: true }); });

                    tmpCtx.drawImage(video, 0, 0, CAPTURE_W, CAPTURE_H);
                    const bitmap = await createImageBitmap(tmpCanvas);
                    frames[i] = bitmap;
                    framesReady = i + 1;

                    // Update thin loading bar
                    loadingBar.style.width = ((i + 1) / FRAME_COUNT * 100) + '%';

                    // On frame 0: immediately show page
                    if (i === 0) {
                        drawFrame(0);
                        runEntryAnimations();
                    }

                }

                tmpCanvas.width = 0;
                tmpCanvas.height = 0;
                extractionDone = true;
                loadingBar.classList.add('done');
            }

            /* ══════════════════════════════════════
               FALLBACK — video.currentTime seek
            ══════════════════════════════════════ */
            function fallbackToVideoScrub() {
                canvas.style.display = 'none';
                video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:1;pointer-events:none;';

                let vTarget = 0, vCurrent = 0;
                ScrollTrigger.create({
                    trigger: section,
                    start: 'top top',
                    end: 'bottom bottom',
                    onUpdate: (self) => { vTarget = self.progress * (video.duration || 0); },
                });

                (function vTick() {
                    if (video.readyState >= 2) {
                        vCurrent = lerp(vCurrent, vTarget, 0.1);
                        if (Math.abs(vCurrent - video.currentTime) > 0.01) video.currentTime = vCurrent;
                    }
                    requestAnimationFrame(vTick);
                })();

                runEntryAnimations();
                loadingBar.classList.add('done');
            }

            /* ══════════════════════════════════════
               BOOT — non-blocking
            ══════════════════════════════════════ */
            async function boot() {
                try {
                    if (video.readyState < 1) {
                        await new Promise((resolve, reject) => {
                            video.addEventListener('loadedmetadata', resolve, { once: true });
                            setTimeout(() => reject(new Error('timeout')), 10000);
                        });
                    }
                    await extractFramesProgressive();
                } catch (err) {
                    console.warn('Falling back to video scrub:', err);
                    fallbackToVideoScrub();
                }
            }

            boot();

            /* ══════════════════════════════════════
               GSAP ENTRY ANIMATIONS
            ══════════════════════════════════════ */
            function runEntryAnimations() {
                const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

                tl.from('#hero-caption', {
                    opacity: 0,
                    y: 20,
                    duration: 0.8,
                    delay: 0.2,
                });

                tl.from(['#title-line-1', '#title-line-2', '#title-line-3'], {
                    clipPath: 'inset(100% 0 0 0)',
                    y: 60,
                    opacity: 0,
                    duration: 1,
                    stagger: 0.15,
                }, '-=0.4');

                tl.from('#hero-tagline', {
                    opacity: 0,
                    y: 30,
                    duration: 0.8,
                }, '-=0.5');

                tl.from('#hero-cta', {
                    opacity: 0,
                    y: 30,
                    duration: 0.8,
                }, '-=0.5');

                tl.from('#hero-badges .hero-badge', {
                    opacity: 0,
                    y: 20,
                    stagger: 0.1,
                    duration: 0.6,
                }, '-=0.4');

                tl.from('#scroll-indicator', {
                    opacity: 0,
                    y: 20,
                    duration: 0.8,
                }, '-=0.6');
            }

            /* navbar is always opaque — no scroll toggle needed */

            /* ══════════════════════════════════════
               CUSTOM CURSOR
            ══════════════════════════════════════ */
            const cursorDot = document.getElementById('cursor-dot');
            const cursorRing = document.getElementById('cursor-ring');
            let mouseX = 0, mouseY = 0;
            let ringX = 0, ringY = 0;

            document.addEventListener('mousemove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;
                cursorDot.style.left = mouseX + 'px';
                cursorDot.style.top = mouseY + 'px';
            });

            (function cursorTick() {
                ringX = lerp(ringX, mouseX, 0.12);
                ringY = lerp(ringY, mouseY, 0.12);
                cursorRing.style.left = ringX + 'px';
                cursorRing.style.top = ringY + 'px';
                requestAnimationFrame(cursorTick);
            })();

            document.querySelectorAll('a, button, .hero-cta-btn').forEach((el) => {
                el.addEventListener('mouseenter', () => cursorRing.classList.add('hovering'));
                el.addEventListener('mouseleave', () => cursorRing.classList.remove('hovering'));
            });

            /* ══════════════════════════════════════
               HIDE SCROLL INDICATOR ON SCROLL
            ══════════════════════════════════════ */
            const scrollIndicator = document.getElementById('scroll-indicator');
            let indicatorHidden = false;
            window.addEventListener('scroll', () => {
                if (!indicatorHidden && window.scrollY > 100) {
                    gsap.to(scrollIndicator, { opacity: 0, duration: 0.5 });
                    indicatorHidden = true;
                } else if (indicatorHidden && window.scrollY <= 100) {
                    gsap.to(scrollIndicator, { opacity: 1, duration: 0.5 });
                    indicatorHidden = false;
                }
            }, { passive: true });
        })();

/* ══════════════════════════════════════
   SECOND FOLD — GSAP ANIMATIONS
══════════════════════════════════════ */
        (function () {

            const engSection = document.getElementById('tecnologia');
            if (!engSection) return;

            /* ── Top rule line draw ── */
            gsap.to('#eng-top-rule', {
                scaleX: 1,
                duration: 1.6,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: engSection,
                    start: 'top 85%',
                }
            });

            /* ── Measure bar ── */
            gsap.to('#eng-measure', {
                opacity: 1,
                duration: 1.2,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: engSection,
                    start: 'top 75%',
                }
            });

            /* ── Pen image entrance ── */
            gsap.fromTo('#eng-image-stage', {
                opacity: 0,
                scale: 1.08,
            }, {
                opacity: 1,
                scale: 1,
                duration: 1.8,
                ease: 'power4.out',
                scrollTrigger: {
                    trigger: engSection,
                    start: 'top 72%',
                }
            });

            /* ── Parallax: image slowly zooms/drifts on scroll ── */
            gsap.to('#eng-image-stage .eng-image-wrapper img', {
                scale: 1.08,
                ease: 'none',
                scrollTrigger: {
                    trigger: engSection,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 2,
                }
            });

            /* ── Spec pills staggered ── */
            gsap.to(['#spill-1', '#spill-2', '#spill-3', '#spill-4'], {
                opacity: 1,
                y: 0,
                duration: 0.9,
                ease: 'power4.out',
                stagger: 0.18,
                scrollTrigger: {
                    trigger: engSection,
                    start: 'top 65%',
                }
            });

            /* Floating animation after reveal */
            document.querySelectorAll('.spec-pill').forEach((pill, i) => {
                const dir = i % 2 === 0 ? -6 : 6;
                gsap.to(pill, {
                    y: dir,
                    duration: 3 + i * 0.5,
                    ease: 'sine.inOut',
                    repeat: -1,
                    yoyo: true,
                    delay: i * 0.4,
                });
            });

            /* ── Eyebrow ── */
            gsap.to('#eng-eyebrow', {
                opacity: 1,
                y: 0,
                duration: 0.9,
                ease: 'power4.out',
                scrollTrigger: {
                    trigger: engSection,
                    start: 'top 70%',
                }
            });

            /* ── Headline lines clip-path reveal ── */
            gsap.to(['#ehl-1', '#ehl-2', '#ehl-3'], {
                opacity: 1,
                y: 0,
                duration: 1.3,
                ease: 'power4.out',
                stagger: 0.13,
                scrollTrigger: {
                    trigger: engSection,
                    start: 'top 68%',
                }
            });

            /* ── Intro paragraph ── */
            gsap.to('#eng-intro', {
                opacity: 1,
                y: 0,
                duration: 1,
                ease: 'power4.out',
                scrollTrigger: {
                    trigger: '#eng-intro',
                    start: 'top 82%',
                }
            });

            /* ── Feature rows slide in from left, staggered ── */
            gsap.to(['#ef-1', '#ef-2', '#ef-3', '#ef-4', '#ef-5'], {
                opacity: 1,
                x: 0,
                duration: 0.8,
                ease: 'power4.out',
                stagger: 0.1,
                scrollTrigger: {
                    trigger: '#eng-features',
                    start: 'top 80%',
                }
            });

            /* ── CTA Row ── */
            gsap.to('#eng-cta-row', {
                opacity: 1,
                y: 0,
                duration: 0.9,
                ease: 'power4.out',
                scrollTrigger: {
                    trigger: '#eng-cta-row',
                    start: 'top 88%',
                }
            });

            /* ── Subtle exit: image drifts as section leaves ── */
            gsap.to('#eng-image-col', {
                opacity: 0.3,
                ease: 'none',
                scrollTrigger: {
                    trigger: engSection,
                    start: 'bottom 60%',
                    end: 'bottom top',
                    scrub: true,
                }
            });

        })();

/* ══════════════════════════════════════
   THIRD FOLD — GSAP ANIMATIONS
══════════════════════════════════════ */
        (function () {

            const expSection = document.getElementById('escrita');
            if (!expSection) return;

            /* ── Top rule draws in ── */
            gsap.to('#exp-top-rule', {
                scaleX: 1,
                duration: 1.8,
                ease: 'power3.out',
                scrollTrigger: { trigger: expSection, start: 'top 90%' }
            });

            /* ── Section number fades in from left ── */
            gsap.to('#exp-number', {
                opacity: 1,
                x: 0,
                duration: 1.2,
                ease: 'power4.out',
                scrollTrigger: { trigger: expSection, start: 'top 78%' }
            });

            /* ── Eyebrow ── */
            gsap.to('#exp-eyebrow', {
                opacity: 1,
                y: 0,
                duration: 0.9,
                ease: 'power4.out',
                scrollTrigger: { trigger: expSection, start: 'top 74%' }
            });

            /* ── Headline lines staggered clip-path ── */
            gsap.to(['#exp-hl-1', '#exp-hl-2', '#exp-hl-3'], {
                opacity: 1,
                y: 0,
                duration: 1.2,
                ease: 'power4.out',
                stagger: 0.12,
                scrollTrigger: { trigger: expSection, start: 'top 72%' }
            });

            /* ── Video frame entrance ── */
            gsap.to('#exp-video-frame', {
                opacity: 1,
                y: 0,
                duration: 1.4,
                ease: 'power4.out',
                scrollTrigger: { trigger: '#exp-video-frame', start: 'top 82%' }
            });

            /* ── Subtle video Ken Burns parallax on scroll ── */
            gsap.to('#exp-video-frame video', {
                scale: 1.06,
                ease: 'none',
                scrollTrigger: {
                    trigger: '#exp-video-frame',
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 2
                }
            });

            /* ── Stats stagger in ── */
            gsap.to(['#exp-st-1', '#exp-st-2', '#exp-st-3', '#exp-st-4'], {
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: 'power4.out',
                stagger: 0.1,
                scrollTrigger: { trigger: '#exp-stats', start: 'top 80%' }
            });

            /* ── Counter animation ── */
            function animateCounter(el) {
                const target = parseInt(el.dataset.count, 10);
                if (!target) return;
                const suffix = el.nextElementSibling?.textContent || '';
                let start = null;
                const duration = 1600;

                function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

                function tick(ts) {
                    if (!start) start = ts;
                    const elapsed = ts - start;
                    const progress = Math.min(elapsed / duration, 1);
                    const value = Math.round(easeOut(progress) * target);
                    el.textContent = value >= 1000
                        ? (value / 1000).toFixed(0) + 'K'
                        : value;
                    if (progress < 1) requestAnimationFrame(tick);
                    else el.textContent = target >= 1000
                        ? (target / 1000).toFixed(0) + 'K'
                        : target;
                }

                requestAnimationFrame(tick);
            }

            ScrollTrigger.create({
                trigger: '#exp-stats',
                start: 'top 80%',
                once: true,
                onEnter: () => {
                    document.querySelectorAll('.exp-stat-num[data-count]').forEach(animateCounter);
                }
            });

            /* ── Testimonial title & sub ── */
            gsap.to(['#exp-test-title', '#exp-test-sub'], {
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: 'power4.out',
                stagger: 0.12,
                scrollTrigger: { trigger: '#exp-test-title', start: 'top 85%' }
            });

            /* ── Cards stagger with blur ── */
            gsap.fromTo(
                ['#exp-card-1', '#exp-card-2', '#exp-card-3'],
                { opacity: 0, y: 48, filter: 'blur(8px)' },
                {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    duration: 0.9,
                    ease: 'power4.out',
                    stagger: 0.15,
                    scrollTrigger: { trigger: '.exp-cards', start: 'top 80%' }
                }
            );

            /* ── Card mouse-follow highlight ── */
            document.querySelectorAll('.exp-card').forEach(card => {
                card.addEventListener('mousemove', e => {
                    const rect = card.getBoundingClientRect();
                    card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
                    card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
                });
            });

            /* ── Marquee velocity on scroll (speed up/slow down) ── */
            const track = document.getElementById('exp-marquee-track');
            let marqueeSpeed = 35;
            ScrollTrigger.create({
                trigger: expSection,
                start: 'top bottom',
                end: 'bottom top',
                onUpdate: self => {
                    const vel = Math.abs(self.getVelocity());
                    const speedUp = Math.max(4, 35 - vel * 0.018);
                    track.style.animationDuration = speedUp + 's';
                }
            });

        })();

/* ══════════════════════════════════════
   FOURTH FOLD — GSAP ANIMATIONS
══════════════════════════════════════ */
        (function () {
            const cinemaSection = document.getElementById('comprar');
            if (!cinemaSection) return;

            /* ── Main card entrance ── */
            gsap.to('#cinema-card-wrap', {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 1.6,
                ease: 'power4.out',
                scrollTrigger: { trigger: cinemaSection, start: 'top 72%' }
            });

            /* ── Eyebrow ── */
            gsap.to('#cinema-eyebrow', {
                opacity: 1,
                y: 0,
                duration: 0.9,
                ease: 'power4.out',
                scrollTrigger: { trigger: cinemaSection, start: 'top 68%' }
            });

            /* ── Headline stagger ── */
            gsap.to(['#chl-1', '#chl-2', '#chl-3'], {
                opacity: 1,
                y: 0,
                duration: 1.2,
                ease: 'power4.out',
                stagger: 0.12,
                scrollTrigger: { trigger: cinemaSection, start: 'top 66%' }
            });

            /* ── Divider rule draws in ── */
            gsap.to('#cinema-rule', {
                scaleX: 1,
                duration: 1.2,
                ease: 'power3.out',
                scrollTrigger: { trigger: cinemaSection, start: 'top 64%' }
            });

            /* ── Spec lines stagger from left ── */
            gsap.to(['#cspec-1', '#cspec-2', '#cspec-3', '#cspec-4'], {
                opacity: 1,
                x: 0,
                duration: 0.75,
                ease: 'power4.out',
                stagger: 0.1,
                scrollTrigger: { trigger: '#cinema-card', start: 'top 60%' }
            });

            /* ── CTA row ── */
            gsap.to('#cinema-cta-row', {
                opacity: 1,
                y: 0,
                duration: 0.9,
                ease: 'power4.out',
                scrollTrigger: { trigger: '#cinema-card', start: 'top 55%' }
            });

            /* ── Bottom stat cards stagger ── */
            gsap.to('#cinema-stat-cards', {
                opacity: 1,
                y: 0,
                duration: 1,
                ease: 'power4.out',
                scrollTrigger: { trigger: cinemaSection, start: 'top 60%' }
            });

            /* ── Video slow Ken Burns on scroll ── */
            gsap.to('#cinema-video', {
                scale: 1.12,
                ease: 'none',
                scrollTrigger: {
                    trigger: cinemaSection,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 2
                }
            });

            /* ── Orb parallax (opposite direction = depth) ── */
            gsap.to('#cinema-orb', {
                y: -60,
                ease: 'none',
                scrollTrigger: {
                    trigger: cinemaSection,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 3
                }
            });

        })();