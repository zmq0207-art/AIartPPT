/**
 * LayoutEngine v3 — 版式调度层（数据库版）
 *
 * 版式定义存储在 Cloudflare D1，通过 /api/layouts 接口加载。
 * 本地 localStorage 缓存，TTL 默认 7 天，离线可用。
 *
 * 新增版式只需往数据库 INSERT 一条记录，立即生效，无需重新部署。
 */

const LayoutEngine = {

  _registry: {},
  _index:    [],
  _loading:  {},
  _apiBase:  '/api/layouts',
  _cacheKey: 'sf_layout_index_v1',
  _cacheTTL: 7 * 24 * 60 * 60 * 1000,

  // ── 初始化 ────────────────────────────────────
  async init(apiBase, preload) {
    if (apiBase) this._apiBase = apiBase;
    if (preload) { preload.forEach(def => this._registerFull(def)); return; }

    const cached = this._readCache();
    if (cached) {
      this._index = cached;
      this._fetchIndex(true).catch(() => {});
      return;
    }
    await this._fetchIndex(false);
  },

  async _fetchIndex(silent) {
    try {
      const resp = await fetch(this._apiBase);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this._index = data.layouts || [];
      this._writeCache(this._index);
      if (!silent) console.log(`[LayoutEngine] 加载 ${this._index.length} 个版式`);
    } catch (e) {
      if (!silent) console.warn('[LayoutEngine] 版式目录加载失败:', e.message);
      if (!this._index.length) throw e;
    }
  },

  // ── 按需加载单个版式 ──────────────────────────
  async _fetchDef(id) {
    if (this._registry[id]) return this._registry[id];
    if (this._loading[id])  return this._loading[id];

    this._loading[id] = (async () => {
      const cached = this._readDefCache(id);
      if (cached) { this._registry[id] = cached; return cached; }
      const resp = await fetch(`${this._apiBase}/${id}`);
      if (!resp.ok) throw new Error(`Layout not found: ${id}`);
      const def = await resp.json();
      this._registry[id] = def;
      this._writeDefCache(id, def);
      return def;
    })().finally(() => { delete this._loading[id]; });

    return this._loading[id];
  },

  // ── 注册（同步，离线/预加载用）───────────────
  register(def) { this._registerFull(def); },

  _registerFull(def) {
    this._registry[def.id] = def;
    if (!this._index.find(e => e.id === def.id)) {
      this._index.push({ id: def.id, name: def.name, slideType: def.slideType,
        tags: def.tags || [], pointRange: def.pointRange || null });
    }
  },

  get(id)            { return this._registry[id] || null; },
  list()             { return this._index.slice(); },
  listByType(type)   { return this._index.filter(e => e.slideType === type); },
  search(tag)        { return this._index.filter(e => (e.tags||[]).some(t => t.includes(tag))); },

  // ── 版式推荐 ──────────────────────────────────
  recommend(slide) {
    if (slide.layout && (this._registry[slide.layout] || this._index.find(e => e.id === slide.layout)))
      return slide.layout;

    const type = slide.type;
    if (type === 'cover')   return 'cover_hero';
    if (type === 'end')     return 'cover_end';
    if (type === 'agenda')  return 'agenda_grid';
    if (type === 'section') return 'section_left';

    const pts  = slide.points || [];
    const n    = pts.length;
    const text = (slide.title||'') + ' ' + (slide.subtitle||'') + ' ' + pts.join(' ');

    if (pts.some(p => /\d+%|\d+[亿万千百]|\d+\.\d+/.test(p)) && n <= 3) return 'content_stats';
    if (/步骤|阶段|流程|第[一二三四五六]步|phase|step/i.test(text) && n >= 3) return 'content_timeline';
    if (/对比|vs\b|versus|优劣|比较/i.test(text) || n === 2) return 'content_split';
    if (n >= 3 && n <= 4) return 'content_cards';
    if (n > 4)            return 'content_list_accent';
    return 'content_feature';
  },

  // ── 同步渲染（版式未加载时返回 loading 占位）──
  buildHTML(slide, theme, layoutId) {
    const id  = layoutId || this.recommend(slide);
    const def = this._registry[id];
    if (def) return LayoutRenderer.renderHTML(def, slide, theme);

    // 触发异步加载，加载完成后重渲染
    this._fetchDef(id).then(() => {
      if (typeof window !== 'undefined' && window._onLayoutReady)
        window._onLayoutReady(id);
    }).catch(() => {});
    return this._loadingHTML(slide);
  },

  buildPptx(pptx, slide, theme, layoutId) {
    const id  = layoutId || this.recommend(slide);
    const def = this._registry[id];
    if (def) LayoutRenderer.renderPptx(pptx, def, slide, theme);
    else     pptx.addSlide();  // 占位，下载前应调用 preloadAll
  },

  // ── 异步渲染（推荐用于下载场景）──────────────
  async buildHTMLAsync(slide, theme, layoutId) {
    const id = layoutId || this.recommend(slide);
    try {
      const def = await this._fetchDef(id);
      return LayoutRenderer.renderHTML(def, slide, theme);
    } catch (e) {
      return this._fallbackHTML(slide, theme);
    }
  },

  async buildPptxAsync(pptx, slide, theme, layoutId) {
    const id = layoutId || this.recommend(slide);
    try {
      const def = await this._fetchDef(id);
      LayoutRenderer.renderPptx(pptx, def, slide, theme);
    } catch { pptx.addSlide(); }
  },

  // ── 批量预加载（下载 pptx 前调用）────────────
  async preloadAll(slides) {
    const ids = [...new Set(slides.map(sl => this.recommend(sl)))];
    await Promise.all(ids.map(id => this._fetchDef(id).catch(() => {})));
  },

  // ── 占位 HTML ─────────────────────────────────
  _loadingHTML(slide) {
    const t = (slide.title||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
    return `<div style="width:960px;height:540px;background:#f5f8ff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Microsoft YaHei',sans-serif;">
      <div style="font-size:13px;color:#aaa;margin-bottom:12px;">版式加载中…</div>
      <div style="font-size:22px;font-weight:700;color:#0E2841;">${t}</div>
    </div>`;
  },

  _fallbackHTML(slide, theme) {
    const t  = (slide.title||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const bg = theme?.content?.headerBg || '0E2841';
    return `<div style="width:960px;height:540px;background:#fff;display:flex;flex-direction:column;overflow:hidden;">
      <div style="height:88px;background:#${bg};display:flex;align-items:center;padding:0 56px;">
        <span style="font-size:28px;font-weight:700;color:#fff;">${t}</span>
      </div>
      <div style="flex:1;padding:24px 56px;display:flex;flex-direction:column;gap:10px;">
        ${(slide.points||[]).map(p=>`<div style="font-size:16px;color:#333;">${p.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>`).join('')}
      </div>
    </div>`;
  },

  // ── localStorage 缓存 ─────────────────────────
  _readCache() {
    try {
      const raw = localStorage.getItem(this._cacheKey);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      return Date.now() - ts > this._cacheTTL ? null : data;
    } catch { return null; }
  },

  _writeCache(data) {
    try { localStorage.setItem(this._cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch {}
  },

  _readDefCache(id) {
    try {
      const raw = localStorage.getItem(`sf_layout_def_v1_${id}`);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      return Date.now() - ts > 86400000 ? null : data;
    } catch { return null; }
  },

  _writeDefCache(id, def) {
    try { localStorage.setItem(`sf_layout_def_v1_${id}`, JSON.stringify({ ts: Date.now(), data: def })); } catch {}
  },

  clearCache() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('sf_layout'));
      keys.forEach(k => localStorage.removeItem(k));
      this._registry = {};
      this._index = [];
      console.log(`[LayoutEngine] 已清除 ${keys.length} 条缓存`);
    } catch {}
  }
};

if (typeof module !== 'undefined') module.exports = { LayoutEngine };
if (typeof window !== 'undefined') window.LayoutEngine = LayoutEngine;
