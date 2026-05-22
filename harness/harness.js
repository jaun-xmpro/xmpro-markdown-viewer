/*
 * Harness controller — drives the metablock iframe via postMessage and
 * displays all traffic in the log drawer.
 *
 * Two-way protocol:
 *   harness  ──>  iframe   "markdown:set-content" / "markdown:update-config" / etc.
 *   iframe   ──>  harness  "markdown:loaded" / "markdown:link-clicked" / etc.
 *
 * The iframe announces readiness with "markdown:ready" — until that fires,
 * the harness queues outbound messages.
 */

(function () {
    'use strict';

    const examples = [
        { id: '01-welcome',       title: 'Welcome',           sub: 'Core typography & inline formatting' },
        { id: '02-tech-docs',     title: 'Technical docs',    sub: 'TOC, callouts, multi-lang code' },
        { id: '03-math',          title: 'Math & equations',  sub: 'KaTeX showcase (needs enable_math)' },
        { id: '04-diagrams',      title: 'Diagrams',          sub: 'Mermaid showcase (needs enable_diagrams)' },
        { id: '05-article',       title: 'Long-form article', sub: 'Typography stress test, footnotes' },
        { id: '06-live-updates',  title: 'Live updates',      sub: 'Streaming via onDataChanged' },
        { id: '07-readme',        title: 'README pastiche',   sub: 'OSS README with badges' },
        { id: '08-kitchen-sink',  title: 'Kitchen sink',      sub: 'Every supported feature' }
    ];

    const state = {
        currentExample: null,
        currentExampleId: null,
        iframeReady: false,
        outboundQueue: [],
        config: {
            theme: 'auto',
            background: 'solid',
            background_image_url: '',
            background_overlay: 0.55,
            accent_color: '#009fde',
            font_family: 'system',
            font_family_url: '',
            font_family_name: '',
            font_size: 1.0,
            content_width: 'medium',
            heading_style: 'classic',
            animation_level: 'subtle',
            toc_position: 'right',
            enable_toc: false,
            enable_math: false,
            enable_diagrams: false,
            enable_anchors: true,
            enable_progress_bar: false,
            enable_image_zoom: true,
            enable_search: true,
            enable_print: true,
            enable_read_aloud: true,
            enable_reading_stats: true,
            code_copy_button: true,
            code_line_numbers: false,
            code_wrap: false,
            frontmatter_display: false,
            debug: true,
            metablock_id: 'harness-' + Math.random().toString(36).slice(2, 8)
        },
        streaming: { active: false, timer: null, content: '', parts: [], index: 0 }
    };

    const iframe = document.getElementById('metablock-frame');
    const logBody = document.getElementById('log-body');
    const logCount = document.getElementById('log-count');
    let logEntryCount = 0;

    function renderExampleList() {
        const ul = document.getElementById('example-list');
        ul.innerHTML = examples.map(ex => `
            <li>
                <button data-id="${ex.id}">
                    <span class="h-ex-title">${ex.title}</span>
                    <span class="h-ex-sub">${ex.sub}</span>
                </button>
            </li>
        `).join('');
        ul.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => loadExample(btn.dataset.id));
        });
    }

    async function loadExample(id) {
        const ex = examples.find(e => e.id === id);
        if (!ex) return;
        state.currentExampleId = id;
        document.querySelectorAll('#example-list button').forEach(b =>
            b.classList.toggle('active', b.dataset.id === id));

        try {
            const res = await fetch(`examples/${id}.md`, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            state.currentExample = await res.text();
            stopStreaming();
            updateStreamButton();
            send('markdown:set-content', { content: state.currentExample });
        } catch (err) {
            console.error('Failed to load example', err);
            send('markdown:set-content', {
                content: `# Couldn't load example\n\n\`${id}.md\` — ${err.message}`
            });
        }
    }

    function setupControls() {
        // Theme
        document.getElementById('ctrl-theme').addEventListener('change', e => {
            state.config.theme = e.target.value;
            send('markdown:set-theme', { theme: e.target.value });
        });

        document.getElementById('ctrl-bg').addEventListener('change', e => {
            const bg = e.target.value;
            state.config.background = bg;
            const payload = { background: bg };
            if (bg === 'image') {
                payload.background_image_url = 'https://placehold.co/1600x900/0a3445/e6f4fa/png?text=XMPro';
                payload.background_overlay = 0.55;
                state.config.background_image_url = payload.background_image_url;
            } else {
                state.config.background_image_url = '';
            }
            send('markdown:set-background', payload);
        });

        // Font family
        document.getElementById('ctrl-font').addEventListener('change', e => {
            state.config.font_family = e.target.value;
            send('markdown:update-config', { font_family: e.target.value });
        });

        // Font size
        const fsize = document.getElementById('ctrl-fsize');
        const fsizeDisplay = document.getElementById('fsize-display');
        fsize.addEventListener('input', e => {
            const v = parseFloat(e.target.value);
            state.config.font_size = v;
            fsizeDisplay.textContent = v.toFixed(2);
            send('markdown:update-config', { font_size: v });
        });

        // Width
        document.getElementById('ctrl-width').addEventListener('change', e => {
            state.config.content_width = e.target.value;
            send('markdown:update-config', { content_width: e.target.value });
        });

        // Heading
        document.getElementById('ctrl-heading').addEventListener('change', e => {
            state.config.heading_style = e.target.value;
            send('markdown:update-config', { heading_style: e.target.value });
        });

        // Accent color
        document.getElementById('ctrl-accent').addEventListener('input', e => {
            state.config.accent_color = e.target.value;
            send('markdown:update-config', { accent_color: e.target.value });
        });

        // TOC position
        document.getElementById('ctrl-toc-pos').addEventListener('change', e => {
            state.config.toc_position = e.target.value;
            send('markdown:update-config', { toc_position: e.target.value, enable_toc: state.config.enable_toc });
        });

        // Animation
        document.getElementById('ctrl-anim').addEventListener('change', e => {
            state.config.animation_level = e.target.value;
            send('markdown:update-config', { animation_level: e.target.value });
        });

        // Feature toggles
        document.querySelectorAll('#toggle-list input[data-cfg]').forEach(input => {
            input.addEventListener('change', () => {
                const key = input.dataset.cfg;
                state.config[key] = input.checked;
                send('markdown:update-config', { [key]: input.checked });
            });
        });

        // Action buttons
        document.getElementById('btn-reload').addEventListener('click', () => {
            state.iframeReady = false;
            iframe.src = iframe.src;
        });

        document.getElementById('btn-toggle-log').addEventListener('click', toggleLog);
        document.getElementById('btn-close-log').addEventListener('click', toggleLog);

        document.getElementById('btn-stream').addEventListener('click', () => {
            if (state.streaming.active) stopStreaming();
            else startStreaming();
        });

        document.getElementById('btn-postmsg').addEventListener('click', () => {
            send('markdown:scroll-to', { percent: 0 });
        });

        document.getElementById('btn-clear-log').addEventListener('click', clearLog);

        const fontUrlInput = document.getElementById('ctrl-font-url');
        const fontNameInput = document.getElementById('ctrl-font-name');
        document.getElementById('btn-font-apply').addEventListener('click', () => {
            const url = fontUrlInput.value.trim();
            const name = fontNameInput.value.trim();
            if (!url || !name) return;
            state.config.font_family_url = url;
            state.config.font_family_name = name;
            send('markdown:update-config', { font_family_url: url, font_family_name: name });
        });
        document.getElementById('btn-font-clear').addEventListener('click', () => {
            fontUrlInput.value = '';
            fontNameInput.value = '';
            state.config.font_family_url = '';
            state.config.font_family_name = '';
            send('markdown:update-config', { font_family_url: '', font_family_name: '' });
        });
    }

    function updateStreamButton() {
        const btn = document.getElementById('btn-stream');
        const isLive = state.currentExampleId === '06-live-updates';
        btn.disabled = !isLive;
        btn.textContent = state.streaming.active ? '■ Stop streaming' : '▶ Start streaming';
    }

    function startStreaming() {
        if (!state.currentExample) return;

        // Build a multi-paragraph stream that grows over time
        const baseParas = [
            "## Agent reasoning trace\n\nStarting analysis of incoming dataset.",
            "**Step 1:** Loading historical telemetry for the past 24 hours. Found 14,329 records across 27 assets.",
            "**Step 2:** Identifying outliers. Two assets exceeded their nominal temperature ranges: `pump-014` (peak 94.3°C) and `pump-022` (peak 91.8°C).",
            "**Step 3:** Cross-referencing maintenance logs. Both assets had scheduled maintenance deferred in the previous cycle.",
            "**Step 4:** Computing risk scores.\n\n| Asset | Temp peak | Risk | Confidence |\n|-------|-----------|------|------------|\n| pump-014 | 94.3°C | High | 87% |\n| pump-022 | 91.8°C | Medium | 71% |",
            "**Step 5:** Drafting recommendation.\n\n> [!IMPORTANT]\n> `pump-014` warrants immediate inspection. The combination of recent thermal excursions and deferred maintenance produces a 9-day failure probability of 34%.",
            "**Step 6:** Verifying against safety thresholds. Recommendation is consistent with policy thresholds set in maintenance schema v3.\n\n---\n\nAnalysis complete in 1.42s."
        ];

        const initial = state.currentExample;
        state.streaming = {
            active: true,
            timer: null,
            content: initial,
            parts: baseParas,
            index: 0
        };
        updateStreamButton();
        tickStream();
    }

    function tickStream() {
        const s = state.streaming;
        if (!s.active) return;
        if (s.index >= s.parts.length) {
            stopStreaming();
            return;
        }
        s.content = s.content + '\n\n' + s.parts[s.index];
        s.index++;
        send('markdown:set-content', { content: s.content });
        s.timer = setTimeout(tickStream, 1100);
    }

    function stopStreaming() {
        if (state.streaming.timer) clearTimeout(state.streaming.timer);
        state.streaming.active = false;
        state.streaming.timer = null;
        updateStreamButton();
    }

    function send(type, data) {
        const msg = {
            source: 'xmpro-harness',
            type,
            data: data || {},
            timestamp: new Date().toISOString(),
            metablockId: state.config.metablock_id
        };

        if (!state.iframeReady) {
            state.outboundQueue.push(msg);
            return;
        }
        iframe.contentWindow.postMessage(msg, '*');
        logEntry('out', type, data);
    }

    function flushQueue() {
        const q = state.outboundQueue.slice();
        state.outboundQueue.length = 0;
        for (const msg of q) {
            iframe.contentWindow.postMessage(msg, '*');
            logEntry('out', msg.type, msg.data);
        }
    }

    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.source !== 'xmpro-metablock') return;

        if (msg.type === 'markdown:ready') {
            if (state.iframeReady) return; // ignore duplicate ready announcements
            completeHandshake();
        }

        logEntry('in', msg.type, msg.data);
    });

    // Strip metablock_id so we don't overwrite the iframe's own ID.
    function completeHandshake() {
        state.iframeReady = true;
        const { metablock_id, ...cfgForIframe } = state.config;
        rawSend('markdown:update-config', cfgForIframe);
        flushQueue();
        if (!state.currentExampleId) loadExample('01-welcome');
    }

    function rawSend(type, data) {
        iframe.contentWindow.postMessage({
            source: 'xmpro-harness',
            type,
            data: data || {},
            timestamp: new Date().toISOString(),
            metablockId: state.config.metablock_id
        }, '*');
        logEntry('out', type, data);
    }

    // When the iframe finishes loading, send a hello so it announces ready
    // even if our listener attached after the iframe's initial broadcast.
    iframe.addEventListener('load', () => {
        if (state.iframeReady) return;
        try { rawSend('harness:hello', {}); }
        catch { /* iframe may not yet expose contentWindow safely */ }
    });

    function logEntry(dir, type, data) {
        const empty = logBody.querySelector('.h-log-empty');
        if (empty) empty.remove();

        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour12: false }) + '.' +
            String(now.getMilliseconds()).padStart(3, '0');
        const json = data ? JSON.stringify(data) : '';
        const preview = json.length > 80 ? json.slice(0, 77) + '...' : json;

        const entry = document.createElement('div');
        entry.className = 'h-log-entry';
        entry.innerHTML = `
            <span class="h-log-time">${time}</span>
            <span class="h-log-dir ${dir}">${dir}</span>
            <span class="h-log-type">${escapeHtml(type)}</span>
            <span class="h-log-data" title="Click to expand">${escapeHtml(preview)}</span>
        `;
        const dataEl = entry.querySelector('.h-log-data');
        dataEl.addEventListener('click', () => {
            dataEl.classList.toggle('expanded');
            dataEl.textContent = dataEl.classList.contains('expanded')
                ? JSON.stringify(data, null, 2)
                : preview;
        });

        logBody.appendChild(entry);
        logBody.scrollTop = logBody.scrollHeight;

        logEntryCount++;
        logCount.textContent = `${logEntryCount} message${logEntryCount === 1 ? '' : 's'}`;
    }

    function clearLog() {
        logBody.innerHTML = '<div class="h-log-empty">Log cleared.</div>';
        logEntryCount = 0;
        logCount.textContent = '0 messages';
    }

    function toggleLog() {
        document.getElementById('log-drawer').classList.toggle('open');
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    document.addEventListener('DOMContentLoaded', () => {
        renderExampleList();
        setupControls();

        // Fallback: if the iframe never announces ready (e.g., metablock has no
        // auto-init path), force the handshake after 1.5s so the UI still works.
        setTimeout(() => {
            if (state.iframeReady) return;
            console.warn('[harness] iframe did not announce ready; pushing config anyway');
            completeHandshake();
        }, 1500);
    });

})();
