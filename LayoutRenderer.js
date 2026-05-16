/**
 * LayoutRenderer — 通用版式渲染引擎
 *
 * 读取 JSON 版式定义，渲染为 HTML 预览（960×540）或 PptxGenJS 幻灯片。
 * 增加版式只需添加 JSON 文件，无需修改此文件。
 *
 * 坐标系：英寸，16:9 = 13.333 × 5.625
 */

const LayoutRenderer = {

  // ─────────────────────────────────────────────
  // 公共入口
  // ─────────────────────────────────────────────

  /** 渲染 HTML 字符串（960×540px 坐标系） */
  renderHTML(layoutDef, slideData, theme) {
    const ctx = this._buildContext(slideData, theme);
    const regions = layoutDef.regions || [];
    const inner = regions.map(r => this._regionHTML(r, ctx, { x:0, y:0, w:13.333, h:5.625 })).join('\n');
    return `<div style="width:960px;height:540px;position:relative;overflow:hidden;font-family:'Microsoft YaHei','PingFang SC',sans-serif;box-sizing:border-box;">\n${inner}\n</div>`;
  },

  /** 渲染 PptxGenJS 幻灯片 */
  renderPptx(pptx, layoutDef, slideData, theme) {
    const s = pptx.addSlide();
    const ctx = this._buildContext(slideData, theme);
    const regions = layoutDef.regions || [];
    regions.forEach(r => this._regionPptx(s, pptx, r, ctx, { x:0, y:0, w:13.333, h:5.625 }));
  },

  // ─────────────────────────────────────────────
  // 上下文构建
  // ─────────────────────────────────────────────

  _buildContext(slide, theme) {
    return {
      slide,
      theme,
      // 主题颜色快捷引用
      primary: '#' + (theme.cover?.accentColor || '1C4AFF'),
      dark:    '#' + (theme.content?.headerBg || theme.cover?.bg || '0E2841'),
      accent:  '#' + (theme.section?.accentColor || theme.cover?.accentColor || '1C4AFF'),
    };
  },

  // ─────────────────────────────────────────────
  // 颜色 / 值解析
  // ─────────────────────────────────────────────

  /** 解析颜色引用，返回带 # 的十六进制或 CSS 颜色 */
  _resolveColor(value, ctx) {
    if (!value) return '#000000';
    if (value.startsWith('rgba') || value.startsWith('rgb')) return value;
    if (value.startsWith('#')) return value;
    if (value.startsWith('theme.')) {
      const path = value.replace('theme.', '').split('.');
      let obj = ctx.theme;
      for (const key of path) { obj = obj?.[key]; if (obj == null) break; }
      // ThemeEngine 存的颜色不含 #，加上
      return obj ? (obj.startsWith('#') ? obj : '#' + obj) : '#000000';
    }
    return value;
  },

  /** 解析 fontSize 表达式如 "theme.font.titleSize+4" */
  _resolveFontSize(value, ctx) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.startsWith('theme.')) {
      const match = value.match(/^(theme\.[\w.]+)([+-]\d+)?$/);
      if (match) {
        const base = this._resolveColor(match[1].replace(/\.\d+$/, ''), ctx) || 16;
        const path = match[1].replace('theme.', '').split('.');
        let v = ctx.theme;
        for (const k of path) { v = v?.[k]; }
        const num = parseFloat(v) || 16;
        const offset = match[2] ? parseInt(match[2]) : 0;
        return num + offset;
      }
    }
    return 16;
  },

  /** 解析内容引用，返回字符串 */
  _resolveContent(ref, ctx, itemData, itemIndex) {
    if (!ref) return '';
    if (ref.startsWith('literal.')) return ref.replace('literal.', '');
    if (ref === 'slot.title')    return ctx.slide.title || '';
    if (ref === 'slot.subtitle') return ctx.slide.subtitle || '';
    if (ref === 'slot.year')     return ctx.slide.year || '2025';
    if (ref === 'slot.chapterNum') return ctx.slide.chapterNum || '01';
    if (ref === 'slot.item')     return itemData || '';
    if (ref === 'slot.item_title') {
      const s = String(itemData || '');
      return s.split(/[：:]/)[0]?.trim() || s.slice(0, 15);
    }
    if (ref === 'slot.item_body') return itemData || '';
    if (ref === 'slot.item_num') {
      const m = String(itemData || '').match(/(\d+[\.\d]*[%亿万千百+]?)/);
      return m ? m[1] : '—';
    }
    if (ref === 'slot.index_1') return String(itemIndex != null ? itemIndex + 1 : 1).padStart(2, '0');
    if (ref === 'slot.index_0') return String(itemIndex != null ? itemIndex : 0).padStart(2, '0');
    return '';
  },

  // ─────────────────────────────────────────────
  // 尺寸解析（英寸 → px，按比例 960/13.333）
  // ─────────────────────────────────────────────
  SCALE: 960 / 13.333,  // ≈ 72 px/inch

  _px(inch, axis) {
    if (inch === '100%') return axis === 'w' ? 960 : 540;
    if (inch === 'auto') return null;
    return Math.round(inch * this.SCALE);
  },

  _pxStr(inch, axis) {
    if (inch === '100%') return '100%';
    if (inch === 'auto') return 'auto';
    return this._px(inch, axis) + 'px';
  },

  // ─────────────────────────────────────────────
  // HTML 渲染 — 各 region 类型
  // ─────────────────────────────────────────────

  _regionHTML(region, ctx, parent) {
    const type = region.type;
    if (type === 'rect')               return this._rectHTML(region, ctx);
    if (type === 'text')               return this._textHTML(region, ctx, null, null);
    if (type === 'divider')            return this._dividerHTML(region, ctx);
    if (type === 'image_placeholder')  return this._imagePlaceholderHTML(region, ctx);
    if (type === 'badge')              return this._badgeHTML(region, ctx, null, null);
    if (type === 'group')              return this._groupHTML(region, ctx, null, null);
    if (type === 'repeat')             return this._repeatHTML(region, ctx);
    return '';
  },

  _abs(r, extra) {
    // 绝对定位公共样式
    const x = this._pxStr(r.x || 0, 'x');
    const y = this._pxStr(r.y || 0, 'y');
    const w = this._pxStr(r.w, 'w');
    const h = this._pxStr(r.h, 'h');
    const op = r.opacity != null && r.opacity !== 1 ? `opacity:${r.opacity};` : '';
    const radius = r.radius ? `border-radius:${this._px(r.radius)}px;` : '';
    return `position:absolute;left:${x};top:${y};width:${w};height:${h};${op}${radius}${extra || ''}`;
  },

  _rectHTML(r, ctx) {
    const fill = this._resolveColor(r.fill, ctx);
    return `<div style="${this._abs(r, `background:${fill};box-sizing:border-box;`)}"></div>`;
  },

  _dividerHTML(r, ctx) {
    const color = this._resolveColor(r.color, ctx);
    const op = r.opacity != null && r.opacity !== 1 ? `opacity:${r.opacity};` : '';
    return `<div style="${this._abs(r, `background:${color};${op}`)}"></div>`;
  },

  _imagePlaceholderHTML(r, ctx) {
    const fill = this._resolveColor(r.fill, ctx);
    const op = r.opacity != null ? r.opacity : 0.15;
    const borderStyle = r.border
      ? `border:${r.border.width}px solid ${this._resolveColor(r.border.color, ctx)};`
      : '';
    return `<div style="${this._abs(r, `background:${fill};opacity:${op};${borderStyle}box-sizing:border-box;`)}"></div>`;
  },

  _textHTML(r, ctx, itemData, itemIndex) {
    // optional: 如果内容为空则不渲染
    const raw = this._resolveContent(r.content, ctx, itemData, itemIndex);
    if (r.optional && !raw) return '';
    const text = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const prefix = r.prefix ? r.prefix.replace(/"/g,'&quot;') : '';

    const color  = this._resolveColor(r.color, ctx);
    const fs     = this._resolveFontSize(r.fontSize, ctx);
    const fw     = r.fontWeight === 'bold' ? '700' : '400';
    const align  = r.align || 'left';
    const valign = r.valign || 'top';
    const ls     = r.letterSpacing ? `letter-spacing:${r.letterSpacing}px;` : '';
    const lh     = r.lineHeight ? `line-height:${r.lineHeight};` : '';
    const italic = r.italic ? 'font-style:italic;' : '';
    const op     = r.opacity != null && r.opacity !== 1 ? `opacity:${r.opacity};` : '';
    const wrap   = r.wrap !== false ? 'overflow:hidden;word-break:break-all;' : 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    const displayFlex = valign !== 'top' ? `display:flex;align-items:${valign==='middle'?'center':'flex-end'};` : '';
    const ml = r.marginLeft ? `margin-left:${this._px(r.marginLeft)}px;` : '';
    const mb = r.marginBottom ? `margin-bottom:${this._px(r.marginBottom)}px;` : '';

    const style = `${this._abs(r)}font-size:${fs}px;font-weight:${fw};color:${color};text-align:${align};${ls}${lh}${italic}${op}${wrap}${displayFlex}${ml}${mb}`;
    return `<div style="${style}">${prefix}${text}</div>`;
  },

  _badgeHTML(r, ctx, itemData, itemIndex) {
    const text = this._resolveContent(r.content, ctx, itemData, itemIndex);
    const fill  = this._resolveColor(r.fill, ctx);
    const color = r.color || '#FFFFFF';
    const fs    = r.fontSize || 12;
    const fw    = r.fontWeight === 'bold' ? '700' : '400';
    const shape = r.shape === 'circle' ? 'border-radius:50%;' : (r.radius ? `border-radius:${this._px(r.radius)}px;` : '');
    const baseStyle = r.x != null
      ? `${this._abs(r)}background:${fill};${shape}display:flex;align-items:center;justify-content:center;flex-shrink:0;`
      : `width:${this._pxStr(r.w,'w')};height:${this._pxStr(r.h,'h')};min-width:${this._pxStr(r.w,'w')};background:${fill};${shape}display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
    return `<div style="${baseStyle}"><span style="font-size:${fs}px;font-weight:${fw};color:${color};">${text}</span></div>`;
  },

  _groupHTML(r, ctx, itemData, itemIndex) {
    const fill   = r.fill ? `background:${this._resolveColor(r.fill, ctx)};` : '';
    const radius = r.radius ? `border-radius:${this._px(r.radius)}px;` : '';
    const shadow = r.shadow ? 'box-shadow:0 2px 8px rgba(0,0,0,0.08);' : '';
    const bl     = r.borderLeft ? `border-left:${this._px(r.borderLeft.width)}px solid ${this._resolveColor(r.borderLeft.color, ctx)};` : '';
    const direction = r.direction === 'row' ? 'row' : 'column';
    const justify   = r.justify || 'flex-start';
    const align     = r.align || 'flex-start';
    const pad = r.padding ? r.padding.map(v => this._px(v) + 'px').join(' ') : '0';
    const gap = r.gap ? `gap:${this._px(r.gap)}px;` : '';
    const ml  = r.marginLeft ? `margin-left:${this._px(r.marginLeft)}px;` : '';
    const mb  = r.marginBottom ? `margin-bottom:${this._px(r.marginBottom)}px;` : '';

    const posStyle = r.x != null
      ? `${this._abs(r)}`
      : `display:flex;flex:1;min-width:0;`;

    const style = `${posStyle}${fill}${radius}${shadow}${bl}flex-direction:${direction};justify-content:${justify};align-items:${align};padding:${pad};${gap}${ml}${mb}box-sizing:border-box;overflow:hidden;`;

    const children = (r.children || []).map(child => {
      // 子元素是相对布局
      const childWithoutAbs = Object.assign({}, child);
      delete childWithoutAbs.x; delete childWithoutAbs.y;
      return this._renderChildHTML(childWithoutAbs, ctx, itemData, itemIndex);
    }).join('\n');

    return `<div style="${style}">\n${children}\n</div>`;
  },

  _renderChildHTML(r, ctx, itemData, itemIndex) {
    if (r.type === 'text')    return this._textHTML(r, ctx, itemData, itemIndex);
    if (r.type === 'badge')   return this._badgeHTML(r, ctx, itemData, itemIndex);
    if (r.type === 'rect')    return this._rectChildHTML(r, ctx);
    if (r.type === 'divider') return this._dividerHTML(r, ctx);
    if (r.type === 'group')   return this._groupHTML(r, ctx, itemData, itemIndex);
    return '';
  },

  _rectChildHTML(r, ctx) {
    const fill = this._resolveColor(r.fill, ctx);
    const op = r.opacity != null && r.opacity !== 1 ? `opacity:${r.opacity};` : '';
    const w = r.w ? `width:${this._pxStr(r.w,'w')};` : 'width:100%;';
    const h = r.h ? `height:${this._pxStr(r.h,'h')};` : 'height:4px;';
    const mt = r.marginTop ? `margin-top:auto;` : '';
    return `<div style="background:${fill};${w}${h}${op}${mt}flex-shrink:0;"></div>`;
  },

  _repeatHTML(r, ctx) {
    const items = (ctx.slide.points || []).slice(0, r.maxItems || 99);
    if (!items.length) return '';

    const layout = r.layout || 'column';
    const cols   = layout === 'grid'
      ? (r.cols === 'auto' ? (items.length <= 3 ? items.length : 2) : (r.cols || 1))
      : (layout === 'row' ? items.length : 1);

    const gapPx  = r.gap ? this._px(r.gap) : 12;
    const x      = this._pxStr(r.x || 0, 'x');
    const y      = this._pxStr(r.y || 0, 'y');
    const w      = this._pxStr(r.w, 'w');
    const h      = this._pxStr(r.h, 'h');

    const gridStyle = layout === 'grid'
      ? `display:grid;grid-template-columns:repeat(${cols},1fr);gap:${gapPx}px;`
      : layout === 'row'
        ? `display:flex;flex-direction:row;gap:${gapPx}px;`
        : `display:flex;flex-direction:column;gap:${gapPx}px;`;

    const dividerStyle = r.divider
      ? `border-right:${this._px(r.divider.width||0.01)}px solid ${this._resolveColor(r.divider.color || '#EEEEEE', ctx)};`
      : '';

    const itemsHTML = items.map((item, i) => {
      const withDivider = r.divider && i < items.length - 1 ? dividerStyle : '';
      const itemStyle = withDivider ? `style="${withDivider}flex:1;"` : 'style="flex:1;"';
      const inner = this._groupHTML(r.item, ctx, item, i);
      // 如果 item 已经是 group，直接把 flex:1 加进去
      return inner.replace(/^<div style="/, `<div style="flex:1;${withDivider}`);
    }).join('\n');

    return `<div style="position:absolute;left:${x};top:${y};width:${w};height:${h};${gridStyle}box-sizing:border-box;overflow:hidden;">\n${itemsHTML}\n</div>`;
  },

  // ─────────────────────────────────────────────
  // PptxGenJS 渲染 — 各 region 类型
  // ─────────────────────────────────────────────

  _regionPptx(s, pptx, region, ctx, parent) {
    const type = region.type;
    if (type === 'rect')              this._rectPptx(s, pptx, region, ctx);
    if (type === 'divider')           this._dividerPptx(s, pptx, region, ctx);
    if (type === 'image_placeholder') this._imagePlaceholderPptx(s, pptx, region, ctx);
    if (type === 'text')              this._textPptx(s, pptx, region, ctx, null, null);
    if (type === 'badge')             this._badgePptx(s, pptx, region, ctx, null, null);
    if (type === 'group')             this._groupPptx(s, pptx, region, ctx, null, null);
    if (type === 'repeat')            this._repeatPptx(s, pptx, region, ctx);
  },

  _colorHex(value, ctx) {
    // pptxgenjs 不要 #，只要六位十六进制
    return this._resolveColor(value, ctx).replace('#', '');
  },

  _dim(v, axis) {
    // pptxgenjs 用英寸，'100%' 转成对应全幅
    if (v === '100%') return axis === 'w' ? 13.333 : 5.625;
    if (v === 'auto') return 1.0;
    return v;
  },

  _rectPptx(s, pptx, r, ctx) {
    s.addShape(pptx.ShapeType.rect, {
      x: r.x || 0, y: r.y || 0,
      w: this._dim(r.w, 'w'), h: this._dim(r.h, 'h'),
      fill: { color: this._colorHex(r.fill, ctx) },
      ...(r.radius ? { rectRadius: r.radius } : {}),
      ...(r.opacity != null && r.opacity !== 1 ? { transparency: Math.round((1 - r.opacity) * 100) } : {})
    });
  },

  _dividerPptx(s, pptx, r, ctx) {
    const op = r.opacity != null && r.opacity !== 1 ? { transparency: Math.round((1 - r.opacity) * 100) } : {};
    s.addShape(pptx.ShapeType.rect, {
      x: r.x || 0, y: r.y || 0,
      w: this._dim(r.w, 'w'), h: this._dim(r.h, 'h'),
      fill: { color: this._colorHex(r.color, ctx) },
      ...op
    });
  },

  _imagePlaceholderPptx(s, pptx, r, ctx) {
    const op = Math.round((1 - (r.opacity || 0.15)) * 100);
    s.addShape(pptx.ShapeType.rect, {
      x: r.x || 0, y: r.y || 0,
      w: this._dim(r.w, 'w'), h: this._dim(r.h, 'h'),
      fill: { color: this._colorHex(r.fill, ctx) },
      transparency: op,
      ...(r.border ? { line: { color: this._colorHex(r.border.color, ctx), width: r.border.width || 1.5 } } : {})
    });
  },

  _textPptx(s, pptx, r, ctx, itemData, itemIndex) {
    const raw = this._resolveContent(r.content, ctx, itemData, itemIndex);
    if (r.optional && !raw) return;
    const prefix = r.prefix || '';
    const fs   = this._resolveFontSize(r.fontSize, ctx);
    const bold = r.fontWeight === 'bold';
    const color = this._colorHex(r.color, ctx);
    const f = ctx.theme.font || {};
    s.addText(prefix + raw, {
      x: r.x || 0, y: r.y || 0,
      w: this._dim(r.w, 'w'), h: this._dim(r.h, 'h'),
      fontSize: fs, bold, color,
      fontFace: bold ? (f.title || 'Microsoft YaHei') : (f.body || 'Microsoft YaHei'),
      align: r.align || 'left',
      valign: r.valign || 'top',
      italic: r.italic || false,
      wrap: r.wrap !== false,
      charSpacing: r.letterSpacing || 0,
      ...(r.opacity != null && r.opacity !== 1 ? { transparency: Math.round((1 - r.opacity) * 100) } : {})
    });
  },

  _badgePptx(s, pptx, r, ctx, itemData, itemIndex) {
    if (r.x == null) return; // 相对布局的 badge 在 _groupPptx 里处理
    const text  = this._resolveContent(r.content, ctx, itemData, itemIndex);
    const fill  = this._colorHex(r.fill, ctx);
    const color = (r.color || '#FFFFFF').replace('#', '');
    const shape = r.shape === 'circle' ? pptx.ShapeType.ellipse : pptx.ShapeType.rect;
    s.addShape(shape, {
      x: r.x, y: r.y, w: r.w, h: r.h,
      fill: { color: fill },
      ...(r.radius && r.shape !== 'circle' ? { rectRadius: r.radius } : {})
    });
    s.addText(text, {
      x: r.x, y: r.y, w: r.w, h: r.h,
      fontSize: r.fontSize || 12, bold: r.fontWeight === 'bold',
      color, fontFace: ctx.theme.font?.body || 'Microsoft YaHei',
      align: 'center', valign: 'middle'
    });
  },

  _groupPptx(s, pptx, r, ctx, itemData, itemIndex) {
    if (r.x == null) return; // 相对 group 需要父级提供坐标，在 repeat 里处理
    const pad = r.padding || [0,0,0,0];
    const x = r.x + (pad[3] || 0);
    const y = r.y + (pad[0] || 0);
    const w = this._dim(r.w, 'w') - (pad[1] || 0) - (pad[3] || 0);
    const h = this._dim(r.h, 'h') - (pad[0] || 0) - (pad[2] || 0);

    if (r.fill) {
      s.addShape(pptx.ShapeType.rect, {
        x: r.x, y: r.y,
        w: this._dim(r.w, 'w'), h: this._dim(r.h, 'h'),
        fill: { color: this._colorHex(r.fill, ctx) },
        ...(r.radius ? { rectRadius: r.radius } : {})
      });
    }

    const children = r.children || [];
    const direction = r.direction || 'column';
    let cursor = direction === 'row' ? x : y;
    const gap = r.gap || 0;

    children.forEach(child => {
      const childW = direction === 'row' ? (child.w || 1.0) : w;
      const childH = direction === 'column' ? (child.h || 0.4) : h;
      const childX = direction === 'row' ? cursor : x;
      const childY = direction === 'column' ? cursor : y;
      const positioned = Object.assign({}, child, { x: childX, y: childY, w: childW, h: childH });

      if (child.type === 'text')    this._textPptx(s, pptx, positioned, ctx, itemData, itemIndex);
      if (child.type === 'badge')   this._badgePptx(s, pptx, positioned, ctx, itemData, itemIndex);
      if (child.type === 'rect')    this._rectPptx(s, pptx, positioned, ctx);
      if (child.type === 'divider') this._dividerPptx(s, pptx, positioned, ctx);

      if (direction === 'row')    cursor += childW + gap;
      if (direction === 'column') cursor += childH + gap;
    });
  },

  _repeatPptx(s, pptx, r, ctx) {
    const items = (ctx.slide.points || []).slice(0, r.maxItems || 99);
    if (!items.length) return;

    const layout = r.layout || 'column';
    const cols   = layout === 'grid'
      ? (r.cols === 'auto' ? (items.length <= 3 ? items.length : 2) : (r.cols || 1))
      : (layout === 'row' ? items.length : 1);
    const rows   = Math.ceil(items.length / cols);
    const gap    = r.gap || 0;

    const totalW = this._dim(r.w, 'w');
    const totalH = this._dim(r.h, 'h');
    const itemW  = (totalW - gap * (cols - 1)) / cols;
    const itemH  = (totalH - gap * (rows - 1)) / rows;

    items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ix  = (r.x || 0) + col * (itemW + gap);
      const iy  = (r.y || 0) + row * (itemH + gap);

      this._renderItemPptx(s, pptx, r.item, ctx, item, i, ix, iy, itemW, itemH);
    });
  },

  _renderItemPptx(s, pptx, item, ctx, itemData, itemIndex, x, y, w, h) {
    if (!item) return;
    const pad  = item.padding || [0,0,0,0];
    const fill = item.fill;
    const gap  = item.gap || 0;

    if (fill) {
      s.addShape(pptx.ShapeType.rect, {
        x, y, w, h,
        fill: { color: this._colorHex(fill, ctx) },
        ...(item.radius ? { rectRadius: item.radius } : {})
      });
    }
    if (item.borderLeft) {
      s.addShape(pptx.ShapeType.rect, {
        x, y, w: item.borderLeft.width || 0.06, h,
        fill: { color: this._colorHex(item.borderLeft.color, ctx) }
      });
    }

    const direction = item.direction || 'column';
    const innerX = x + (pad[3] || 0);
    const innerY = y + (pad[0] || 0);
    const innerW = w - (pad[1] || 0) - (pad[3] || 0);
    const innerH = h - (pad[0] || 0) - (pad[2] || 0);

    const children = item.children || [];
    let cursor = direction === 'row' ? innerX : innerY;

    children.forEach(child => {
      const childW = direction === 'row' ? (child.w || 0.5) : innerW;
      const childH = direction === 'column' ? (child.h || innerH / Math.max(children.length, 1)) : innerH;
      const cx = direction === 'row' ? cursor : innerX;
      const cy = direction === 'column' ? cursor : innerY;
      const positioned = Object.assign({}, child, { x: cx, y: cy, w: childW, h: childH });

      if (child.type === 'text')    this._textPptx(s, pptx, positioned, ctx, itemData, itemIndex);
      if (child.type === 'badge')   this._badgePptx(s, pptx, positioned, ctx, itemData, itemIndex);
      if (child.type === 'rect')    this._rectPptx(s, pptx, positioned, ctx);
      if (child.type === 'divider') this._dividerPptx(s, pptx, positioned, ctx);

      if (direction === 'row')    cursor += childW + gap;
      if (direction === 'column') cursor += childH + gap;
    });
  }
};

if (typeof module !== 'undefined') module.exports = { LayoutRenderer };
if (typeof window !== 'undefined') window.LayoutRenderer = LayoutRenderer;
