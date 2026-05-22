/**
 * XMPro Markdown Viewer Metablock
 *
 * EXPECTED DATA FORMAT
 *
 * Value Mapping (configuration object — every key optional):
 * {
 *   // --- Content ---
 *   content: "# Hello\nMarkdown string",        // inline
 *   markdown_url: "https://example.com/doc.md", // fetched (http/https only)
 *
 *   // --- Appearance ---
 *   theme: "auto" | "light" | "dark" | "xmpro-light" | "xmpro-dark",
 *   background: "solid" | "gradient" | "xmpro" | "dots" | "grid"
 *               | "paper" | "glass" | "mesh" | "aurora" | "image" | "none",
 *   background_image_url: "https://...",
 *   background_overlay: 0..1,
 *   accent_color: "#009fde",
 *
 *   // --- Typography ---
 *   font_family: "system" | "sans" | "serif" | "mono" | "dyslexic",
 *   font_size: 0.8..1.5,
 *   line_height: "tight" | "normal" | "relaxed",
 *   content_width: "narrow" | "medium" | "wide" | "full",
 *   heading_style: "classic" | "modern" | "underlined" | "numbered",
 *
 *   // --- Code blocks ---
 *   code_line_numbers: bool,
 *   code_copy_button: bool,
 *   code_wrap: bool,
 *
 *   // --- Feature toggles ---
 *   enable_toc: bool,         toc_position: "left"|"right"|"top"|"floating",
 *   enable_math: bool,        enable_diagrams: bool,
 *   enable_anchors: bool,     enable_progress_bar: bool,
 *   enable_image_zoom: bool,  enable_search: bool,
 *
 *   // --- Behaviour ---
 *   animation_level: "none" | "subtle" | "lively",
 *   links_target: "_blank" | "_self" | "_top",
 *   auto_scroll_to_anchor: bool,
 *   frontmatter_display: bool,
 *
 *   // --- Debug ---
 *   debug: bool, log_level: "trace"|"debug"|"info"|"warn"|"error"|"none",
 *   metablock_id: "unique-id"
 * }
 *
 * Data Source (live content; one or more records, first match wins):
 *   [{ markdown: "..." }] | [{ content: "..." }] | [{ text: "..." }]
 *
 * postMessage events emitted to parent:
 *   markdown:loaded            { wordCount, headings, hasMath, hasDiagrams }
 *   markdown:link-clicked      { href, text, internal }
 *   markdown:heading-clicked   { id, text, level }
 *   markdown:scroll-progress   { percent }
 *
 * postMessage events accepted from parent / siblings:
 *   markdown:set-content       { content }
 *   markdown:set-theme         { theme }
 *   markdown:set-background    { background, background_image_url?, background_overlay? }
 *   markdown:update-config     { ...partial config }
 *   markdown:scroll-to         { anchor } | { percent }
 */

(function () {
    'use strict';

    const DEFAULTS = {
        theme: 'auto',
        background: 'solid',
        background_image_url: '',
        background_overlay: 0.55,
        accent_color: '',
        font_family: 'system',
        font_family_url: '',
        font_family_name: '',
        font_size: 1.0,
        line_height: 'normal',
        content_width: 'medium',
        heading_style: 'classic',
        code_line_numbers: false,
        code_copy_button: true,
        code_wrap: false,
        enable_toc: false,
        toc_position: 'right',
        enable_math: false,
        enable_diagrams: false,
        enable_anchors: true,
        enable_progress_bar: false,
        enable_image_zoom: true,
        enable_search: true,
        enable_print: true,
        enable_read_aloud: true,
        enable_reading_stats: true,
        enable_settings: true,
        persist_preferences: false,
        tts_rate: 1.0,
        tts_voice: '',
        animation_level: 'subtle',
        links_target: '_blank',
        auto_scroll_to_anchor: true,
        frontmatter_display: false,
        content: '',
        markdown_url: '',
        debug: false,
        log_level: 'warn',
        metablock_id: 'md-' + Math.random().toString(36).slice(2, 9)
    };

    let config = Object.assign({}, DEFAULTS);
    let hasInitialized = false;
    let dataSourceContent = null;
    let lastRenderedHash = null;
    let pendingRender = null;
    let markedConfigured = false;
    let katexLoaded = false;
    let mermaidLoaded = false;
    let scrollSpyObserver = null;
    let searchState = { matches: [], current: -1, query: '' };
    const tts = { state: 'idle', queue: [], index: 0 };
    let lastTtsUiState = null;
    let lastWordCount = 0;
    let currentCustomFontLink = null;
    const els = {};

    const STORAGE_KEY = 'xmpro-md-viewer-prefs';
    // Keys a USER is allowed to override via the settings popover. Others
    // (background, accent_color, heading_style, animation_level, feature
    // toggles) reflect the document author's intent and are not persisted.
    const USER_PREF_KEYS = ['theme', 'font_size', 'content_width', 'line_height', 'code_wrap', 'tts_voice', 'tts_rate'];
    let userPrefs = {};
    let docConfig = {};
    let lastFetchedUrl = null;
    let lastFetchedContent = null;
    let darkMQ = null;
    const slugCounts = new Map();
    const loadedFontUrls = new Set();

    const FONT_PRESETS = {
        'inter':          { url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
        'lora':           { url: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap' },
        'source-serif':   { url: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;500;600;700&display=swap' },
        'jetbrains-mono': { url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap' },
        'ibm-plex-sans':  { url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap' }
    };

    const Logger = {
        levels: { trace: 0, debug: 1, info: 2, warn: 3, error: 4, none: 5 },
        current: 3,
        init(level) { this.current = this.levels[level] ?? 3; },
        trace(...a) { if (this.current <= 0) console.log('[MD]', ...a); },
        debug(...a) { if (this.current <= 1) console.log('[MD]', ...a); },
        info(...a)  { if (this.current <= 2) console.log('[MD]', ...a); },
        warn(...a)  { if (this.current <= 3) console.warn('[MD]', ...a); },
        error(...a) { if (this.current <= 4) console.error('[MD]', ...a); }
    };

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function escapeCssUrl(s) { return String(s).replace(/["\\]/g, '\\$&'); }

    function simpleHash(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return h;
    }

    function makeSlug(text) {
        const base = String(text).replace(/<[^>]+>/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .slice(0, 80) || 'section';
        const n = slugCounts.get(base) || 0;
        slugCounts.set(base, n + 1);
        return n === 0 ? base : `${base}-${n}`;
    }

    function validateUrl(url) {
        try {
            const u = new URL(url, document.location.href);
            return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null;
        } catch { return null; }
    }

    function normalizeConfig(input) {
        const cfg = Object.assign({}, input);
        // metablock_id is set once at init; partial config updates must not
        // overwrite it, or the iframe would treat its own messages as self-echo.
        delete cfg.metablock_id;
        const bools = [
            'code_line_numbers', 'code_copy_button', 'code_wrap',
            'enable_toc', 'enable_math', 'enable_diagrams', 'enable_anchors',
            'enable_progress_bar', 'enable_image_zoom', 'enable_search',
            'enable_print', 'enable_read_aloud', 'enable_reading_stats',
            'enable_settings', 'persist_preferences',
            'auto_scroll_to_anchor', 'frontmatter_display', 'debug'
        ];
        for (const k of bools) {
            if (k in cfg) cfg[k] = cfg[k] === true || cfg[k] === 'true' || cfg[k] === 1;
        }
        if ('font_size' in cfg) cfg.font_size = parseFloat(cfg.font_size) || 1;
        if ('tts_rate' in cfg) cfg.tts_rate = Math.max(0.5, Math.min(2, parseFloat(cfg.tts_rate) || 1));
        if ('background_overlay' in cfg) {
            const n = parseFloat(cfg.background_overlay);
            cfg.background_overlay = isNaN(n) ? 0.55 : Math.max(0, Math.min(1, n));
        }
        return cfg;
    }

    function headingMeta(el) {
        return {
            id: el.id,
            text: (el.textContent || '').replace(/^#/, '').trim(),
            level: parseInt(el.tagName.slice(1), 10)
        };
    }

    function applyConfig(partial) {
        const prevUrl = config.markdown_url;
        config = Object.assign({}, config, partial);
        if (config.markdown_url !== prevUrl) {
            lastFetchedUrl = null;
            lastFetchedContent = null;
        }
        Logger.init(config.log_level || (config.debug ? 'debug' : 'warn'));

        const root = document.getElementById('viewer-root');
        if (!root) return;

        root.setAttribute('data-theme', config.theme || 'auto');
        root.setAttribute('data-bg', config.background || 'solid');
        applyFont(root);
        root.setAttribute('data-leading', config.line_height || 'normal');
        root.setAttribute('data-content-width', config.content_width || 'medium');
        root.setAttribute('data-heading', config.heading_style || 'classic');
        root.setAttribute('data-animation', config.animation_level || 'subtle');
        root.setAttribute('data-image-zoom', String(!!config.enable_image_zoom));
        root.setAttribute('data-code-wrap', String(!!config.code_wrap));
        root.setAttribute('data-line-numbers', String(!!config.code_line_numbers));

        if (config.background === 'image' && config.background_image_url) {
            root.style.setProperty('--bg-image-url', `url("${escapeCssUrl(config.background_image_url)}")`);
            root.style.setProperty('--bg-overlay', String(config.background_overlay ?? 0.55));
        } else {
            root.style.removeProperty('--bg-image-url');
            root.style.removeProperty('--bg-overlay');
        }

        if (config.accent_color) root.style.setProperty('--accent', config.accent_color);
        else root.style.removeProperty('--accent');

        root.style.setProperty('--font-scale', String(config.font_size || 1));

        if (els.progressBar) els.progressBar.hidden = !config.enable_progress_bar;
        if (els.printBtn) els.printBtn.hidden = !config.enable_print;
        if (els.readBtn) els.readBtn.hidden = !config.enable_read_aloud || !('speechSynthesis' in window);
        if (els.stopBtn && (!config.enable_read_aloud || tts.state === 'idle')) els.stopBtn.hidden = true;
        if (els.settingsBtn) els.settingsBtn.hidden = !config.enable_settings;
        if (!config.enable_read_aloud && tts.state !== 'idle') stopReading();
    }

    function loadPrefs() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) { userPrefs = {}; return; }
            const parsed = JSON.parse(raw);
            // Only accept keys we recognise — silently ignore stale or
            // attacker-controlled keys.
            userPrefs = {};
            for (const k of USER_PREF_KEYS) {
                if (k in parsed) userPrefs[k] = parsed[k];
            }
        } catch { userPrefs = {}; }
    }

    function savePrefs() {
        if (!config.persist_preferences) return;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(userPrefs)); }
        catch (e) { Logger.warn('Failed to save prefs', e); }
    }

    function setDocConfig(partial) {
        Object.assign(docConfig, partial);
        applyMerged();
    }

    let prefsLoaded = false;
    function applyMerged() {
        const merged = { ...docConfig };
        if (docConfig.persist_preferences) {
            if (!prefsLoaded) { loadPrefs(); prefsLoaded = true; }
            for (const k of USER_PREF_KEYS) if (k in userPrefs) merged[k] = userPrefs[k];
        }
        applyConfig(merged);
    }

    function applyUserPref(key, value) {
        if (value === undefined || value === '' || value === null) delete userPrefs[key];
        else userPrefs[key] = value;
        savePrefs();
        applyMerged();
    }

    function resetUserPrefs() {
        userPrefs = {};
        savePrefs();
        applyMerged();
        if (config.enable_settings) syncSettingsPopover();
    }

    function applyFont(root) {
        const hasUrl = !!config.font_family_url;
        const hasName = !!config.font_family_name;
        if (hasUrl !== hasName) {
            Logger.warn('Custom font requires both font_family_url and font_family_name; ignoring partial config');
        }

        if (hasUrl && hasName) {
            const url = validateUrl(config.font_family_url);
            if (url) {
                loadFontStylesheet(url, { isCustom: true });
                root.setAttribute('data-font', 'custom');
                root.style.setProperty('--font-family-custom',
                    `${config.font_family_name}, ${getSystemFontFallback(config.font_family)}`);
                return;
            }
            Logger.warn('Invalid font_family_url (must be http/https):', config.font_family_url);
        }
        clearCustomFontLink();
        root.style.removeProperty('--font-family-custom');

        const family = config.font_family || 'system';
        const preset = FONT_PRESETS[family];
        if (preset) loadFontStylesheet(preset.url);
        root.setAttribute('data-font', family);
    }

    function getSystemFontFallback(familyHint) {
        if (familyHint === 'serif' || familyHint === 'lora' || familyHint === 'source-serif') {
            return "'Iowan Old Style', Georgia, serif";
        }
        if (familyHint === 'mono' || familyHint === 'jetbrains-mono') {
            return "'SF Mono', Menlo, Consolas, monospace";
        }
        return "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    }

    function loadFontStylesheet(url, { isCustom = false } = {}) {
        if (loadedFontUrls.has(url)) return;
        if (isCustom) clearCustomFontLink();
        loadedFontUrls.add(url);
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.crossOrigin = 'anonymous';
        link.dataset.fontPreset = String(!isCustom);
        link.onerror = () => {
            Logger.warn('Font stylesheet failed to load:', url);
            loadedFontUrls.delete(url);
            if (isCustom && currentCustomFontLink === link) currentCustomFontLink = null;
        };
        document.head.appendChild(link);
        if (isCustom) currentCustomFontLink = link;
        Logger.debug('Loaded font stylesheet:', url);
    }

    function clearCustomFontLink() {
        if (!currentCustomFontLink) return;
        loadedFontUrls.delete(currentCustomFontLink.href);
        currentCustomFontLink.remove();
        currentCustomFontLink = null;
    }

    function onValueMappingLoaded(data) {
        Logger.debug('onValueMappingLoaded', data);
        docConfig = normalizeConfig(data || {});
        applyMerged();

        if (!hasInitialized) {
            hasInitialized = true;
            initOnce();
        }
        if (config.enable_settings) syncSettingsPopover();
        scheduleRender();
    }

    function onDataLoaded(data) {
        Logger.debug('onDataLoaded', { len: Array.isArray(data) ? data.length : 0 });
        dataSourceContent = extractMarkdownFromDataSource(data);
        if (!hasInitialized) {
            hasInitialized = true;
            applyConfig({});
            initOnce();
        }
        scheduleRender();
    }

    function onDataChanged(data, changes) {
        Logger.debug('onDataChanged', { dataLen: data?.length, changes: changes?.length });
        dataSourceContent = extractMarkdownFromDataSource(data);
        scheduleRender();
    }

    function extractMarkdownFromDataSource(data) {
        if (!Array.isArray(data) || data.length === 0) return null;
        const fields = ['markdown', 'content', 'text', 'body'];

        if (data.length === 1) {
            const r = data[0];
            for (const f of fields) if (typeof r?.[f] === 'string' && r[f]) return r[f];
            return null;
        }
        const parts = data.map(r => {
            for (const f of fields) if (typeof r?.[f] === 'string' && r[f]) return r[f];
            return null;
        }).filter(Boolean);
        return parts.length ? parts.join('\n\n---\n\n') : null;
    }

    async function resolveContent() {
        if (dataSourceContent) return { source: 'data-source', content: dataSourceContent };
        if (config.content) return { source: 'value-mapping', content: config.content };
        if (config.markdown_url) {
            const url = validateUrl(config.markdown_url);
            if (!url) return { source: 'error', error: 'Invalid markdown_url (only http/https allowed)' };
            if (url === lastFetchedUrl && lastFetchedContent !== null) {
                return { source: 'url', content: lastFetchedContent };
            }
            try {
                const res = await fetch(url, { credentials: 'omit' });
                if (!res.ok) return { source: 'error', error: `HTTP ${res.status} fetching ${url}` };
                const text = await res.text();
                lastFetchedUrl = url;
                lastFetchedContent = text;
                return { source: 'url', content: text };
            } catch (e) {
                return { source: 'error', error: e.message || 'Fetch failed' };
            }
        }
        return { source: 'empty', content: '' };
    }

    function configureMarked() {
        if (markedConfigured) return;
        markedConfigured = true;

        marked.use({
            gfm: true,
            breaks: false,
            renderer: {
                heading(text, level) {
                    const slug = makeSlug(text);
                    return `<h${level} id="${slug}">${text}</h${level}>\n`;
                },
                code(code, infostring) {
                    const lang = (infostring || '').trim().split(/\s+/)[0];
                    if (lang === 'mermaid') {
                        return `<div class="mermaid-pending" data-source="${escapeHtml(code)}"></div>\n`;
                    }
                    const id = 'cb-' + Math.random().toString(36).slice(2, 9);
                    const langClass = lang ? `language-${lang}` : '';
                    const header = config.code_copy_button
                        ? `<div class="code-header"><span class="code-lang">${escapeHtml(lang || 'text')}</span><button class="code-copy" data-target="${id}" aria-label="Copy code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span></button></div>`
                        : '';
                    return `<pre class="${langClass}" data-cb="${id}">${header}<code class="${langClass}">${escapeHtml(code)}</code></pre>\n`;
                }
            },
            extensions: [calloutExtension(), mathInlineExtension(), mathBlockExtension()]
        });
    }

    function calloutExtension() {
        return {
            name: 'callout',
            level: 'block',
            start(src) {
                const m = src.match(/^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER)\]/im);
                return m ? src.indexOf(m[0]) : -1;
            },
            tokenizer(src) {
                const re = /^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER)\][^\n]*\n((?:>[^\n]*(?:\n|$))*)/i;
                const m = re.exec(src);
                if (m) {
                    const body = m[2].split('\n').map(l => l.replace(/^>\s?/, '')).join('\n').trim();
                    return {
                        type: 'callout',
                        raw: m[0],
                        calloutType: m[1].toLowerCase(),
                        tokens: this.lexer.blockTokens(body)
                    };
                }
            },
            renderer(token) {
                const body = this.parser.parse(token.tokens);
                const label = CALLOUT_LABELS[token.calloutType] || token.calloutType;
                const icon = CALLOUT_ICONS[token.calloutType] || '';
                return `<div class="callout" data-type="${token.calloutType}">
<div class="callout-title">${icon}<span>${label}</span></div>
${body}</div>\n`;
            }
        };
    }

    const SVG_ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="callout-icon"';
    const svgIcon = (inner) => `<svg ${SVG_ICON_ATTRS}>${inner}</svg>`;

    const CALLOUT_LABELS = {
        note: 'Note', tip: 'Tip', important: 'Important',
        warning: 'Warning', caution: 'Caution', danger: 'Danger'
    };
    const CALLOUT_ICONS = {
        note:      svgIcon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
        tip:       svgIcon('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c1 .8 1.5 2 1.5 3.3h5c0-1.3.5-2.5 1.5-3.3A7 7 0 0 0 12 2z"/>'),
        important: svgIcon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
        warning:   svgIcon('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
        caution:   svgIcon('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'),
        danger:    svgIcon('<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>')
    };

    function mathInlineExtension() {
        return {
            name: 'mathInline',
            level: 'inline',
            start(src) {
                if (!config.enable_math) return -1;
                const i = src.indexOf('$');
                return i < 0 ? -1 : i;
            },
            tokenizer(src) {
                if (!config.enable_math) return;
                const m = /^\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/.exec(src);
                if (m) return { type: 'mathInline', raw: m[0], math: m[1] };
            },
            renderer(token) {
                return `<span class="math-inline-pending" data-source="${escapeHtml(token.math)}"></span>`;
            }
        };
    }

    function mathBlockExtension() {
        return {
            name: 'mathBlock',
            level: 'block',
            start(src) {
                if (!config.enable_math) return -1;
                // Only signal a possible match when "$$" is at the start of a line
                // (i.e., preceded by either start-of-src or a newline). This
                // prevents the tokenizer from being invoked for inline `$$…$$`
                // text appearing inside prose (e.g., a backticked literal).
                const m = src.match(/(?:^|\n)\$\$\n/);
                return m ? m.index + (m[0].startsWith('\n') ? 1 : 0) : -1;
            },
            tokenizer(src) {
                if (!config.enable_math) return;
                // Strict: `$$` must own its line, optional close on its own line.
                const m = /^\$\$\n([\s\S]+?)\n\$\$(?=\n|$)/.exec(src);
                if (m) return { type: 'mathBlock', raw: m[0], math: m[1] };
            },
            renderer(token) {
                return `<div class="math-block-pending" data-source="${escapeHtml(token.math)}"></div>\n`;
            }
        };
    }

    function extractFootnotes(text) {
        // Cheap pre-scan: most docs don't have footnotes, skip all line work.
        if (!text.includes('[^')) return { body: text, defs: new Map(), order: [] };

        const defs = new Map();
        const order = [];
        const lines = text.split('\n');
        const out = [];
        let inFence = false;
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            if (/^(```|~~~)/.test(line)) { inFence = !inFence; out.push(line); i++; continue; }
            if (inFence) { out.push(line); i++; continue; }

            const defMatch = /^\[\^([^\]]+)\]:\s?(.*)$/.exec(line);
            if (defMatch) {
                const id = defMatch[1];
                const content = [defMatch[2]];
                i++;
                while (i < lines.length && lines[i].trim() !== '' && !/^\[\^/.test(lines[i]) && !/^(```|~~~)/.test(lines[i])) {
                    content.push(lines[i]);
                    i++;
                }
                defs.set(id, content.join('\n').trim());
                continue;
            }
            out.push(line);
            i++;
        }

        if (defs.size === 0) return { body: text, defs, order };

        inFence = false;
        const processed = out.map(line => {
            if (/^(```|~~~)/.test(line)) { inFence = !inFence; return line; }
            if (inFence) return line;
            return line.replace(/\[\^([^\]]+)\]/g, (m, id) => {
                if (!defs.has(id)) return m;
                let idx = order.indexOf(id);
                if (idx === -1) { order.push(id); idx = order.length - 1; }
                return `<sup class="footnote-ref" id="fnref-${id}"><a href="#fn-${id}">${idx + 1}</a></sup>`;
            });
        }).join('\n');

        return { body: processed, defs, order };
    }

    function renderFootnotesSection(defs, order) {
        if (order.length === 0) return '';
        const items = order.map(id => {
            const inline = marked.parseInline(defs.get(id) || '');
            return `<li id="fn-${id}"><p>${inline} <a class="footnote-backref" href="#fnref-${id}" aria-label="Back to reference">↩</a></p></li>`;
        }).join('');
        return `<section class="footnotes"><ol>${items}</ol></section>`;
    }

    function parseFrontmatter(text) {
        const m = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(text);
        if (!m) return { frontmatter: null, body: text };
        const fm = {};
        m[1].split('\n').forEach(line => {
            const km = line.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
            if (km) {
                let v = km[2].trim();
                if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                    v = v.slice(1, -1);
                }
                fm[km[1]] = v;
            }
        });
        return { frontmatter: fm, body: text.slice(m[0].length) };
    }

    function renderFrontmatter(fm) {
        const rows = Object.entries(fm).map(([k, v]) =>
            `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`).join('');
        return `<div class="frontmatter"><table>${rows}</table></div>`;
    }

    function scheduleRender() {
        if (pendingRender) clearTimeout(pendingRender);
        pendingRender = setTimeout(render, 20);
    }

    async function render() {
        const result = await resolveContent();
        if (result.error) { renderError(result.error); return; }
        if (!result.content) { renderEmpty(); return; }

        const hash = result.source + ':' + simpleHash(result.content);
        if (hash === lastRenderedHash) { Logger.trace('Skip render (unchanged)'); return; }
        lastRenderedHash = hash;

        try {
            await renderMarkdown(result.content, result.source);
        } catch (err) {
            Logger.error('Render failed', err);
            renderError(err.message || 'Render failed');
        }
    }

    async function renderMarkdown(rawContent, source) {
        configureMarked();
        slugCounts.clear();

        const { frontmatter, body: bodyAfterFm } = parseFrontmatter(rawContent);
        const { body, defs: fnDefs, order: fnOrder } = extractFootnotes(bodyAfterFm);

        const hasMath = config.enable_math && /\$\$?[^$\n]/.test(body);
        const hasDiagrams = config.enable_diagrams && /```mermaid/i.test(body);

        const html = marked.parse(body) + renderFootnotesSection(fnDefs, fnOrder);
        const fmHtml = (config.frontmatter_display && frontmatter && Object.keys(frontmatter).length)
            ? renderFrontmatter(frontmatter) : '';

        const dirty = fmHtml + '<div class="md">' + html + '</div>';
        const clean = DOMPurify.sanitize(dirty, {
            ADD_ATTR: ['data-source', 'data-type', 'data-cb', 'data-target', 'data-copied', 'aria-label', 'aria-hidden'],
            ADD_TAGS: ['svg', 'path', 'circle', 'line', 'polyline', 'rect', 'polygon', 'ellipse', 'g', 'defs', 'marker', 'foreignObject'],
            ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|sms|cid|xmpp|#):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
        });

        const contentEl = document.getElementById('viewer-content');
        contentEl.innerHTML = clean;

        await postProcess(contentEl, { hasMath, hasDiagrams });

        if (config.enable_toc) buildTOC();
        else hideTOC();

        const headings = Array.from(contentEl.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(headingMeta);
        lastWordCount = (contentEl.textContent.match(/\S+/g) || []).length;
        updateReadingStats(lastWordCount);
        if (tts.state !== 'idle') stopReading();
        sendMessage('markdown:loaded', { source, wordCount: lastWordCount, headings, hasMath, hasDiagrams });

        if (config.auto_scroll_to_anchor && window.location.hash) {
            setTimeout(() => {
                const id = decodeURIComponent(window.location.hash.slice(1));
                const t = document.getElementById(id);
                if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
        }
    }

    async function postProcess(root, { hasMath, hasDiagrams }) {
        if (config.enable_anchors) addHeadingAnchors(root);
        adjustLinks(root);
        wrapTables(root);
        wireCodeCopyButtons(root);
        if (config.enable_image_zoom) wireImageZoom(root);
        highlightCode(root);
        if (hasMath) await renderMath(root);
        if (hasDiagrams) await renderDiagrams(root);
    }

    function addHeadingAnchors(root) {
        root.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]').forEach(h => {
            if (h.querySelector('.heading-anchor')) return;
            const a = document.createElement('a');
            a.className = 'heading-anchor';
            a.href = '#' + h.id;
            a.setAttribute('aria-label', 'Link to ' + h.textContent.trim());
            a.textContent = '#';
            h.insertBefore(a, h.firstChild);
            a.addEventListener('click', (e) => {
                e.stopPropagation();
                sendMessage('markdown:heading-clicked', headingMeta(h));
            });
        });
    }

    function adjustLinks(root) {
        root.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') || '';
            const isAnchor = href.startsWith('#');
            const isExternal = /^https?:\/\//.test(href);
            if (isExternal && config.links_target !== '_self') {
                a.setAttribute('target', config.links_target);
                a.setAttribute('rel', 'noopener noreferrer');
            }
            a.addEventListener('click', () => {
                sendMessage('markdown:link-clicked', {
                    href, text: (a.textContent || '').trim(), internal: isAnchor
                });
            });
        });
    }

    function wrapTables(root) {
        root.querySelectorAll('table').forEach(t => {
            if (t.parentElement?.classList.contains('table-wrap')) return;
            const wrap = document.createElement('div');
            wrap.className = 'table-wrap';
            t.parentNode.insertBefore(wrap, t);
            wrap.appendChild(t);
        });
    }

    function wireCodeCopyButtons(root) {
        root.querySelectorAll('.code-copy').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const target = btn.getAttribute('data-target');
                const pre = root.querySelector(`pre[data-cb="${target}"]`);
                if (!pre) return;
                const code = pre.querySelector('code')?.textContent || '';
                try {
                    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
                    else fallbackCopy(code);
                    btn.setAttribute('data-copied', 'true');
                    const span = btn.querySelector('span');
                    const orig = span?.textContent;
                    if (span) span.textContent = 'Copied!';
                    setTimeout(() => {
                        btn.removeAttribute('data-copied');
                        if (span && orig) span.textContent = orig;
                    }, 1500);
                } catch (err) {
                    Logger.warn('Clipboard write failed', err);
                }
            });
        });
    }

    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
    }

    function wireImageZoom(root) {
        root.querySelectorAll('img').forEach(img => {
            img.addEventListener('click', () => openLightbox(img.src, img.alt));
        });
    }

    function highlightCode(root) {
        if (!window.Prism) return;
        root.querySelectorAll('pre code[class*="language-"]').forEach(block => {
            try { Prism.highlightElement(block); } catch (e) { Logger.warn('Prism failed', e); }
        });
    }

    function mathInlineFallback(src) { return `<code>$${escapeHtml(src)}$</code>`; }
    function mathBlockFallback(src) { return `<pre><code>${escapeHtml(src)}</code></pre>`; }

    async function loadKaTeX() {
        if (katexLoaded) return;
        await Promise.all([
            loadStylesheet('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'),
            loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js')
        ]);
        katexLoaded = true;
        Logger.info('KaTeX loaded');
    }

    async function renderMath(root) {
        try {
            await loadKaTeX();
        } catch (err) {
            Logger.warn('KaTeX load failed; rendering math as code', err);
            root.querySelectorAll('.math-inline-pending').forEach(el => {
                el.outerHTML = mathInlineFallback(el.getAttribute('data-source') || '');
            });
            root.querySelectorAll('.math-block-pending').forEach(el => {
                el.outerHTML = mathBlockFallback(el.getAttribute('data-source') || '');
            });
            return;
        }
        root.querySelectorAll('.math-inline-pending').forEach(el => {
            const src = el.getAttribute('data-source') || '';
            try { el.outerHTML = katex.renderToString(src, { throwOnError: false, displayMode: false }); }
            catch { el.outerHTML = mathInlineFallback(src); }
        });
        root.querySelectorAll('.math-block-pending').forEach(el => {
            const src = el.getAttribute('data-source') || '';
            try { el.outerHTML = `<div class="katex-display-wrap">${katex.renderToString(src, { throwOnError: false, displayMode: true })}</div>`; }
            catch { el.outerHTML = mathBlockFallback(src); }
        });
    }

    async function loadMermaid() {
        if (mermaidLoaded) return;
        await loadScript('https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js');
        window.mermaid.initialize({
            startOnLoad: false,
            theme: isCurrentlyDark() ? 'dark' : 'default',
            securityLevel: 'strict',
            fontFamily: 'var(--font-family, system-ui)'
        });
        mermaidLoaded = true;
        Logger.info('Mermaid loaded');
    }

    async function renderDiagrams(root) {
        try {
            await loadMermaid();
            const blocks = Array.from(root.querySelectorAll('.mermaid-pending'));
            for (const block of blocks) {
                const src = block.getAttribute('data-source') || '';
                const id = 'mer-' + Math.random().toString(36).slice(2, 9);
                try {
                    const { svg } = await window.mermaid.render(id, src);
                    const container = document.createElement('div');
                    container.className = 'mermaid-container';
                    container.innerHTML = svg;
                    block.replaceWith(container);
                } catch (e) {
                    Logger.warn('Mermaid render failed', e);
                    const pre = document.createElement('pre');
                    pre.className = 'language-mermaid';
                    pre.innerHTML = `<code class="language-mermaid">${escapeHtml(src)}</code>`;
                    block.replaceWith(pre);
                }
            }
        } catch (err) {
            Logger.warn('Mermaid load failed', err);
            root.querySelectorAll('.mermaid-pending').forEach(el => {
                const src = el.getAttribute('data-source') || '';
                const pre = document.createElement('pre');
                pre.innerHTML = `<code>${escapeHtml(src)}</code>`;
                el.replaceWith(pre);
            });
        }
    }

    function isCurrentlyDark() {
        const theme = config.theme || 'auto';
        if (theme === 'dark' || theme === 'xmpro-dark') return true;
        if (theme === 'light' || theme === 'xmpro-light') return false;
        return !!(darkMQ && darkMQ.matches);
    }

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${url}"]`);
            if (existing) {
                if (existing.dataset.loaded === 'true') return resolve();
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('script load failed')));
                return;
            }
            const s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.onload = () => { s.dataset.loaded = 'true'; resolve(); };
            s.onerror = () => reject(new Error('Failed to load ' + url));
            document.head.appendChild(s);
        });
    }

    function loadStylesheet(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`link[href="${url}"]`)) return resolve();
            const l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = url;
            l.onload = () => resolve();
            l.onerror = () => reject(new Error('Failed to load ' + url));
            document.head.appendChild(l);
        });
    }

    function buildTOC() {
        const content = document.getElementById('viewer-content');
        const headings = Array.from(content.querySelectorAll('h2[id], h3[id], h4[id]'));
        if (headings.length < 2) { hideTOC(); return; }

        const listHtml = headings.map(h => {
            const level = h.tagName.toLowerCase();
            const text = h.textContent.replace(/^#/, '').trim();
            return `<li><a class="toc-${level}" href="#${h.id}" data-target="${h.id}">${escapeHtml(text)}</a></li>`;
        }).join('');

        document.getElementById('toc-list').innerHTML = listHtml;
        document.getElementById('toc-drawer-list').innerHTML = listHtml;

        const layout = document.getElementById('viewer-layout');
        layout.setAttribute('data-toc', config.toc_position || 'right');

        const tocAside = document.getElementById('toc');
        const fab = document.getElementById('toc-fab');
        if (config.toc_position === 'floating') {
            tocAside.hidden = true;
            fab.hidden = false;
        } else {
            tocAside.hidden = false;
            fab.hidden = true;
        }

        setupScrollSpy(headings);
    }

    function handleTocClick(e) {
        const a = e.target.closest('a[data-target]');
        if (!a) return;
        e.preventDefault();
        const id = a.getAttribute('data-target');
        const t = document.getElementById(id);
        if (t) {
            t.scrollIntoView({ behavior: 'smooth', block: 'start' });
            history.replaceState(null, '', '#' + id);
            sendMessage('markdown:heading-clicked', headingMeta(t));
        }
        document.getElementById('toc-drawer').classList.remove('open');
    }

    function hideTOC() {
        const layout = document.getElementById('viewer-layout');
        layout.setAttribute('data-toc', 'none');
        document.getElementById('toc').hidden = true;
        document.getElementById('toc-fab').hidden = true;
    }

    function setupScrollSpy(headings) {
        if (scrollSpyObserver) scrollSpyObserver.disconnect();
        const links = document.querySelectorAll('.toc a, .toc-drawer a');
        scrollSpyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    links.forEach(l => l.classList.toggle('active', l.getAttribute('data-target') === id));
                }
            });
        }, { rootMargin: '-15% 0% -70% 0%', threshold: 0, root: document.getElementById('viewer-scroll') });
        headings.forEach(h => scrollSpyObserver.observe(h));
    }

    function updateReadingStats(wordCount) {
        const el = els.readingStats || document.getElementById('reading-stats');
        if (!el) return;
        if (!config.enable_reading_stats || wordCount <= 0) {
            el.hidden = true;
            return;
        }
        const minutes = Math.max(1, Math.round(wordCount / 200));
        el.textContent = `${minutes} min read · ${wordCount.toLocaleString()} words`;
        el.hidden = false;
    }

    function setupPrint() {
        if (!els.printBtn) return;
        els.printBtn.addEventListener('click', () => {
            sendMessage('markdown:print-requested', {});
            window.print();
        });
    }

    let lightsaberWasDragging = false;

    function setupReadAloud() {
        if (!els.readBtn || !('speechSynthesis' in window)) return;
        els.readBtn.addEventListener('click', () => {
            // A pulled-away drag releases here too; the lightsaber handler
            // sets this flag so the click is treated as drag-end, not play.
            if (lightsaberWasDragging) { lightsaberWasDragging = false; return; }
            if (tts.state === 'idle') startReading();
            else if (tts.state === 'playing') pauseReading();
            else resumeReading();
        });
        els.stopBtn?.addEventListener('click', stopReading);
        setupLightsaberHold();
    }

    // Sliders fire many `input` events per drag; debounce the persistence
    // writes so we render every frame but only persist when the user pauses.
    const persistFontSize = debounce(v => applyUserPref('font_size', v), 250);
    const persistTtsRate = debounce(v => applyUserPref('tts_rate', v), 250);

    function setupSettings() {
        if (!els.settingsBtn || !els.settingsPopover) return;
        els.settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = !els.settingsPopover.hasAttribute('hidden');
            if (open) {
                els.settingsPopover.hidden = true;
            } else {
                syncSettingsPopover();
                els.settingsPopover.hidden = false;
                populateVoiceList();
            }
        });
        document.addEventListener('click', (e) => {
            if (els.settingsPopover.hidden) return;
            if (els.settingsPopover.contains(e.target) || els.settingsBtn.contains(e.target)) return;
            els.settingsPopover.hidden = true;
        });

        els.settingsTheme.addEventListener('change', () =>
            applyUserPref('theme', els.settingsTheme.value || undefined));
        els.settingsFsize.addEventListener('input', () => {
            const v = parseFloat(els.settingsFsize.value);
            els.settingsFsizeDisp.textContent = v.toFixed(2) + '×';
            applyConfig({ font_size: v });
            persistFontSize(v);
        });
        els.settingsWidth.addEventListener('change', () =>
            applyUserPref('content_width', els.settingsWidth.value || undefined));
        els.settingsVoice.addEventListener('change', () =>
            applyUserPref('tts_voice', els.settingsVoice.value || undefined));
        els.settingsRate.addEventListener('input', () => {
            const v = parseFloat(els.settingsRate.value);
            els.settingsRateDisp.textContent = v.toFixed(2) + '×';
            applyConfig({ tts_rate: v });
            persistTtsRate(v);
        });
        els.settingsReset.addEventListener('click', resetUserPrefs);

        if (!('speechSynthesis' in window)) {
            const tBlock = document.getElementById('settings-tts-block');
            const rBlock = document.getElementById('settings-rate-block');
            if (tBlock) tBlock.style.display = 'none';
            if (rBlock) rBlock.style.display = 'none';
        }
    }

    function syncSettingsPopover() {
        if (!els.settingsTheme) return;
        els.settingsTheme.value = userPrefs.theme || '';
        const fs = userPrefs.font_size ?? docConfig.font_size ?? 1;
        els.settingsFsize.value = fs;
        els.settingsFsizeDisp.textContent = parseFloat(fs).toFixed(2) + '×';
        els.settingsWidth.value = userPrefs.content_width || '';
        const rate = userPrefs.tts_rate ?? docConfig.tts_rate ?? 1;
        els.settingsRate.value = rate;
        els.settingsRateDisp.textContent = parseFloat(rate).toFixed(2) + '×';
        if (els.settingsFootnote) {
            els.settingsFootnote.textContent = config.persist_preferences
                ? 'Your choices are remembered in this browser.'
                : 'Choices reset on reload (persist_preferences is off).';
        }
    }

    let voiceListenerPending = false;
    // Star Wars mode is unlocked by the lightsaber drag-to-ignite below.
    // Escape exits; the overlay's own play/exit buttons handle the rest.
    function setupStarwars() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && els.starwarsOverlay && !els.starwarsOverlay.hidden) {
                exitStarwars();
            }
        });
        if (els.starwarsPlayBtn) els.starwarsPlayBtn.addEventListener('click', toggleStarwarsPlay);
        if (els.starwarsExitBtn) els.starwarsExitBtn.addEventListener('click', exitStarwars);
    }

    // ---- Hold-to-ignite (audio only, no visual blade) ----
    // Press and hold the read-aloud play button for HOLD_MS. A subtle hum
    // builds while you hold; at the 8s mark the ignition sound fires and
    // the Star Wars crawl opens. Release before then → hum fades, no crawl.
    const HOLD_MS = 8000;
    const HOLD_CLICK_THRESHOLD_MS = 180;
    let saberHold = null;

    function setupLightsaberHold() {
        if (!els.readBtn) return;
        els.readBtn.addEventListener('pointerdown', onHoldStart);
        document.addEventListener('pointerup', onHoldEnd);
        document.addEventListener('pointercancel', onHoldEnd);
    }

    function onHoldStart(e) {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        saberHold = {
            pointerId: e.pointerId,
            startTime: performance.now(),
            completed: false,
            timerId: null,
            humStarted: false
        };
        try { els.readBtn.setPointerCapture(e.pointerId); } catch {}
        tickHold();
    }

    function tickHold() {
        if (!saberHold || saberHold.completed) return;
        const elapsed = performance.now() - saberHold.startTime;
        // Start the hum once we cross the click-vs-hold threshold so a
        // tap-then-release doesn't briefly play a tone.
        if (!saberHold.humStarted && elapsed >= HOLD_CLICK_THRESHOLD_MS) {
            saberHold.humStarted = true;
            startSaberHum();
        }
        if (elapsed >= HOLD_MS) {
            saberHold.completed = true;
            // Set the click-suppression flag NOW so the eventual pointerup
            // (whenever the user releases) doesn't fire a real click that
            // starts TTS. cancelHold below clears saberHold, and onHoldEnd
            // would otherwise early-return without setting this.
            lightsaberWasDragging = true;
            stopSaberHum(/* abrupt */ true);
            playSaberIgnite();
            enterStarwars();
            setTimeout(cancelHold, 600);
            return;
        }
        saberHold.timerId = setTimeout(tickHold, 50);
    }

    function onHoldEnd(e) {
        if (!saberHold || e.pointerId !== saberHold.pointerId) return;
        const elapsed = performance.now() - saberHold.startTime;
        const wasHold = elapsed >= HOLD_CLICK_THRESHOLD_MS;
        if (!saberHold.completed) cancelHold();
        if (wasHold) lightsaberWasDragging = true; // suppress click that follows
    }

    function cancelHold() {
        if (!saberHold) return;
        if (saberHold.timerId) clearTimeout(saberHold.timerId);
        try { els.readBtn.releasePointerCapture(saberHold.pointerId); } catch {}
        if (saberHold.humStarted) stopSaberHum(/* abrupt */ false);
        saberHold = null;
    }

    // ---- Audio: hum during hold + ignition snap at completion ----
    let humCtx = null, humOsc = null, humGain = null;

    function startSaberHum() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            humCtx = new Ctx();
            humOsc = humCtx.createOscillator();
            humGain = humCtx.createGain();
            humOsc.type = 'sawtooth';
            const t = humCtx.currentTime;
            // Frequency slowly rises 80→120 Hz across the remaining hold —
            // subtle build that signals "something's about to happen".
            humOsc.frequency.setValueAtTime(80, t);
            humOsc.frequency.linearRampToValueAtTime(120, t + (HOLD_MS - HOLD_CLICK_THRESHOLD_MS) / 1000);
            // Ramp from inaudible to ~0.045 (still quiet) over 8 s.
            humGain.gain.setValueAtTime(0.0001, t);
            humGain.gain.exponentialRampToValueAtTime(0.012, t + 0.4);
            humGain.gain.linearRampToValueAtTime(0.045, t + (HOLD_MS - HOLD_CLICK_THRESHOLD_MS) / 1000);
            humOsc.connect(humGain).connect(humCtx.destination);
            humOsc.start();
        } catch { humCtx = null; }
    }

    function stopSaberHum(abrupt) {
        if (!humCtx) return;
        try {
            const t = humCtx.currentTime;
            humGain.gain.cancelScheduledValues(t);
            humGain.gain.setValueAtTime(humGain.gain.value, t);
            humGain.gain.exponentialRampToValueAtTime(0.0001, t + (abrupt ? 0.06 : 0.2));
            humOsc.stop(t + (abrupt ? 0.08 : 0.25));
            const ctx = humCtx;
            humOsc.onended = () => { try { ctx.close(); } catch {} };
        } catch {}
        humCtx = null; humOsc = null; humGain = null;
    }

    // Subtle synthesised ignition snap — layered sawtooth + triangle for
    // the iconic vrm-vzz character, no audio file needed.
    function playSaberIgnite() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const now = ctx.currentTime;

            const sweep = ctx.createOscillator();
            const sweepGain = ctx.createGain();
            sweep.type = 'sawtooth';
            sweep.frequency.setValueAtTime(60, now);
            sweep.frequency.exponentialRampToValueAtTime(180, now + 0.28);
            sweep.frequency.linearRampToValueAtTime(140, now + 0.6);
            sweepGain.gain.setValueAtTime(0.0001, now);
            sweepGain.gain.exponentialRampToValueAtTime(0.07, now + 0.05);
            sweepGain.gain.exponentialRampToValueAtTime(0.04, now + 0.4);
            sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
            sweep.connect(sweepGain).connect(ctx.destination);

            const shimmer = ctx.createOscillator();
            const shimmerGain = ctx.createGain();
            shimmer.type = 'triangle';
            shimmer.frequency.setValueAtTime(420, now);
            shimmer.frequency.linearRampToValueAtTime(360, now + 0.4);
            shimmerGain.gain.setValueAtTime(0.0001, now);
            shimmerGain.gain.exponentialRampToValueAtTime(0.02, now + 0.1);
            shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
            shimmer.connect(shimmerGain).connect(ctx.destination);

            sweep.start(now); sweep.stop(now + 0.85);
            shimmer.start(now); shimmer.stop(now + 0.8);
            sweep.onended = () => { try { ctx.close(); } catch {} };
        } catch { /* AudioContext blocked or unavailable — silently skip */ }
    }

    function enterStarwars() {
        if (!els.starwarsOverlay || !els.starwarsCrawl || !els.content) return;
        // Clone rendered content; CSS hides the bits that don't suit a crawl.
        els.starwarsCrawl.innerHTML = els.content.innerHTML;
        // Reset animations: removing then re-adding .playing forces a fresh
        // pause→running transition (and a fresh from:top:100% start).
        els.starwarsOverlay.classList.remove('playing');
        els.starwarsOverlay.hidden = false;
        // Force a reflow so the animation restarts cleanly on every entry.
        void els.starwarsOverlay.offsetWidth;
        els.starwarsOverlay.classList.add('playing');
        Logger.info('★ Star Wars mode engaged — may the markdown be with you');
    }

    function exitStarwars() {
        if (!els.starwarsOverlay) return;
        els.starwarsOverlay.hidden = true;
        els.starwarsOverlay.classList.remove('playing');
    }

    // The play button on the overlay only toggles the scroll animation.
    // TTS is intentionally not involved — Star Wars mode is silent reading.
    function toggleStarwarsPlay() {
        if (!els.starwarsOverlay) return;
        els.starwarsOverlay.classList.toggle('playing');
    }

    function populateVoiceList() {
        const sel = els.settingsVoice;
        if (!sel || !('speechSynthesis' in window)) return;
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) {
            if (voiceListenerPending) return;
            voiceListenerPending = true;
            window.speechSynthesis.addEventListener('voiceschanged', () => {
                voiceListenerPending = false;
                populateVoiceList();
            }, { once: true });
            return;
        }
        if (sel.dataset.populated === 'true') {
            sel.value = userPrefs.tts_voice || '';
            return;
        }
        sel.dataset.populated = 'true';
        const opts = ['<option value="">Browser default</option>'];
        for (const v of voices) {
            opts.push(`<option value="${escapeHtml(v.name)}">${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`);
        }
        sel.innerHTML = opts.join('');
        sel.value = userPrefs.tts_voice || '';
    }

    function getReadableText(startFrom) {
        const content = els.content || document.getElementById('viewer-content');
        if (!content) return '';
        if (startFrom && !content.contains(startFrom)) startFrom = null;
        const excluded = new Set(content.querySelectorAll(
            'pre, code, .mermaid-container, .katex, .frontmatter, .heading-anchor, .footnote-ref, .footnote-backref'
        ));
        const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const p = node.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                if (/SCRIPT|STYLE/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
                for (let el = p; el && el !== content; el = el.parentElement) {
                    if (excluded.has(el)) return NodeFilter.FILTER_REJECT;
                }
                return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        const parts = [];
        let n;
        let started = !startFrom;
        while ((n = walker.nextNode())) {
            if (!started) {
                // Bit 4 = DOCUMENT_POSITION_FOLLOWING (n comes after startFrom).
                // pos === 0 means same node. Either case: start collecting.
                const pos = startFrom.compareDocumentPosition(n);
                if (!(pos === 0 || (pos & 4))) continue;
                started = true;
            }
            parts.push(n.nodeValue);
        }
        return parts.join(' ').replace(/\s+/g, ' ').trim();
    }

    // Chrome silently truncates SpeechSynthesisUtterance at ~32 KB and can drop
    // long utterances on a ~15s silence timeout. Chunking at sentence
    // boundaries keeps every chunk safely below that threshold.
    const TTS_CHUNK_LEN = 2000;
    function chunkText(text) {
        if (text.length <= TTS_CHUNK_LEN) return [text];
        const chunks = [];
        let rest = text;
        while (rest.length > TTS_CHUNK_LEN) {
            let cut = rest.lastIndexOf('. ', TTS_CHUNK_LEN);
            if (cut < TTS_CHUNK_LEN / 2) cut = rest.lastIndexOf(' ', TTS_CHUNK_LEN);
            if (cut < 0) cut = TTS_CHUNK_LEN;
            else cut += 1;
            chunks.push(rest.slice(0, cut).trim());
            rest = rest.slice(cut).trimStart();
        }
        if (rest) chunks.push(rest);
        return chunks;
    }

    function startReading() {
        // If the user has clicked into or selected something in the document,
        // start reading from that point instead of the beginning.
        let startFrom = null;
        const sel = window.getSelection?.();
        if (sel && sel.rangeCount > 0 && sel.anchorNode) {
            startFrom = sel.anchorNode;
        }
        const text = getReadableText(startFrom);
        if (!text) return;
        tts.queue = chunkText(text);
        tts.index = 0;
        tts.state = 'playing';   // set BEFORE speak() — onend may fire synchronously on empty chunks
        updateReadAloudUI();
        sendMessage('markdown:read-aloud-started', { wordCount: lastWordCount, chunks: tts.queue.length });
        speakNextChunk();
    }

    function findTtsVoice() {
        if (!('speechSynthesis' in window)) return null;
        const name = config.tts_voice;
        if (!name) return null;
        const voices = window.speechSynthesis.getVoices();
        return voices.find(v => v.name === name) || null;
    }

    function speakNextChunk() {
        if (tts.state === 'idle') return;
        if (tts.index >= tts.queue.length) {
            tts.state = 'idle';
            tts.queue = [];
            tts.index = 0;
            updateReadAloudUI();
            sendMessage('markdown:read-aloud-ended', {});
            return;
        }
        const u = new SpeechSynthesisUtterance(tts.queue[tts.index]);
        u.rate = config.tts_rate || 1;
        u.pitch = 1;
        const v = findTtsVoice();
        if (v) u.voice = v;
        u.onend = () => { tts.index++; speakNextChunk(); };
        u.onerror = () => stopReading();
        try { window.speechSynthesis.speak(u); }
        catch (e) { Logger.warn('TTS failed', e); stopReading(); }
    }

    function pauseReading() {
        try { window.speechSynthesis.pause(); } catch {}
        tts.state = 'paused';
        updateReadAloudUI();
    }

    function resumeReading() {
        try { window.speechSynthesis.resume(); } catch {}
        tts.state = 'playing';
        updateReadAloudUI();
    }

    function stopReading() {
        try { window.speechSynthesis.cancel(); } catch {}
        tts.state = 'idle';
        tts.queue = [];
        tts.index = 0;
        updateReadAloudUI();
    }

    const PLAY_ICON_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    const PAUSE_ICON_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

    function updateReadAloudUI() {
        if (tts.state === lastTtsUiState) return;
        lastTtsUiState = tts.state;
        if (!els.readBtn || !els.stopBtn) return;
        if (tts.state === 'idle') {
            els.readBtn.innerHTML = PLAY_ICON_SVG;
            els.readBtn.setAttribute('aria-label', 'Read aloud');
            els.readBtn.removeAttribute('data-state');
            els.stopBtn.hidden = true;
        } else if (tts.state === 'playing') {
            els.readBtn.innerHTML = PAUSE_ICON_SVG;
            els.readBtn.setAttribute('aria-label', 'Pause reading');
            els.readBtn.setAttribute('data-state', 'playing');
            els.stopBtn.hidden = false;
        } else {
            els.readBtn.innerHTML = PLAY_ICON_SVG;
            els.readBtn.setAttribute('aria-label', 'Resume reading');
            els.readBtn.setAttribute('data-state', 'paused');
            els.stopBtn.hidden = false;
        }
    }

    function setupProgressBar() {
        const fill = document.getElementById('progress-bar-fill');
        const scroll = document.getElementById('viewer-scroll');
        let throttleTimer = null;
        let latestPct = 0;
        scroll.addEventListener('scroll', () => {
            const max = scroll.scrollHeight - scroll.clientHeight;
            latestPct = max > 0 ? (scroll.scrollTop / max) * 100 : 0;
            if (fill) fill.style.width = latestPct + '%';
            if (throttleTimer) return;
            throttleTimer = setTimeout(() => {
                throttleTimer = null;
                if (config.enable_progress_bar) {
                    sendMessage('markdown:scroll-progress', { percent: Math.round(latestPct) });
                }
            }, 200);
        }, { passive: true });
    }

    function openLightbox(src, alt) {
        const lb = document.getElementById('lightbox');
        const img = document.getElementById('lightbox-img');
        img.src = src; img.alt = alt || '';
        lb.classList.add('open');
        lb.setAttribute('aria-hidden', 'false');
    }
    function closeLightbox() {
        const lb = document.getElementById('lightbox');
        lb.classList.remove('open');
        lb.setAttribute('aria-hidden', 'true');
    }
    function setupLightbox() {
        const lb = document.getElementById('lightbox');
        lb.addEventListener('click', (e) => {
            if (e.target === lb || e.target.closest('.lightbox-close')) closeLightbox();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lb.classList.contains('open')) closeLightbox();
        });
    }

    function setupTocDrawer() {
        const fab = document.getElementById('toc-fab');
        const drawer = document.getElementById('toc-drawer');
        fab.addEventListener('click', (e) => { e.stopPropagation(); drawer.classList.toggle('open'); });
        document.addEventListener('click', (e) => {
            if (!drawer.contains(e.target) && !fab.contains(e.target)) drawer.classList.remove('open');
        });
    }

    function setupSearch() {
        const overlay = document.getElementById('search-overlay');
        const input = document.getElementById('search-input');
        const info = document.getElementById('search-info');
        const prev = document.getElementById('search-prev');
        const next = document.getElementById('search-next');
        const close = document.getElementById('search-close');

        document.addEventListener('keydown', (e) => {
            if (!config.enable_search) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                overlay.classList.add('open');
                input.focus(); input.select();
            }
            if (e.key === 'Escape' && overlay.classList.contains('open')) {
                clearSearch(); overlay.classList.remove('open');
            }
        });

        let timer;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => performSearch(input.value), 150);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                gotoSearchMatch(e.shiftKey ? -1 : 1);
            }
        });
        prev.addEventListener('click', () => gotoSearchMatch(-1));
        next.addEventListener('click', () => gotoSearchMatch(1));
        close.addEventListener('click', () => { clearSearch(); overlay.classList.remove('open'); });

        function performSearch(query) {
            clearSearch();
            if (!query || query.length < 2) { info.textContent = ''; return; }
            const content = document.getElementById('viewer-content');
            const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            const matches = [];
            const textNodes = [];
            const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
                acceptNode(node) {
                    const p = node.parentElement;
                    if (p && /SCRIPT|STYLE/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
                    return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            });
            let n; while ((n = walker.nextNode())) textNodes.push(n);
            textNodes.forEach(node => {
                const text = node.nodeValue;
                re.lastIndex = 0;
                if (!re.test(text)) return;
                re.lastIndex = 0;
                const frag = document.createDocumentFragment();
                let last = 0, m;
                while ((m = re.exec(text)) !== null) {
                    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
                    const span = document.createElement('span');
                    span.className = 'search-highlight';
                    span.textContent = m[0];
                    frag.appendChild(span);
                    matches.push(span);
                    last = m.index + m[0].length;
                }
                if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
                node.parentNode.replaceChild(frag, node);
            });
            searchState = { matches, current: matches.length ? 0 : -1, query };
            updateInfo();
            if (matches.length) {
                matches[0].classList.add('current');
                matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        function gotoSearchMatch(dir) {
            if (!searchState.matches.length) return;
            searchState.matches[searchState.current]?.classList.remove('current');
            searchState.current = (searchState.current + dir + searchState.matches.length) % searchState.matches.length;
            const el = searchState.matches[searchState.current];
            el.classList.add('current');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            updateInfo();
        }

        function updateInfo() {
            const { matches, current } = searchState;
            info.textContent = matches.length ? `${current + 1} / ${matches.length}` : 'No matches';
        }

        function clearSearch() {
            const content = document.getElementById('viewer-content');
            const parents = new Set();
            content.querySelectorAll('.search-highlight').forEach(el => {
                const parent = el.parentNode;
                parent.replaceChild(document.createTextNode(el.textContent), el);
                parents.add(parent);
            });
            parents.forEach(p => p.normalize());
            searchState = { matches: [], current: -1, query: '' };
            info.textContent = '';
        }
    }

    function sendMessage(type, data) {
        try {
            window.parent.postMessage({
                source: 'xmpro-metablock',
                type, data: data || {},
                timestamp: new Date().toISOString(),
                metablockId: config.metablock_id
            }, '*');
        } catch { /* iframe sandbox restrictions */ }
    }

    function setupMessageListener() {
        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (!msg || typeof msg !== 'object') return;
            if (msg.source !== 'xmpro-metablock' && msg.source !== 'xmpro-harness') return;
            if (msg.metablockId && msg.metablockId === config.metablock_id) return;

            Logger.debug('msg received', msg.type, msg.data);

            switch (msg.type) {
                case 'harness:hello':
                case 'markdown:request-ready':
                    sendMessage('markdown:ready', { metablockId: config.metablock_id });
                    break;
                case 'markdown:set-content':
                    if (typeof msg.data?.content === 'string') {
                        config.content = msg.data.content;
                        dataSourceContent = null;
                        lastRenderedHash = null;
                        scheduleRender();
                    }
                    break;
                case 'markdown:set-theme':
                    if (msg.data?.theme) setDocConfig({ theme: msg.data.theme });
                    break;
                case 'markdown:set-background': {
                    const bg = msg.data?.background ?? docConfig.background;
                    setDocConfig({
                        background: bg,
                        // Clear the image URL when leaving the image background, so
                        // toggling back doesn't resurrect a stale URL.
                        background_image_url: bg === 'image'
                            ? (msg.data?.background_image_url ?? docConfig.background_image_url)
                            : '',
                        background_overlay: msg.data?.background_overlay ?? docConfig.background_overlay
                    });
                    break;
                }
                case 'markdown:update-config':
                    if (msg.data && typeof msg.data === 'object') {
                        setDocConfig(normalizeConfig(msg.data));
                        lastRenderedHash = null;
                        scheduleRender();
                    }
                    break;
                case 'markdown:scroll-to':
                    if (msg.data?.anchor) {
                        const el = document.getElementById(msg.data.anchor);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else if (typeof msg.data?.percent === 'number') {
                        const sc = document.getElementById('viewer-scroll');
                        sc.scrollTo({ top: (sc.scrollHeight - sc.clientHeight) * (msg.data.percent / 100), behavior: 'smooth' });
                    }
                    break;
            }
        });
    }

    function renderEmpty() {
        const c = document.getElementById('viewer-content');
        c.innerHTML = `<div class="viewer-state">
<svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
<div class="state-title">No content to display</div>
<div class="state-message">Set <code>content</code> or <code>markdown_url</code> in Value Mapping, or connect a Data Source with a <code>markdown</code> field.</div>
</div>`;
    }

    function renderError(message) {
        const c = document.getElementById('viewer-content');
        c.innerHTML = `<div class="viewer-state">
<svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-critical);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
<div class="state-title">Couldn't load content</div>
<div class="state-message">${escapeHtml(message)}</div>
</div>`;
    }

    function cacheElements() {
        els.root = document.getElementById('viewer-root');
        els.content = document.getElementById('viewer-content');
        els.progressBar = document.getElementById('progress-bar');
        els.readingStats = document.getElementById('reading-stats');
        els.printBtn = document.getElementById('btn-print');
        els.readBtn = document.getElementById('btn-read-aloud');
        els.stopBtn = document.getElementById('btn-stop-aloud');
        els.settingsBtn = document.getElementById('btn-settings');
        els.settingsPopover = document.getElementById('settings-popover');
        els.settingsTheme = document.getElementById('settings-theme');
        els.settingsFsize = document.getElementById('settings-font-size');
        els.settingsFsizeDisp = document.getElementById('settings-font-size-display');
        els.settingsWidth = document.getElementById('settings-width');
        els.settingsVoice = document.getElementById('settings-tts-voice');
        els.settingsRate = document.getElementById('settings-tts-rate');
        els.settingsRateDisp = document.getElementById('settings-tts-rate-display');
        els.settingsReset = document.getElementById('settings-reset');
        els.settingsFootnote = document.getElementById('settings-footnote');
        els.starwarsOverlay = document.getElementById('starwars-overlay');
        els.starwarsCrawl = document.getElementById('starwars-crawl');
        els.starwarsPlayBtn = document.getElementById('starwars-play-btn');
        els.starwarsExitBtn = document.getElementById('starwars-exit-btn');
    }

    function debounce(fn, wait) {
        let t = null;
        return function (...args) {
            if (t) clearTimeout(t);
            t = setTimeout(() => { t = null; fn.apply(this, args); }, wait);
        };
    }

    function initOnce() {
        cacheElements();
        setupMessageListener();
        setupProgressBar();
        setupLightbox();
        setupTocDrawer();
        setupSearch();
        setupPrint();
        setupReadAloud();
        setupSettings();
        setupStarwars();

        document.getElementById('toc-list').addEventListener('click', handleTocClick);
        document.getElementById('toc-drawer-list').addEventListener('click', handleTocClick);

        if (window.matchMedia) {
            darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
            darkMQ.addEventListener('change', () => {
                // Only re-render when the auto theme is in use; explicit themes
                // are unaffected by the OS preference.
                if (config.theme && config.theme !== 'auto') return;
                if (!mermaidLoaded || !window.mermaid) return;
                window.mermaid.initialize({
                    startOnLoad: false,
                    theme: isCurrentlyDark() ? 'dark' : 'default',
                    securityLevel: 'strict'
                });
                lastRenderedHash = null;
                scheduleRender();
            });
        }

        // Re-announce a few times so we win timing races against a parent
        // listener that attaches slightly later.
        announceReady();
    }

    function announceReady() {
        const payload = { metablockId: config.metablock_id };
        sendMessage('markdown:ready', payload);
        setTimeout(() => sendMessage('markdown:ready', payload), 150);
        setTimeout(() => sendMessage('markdown:ready', payload), 500);
    }

    window.onValueMappingLoaded = onValueMappingLoaded;
    window.onDataLoaded = onDataLoaded;
    window.onDataChanged = onDataChanged;

    function maybeSelfInit() {
        if (hasInitialized) return;
        const params = new URLSearchParams(window.location.search);
        const standalone = params.get('standalone') === '1' || params.has('content') || params.has('url');
        if (!standalone) return;
        const initData = { debug: true };
        if (params.has('content')) initData.content = params.get('content');
        if (params.has('url')) initData.markdown_url = params.get('url');
        if (params.has('theme')) initData.theme = params.get('theme');
        if (params.has('bg')) initData.background = params.get('bg');
        onValueMappingLoaded(initData);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(maybeSelfInit, 100));
    } else {
        setTimeout(maybeSelfInit, 100);
    }
})();
