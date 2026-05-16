/**
 * LayoutEngine — 版式库
 * 来源：蓝色商务简约型英文企业介绍PPT模板（19张幻灯片逐帧解析）
 *
 * 主题色系（从模板 theme1.xml 提取）：
 *   primary   ${primary}  — 主蓝色（accent2），色块、强调、按钮
 *   dark      ${dark}  — 深海蓝（dk2），深色背景
 *   accent    #00AAFB  — 天蓝（accent3），次要强调
 *   bg        #FFFFFF  — 白色背景
 *   text      #000000  — 正文黑
 *   muted     #666666  — 次要文字
 *
 * 版式命名规则：
 *   cover_*        封面/结尾类（slides 1, 19）
 *   section_*      章节过渡页（slides 3, 7, 11, 15）
 *   agenda_*       目录类（slide 2）
 *   content_*      内容页（slides 4–6, 8–10, 12–14, 16–18）
 *
 * 每个版式包含：
 *   id          唯一标识
 *   name        中文名称
 *   desc        适用场景说明
 *   slots       可填充的数据槽（title / subtitle / points / stats 等）
 *   buildHTML   网页预览渲染函数（960×540 坐标系）
 *   buildPptx   PptxGenJS 渲染函数
 */

const LayoutEngine = {

  // ─────────────────────────────────────────────
  // 工具函数
  // ─────────────────────────────────────────────
  _esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;')
                    .replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },

  // ─────────────────────────────────────────────
  // 版式注册表
  // ─────────────────────────────────────────────
  layouts: {},

  register(layout) {
    this.layouts[layout.id] = layout;
  },

  get(id) {
    return this.layouts[id] || null;
  },

  list() {
    return Object.values(this.layouts).map(l => ({
      id: l.id, name: l.name, desc: l.desc, slots: l.slots
    }));
  },

  // 根据内容特征自动推荐版式
  recommend(slide) {
    const pts = (slide.points || []).length;
    const hasStats = (slide.points || []).some(p => /\d+%|\d+[亿万千百]|\d+\.\d+/.test(p));
    const hasSteps = /步骤|阶段|流程|第[一二三四五]步|phase|step/i.test(slide.title + (slide.subtitle || ''));
    const hasSplit = pts === 2;
    const hasCompare = /对比|vs|versus|优劣|优缺|比较/i.test(slide.title + (slide.subtitle || ''));

    if (slide.type === 'cover') return 'cover_hero';
    if (slide.type === 'end')   return 'cover_end';
    if (slide.type === 'agenda') return 'agenda_grid';
    if (slide.type === 'section') return 'section_left';

    if (hasStats && pts <= 3)   return 'content_stats';
    if (hasSteps && pts >= 3)   return 'content_timeline';
    if (hasCompare || hasSplit) return 'content_split';
    if (pts >= 3 && pts <= 4)   return 'content_cards';
    if (pts > 4)                return 'content_list_accent';
    return 'content_feature';
  },

  buildHTML(slide, theme, layoutId) {
    const id = layoutId || this.recommend(slide);
    const layout = this.get(id);
    if (!layout) return '<div style="color:red">Layout not found: ' + id + '</div>';
    // 注入主题主色变量，供各 buildHTML 使用（兼容 ThemeEngine 无 # 前缀格式）
    const enriched = this._enrichTheme(theme);
    return layout.buildHTML(slide, enriched, this._esc.bind(this));
  },

  // 从 ThemeEngine 主题中提取统一颜色变量
  _enrichTheme(th) {
    // 从 ThemeEngine 主题中提取颜色（不含 # 前缀）
    const primary = th.cover?.accentColor || '1C4AFF';
    const headerBg = th.content?.headerBg || th.cover?.bg || '0E2841';
    const accent  = th.section?.accentColor || primary;
    return Object.assign({}, th, {
      _primary: '#' + primary,
      _dark:    '#' + headerBg,
      _accent:  '#' + accent
    });
  },

  buildPptx(pptx, slide, theme, layoutId) {
    const id = layoutId || this.recommend(slide);
    const layout = this.get(id);
    if (!layout) return;
    layout.buildPptx(pptx, slide, theme);
  }
};


// ═══════════════════════════════════════════════
// COVER — 封面（Slide 1 / 19 风格）
// 左侧大标题 + 年份色块，右侧深蓝竖条 + 图片
// ═══════════════════════════════════════════════
LayoutEngine.register({
  id: 'cover_hero',
  name: '封面·英雄版',
  desc: '左文右图，右侧主色竖条，适合开场封面',
  slots: ['title', 'subtitle', 'year'],

  buildHTML(sl, th, esc) {
    const c = th.cover;
    const primary = th._primary || '#' + (th.cover?.accentColor || '1C4AFF');
    const dark = th._dark || '#0E2841';
    const year = esc(sl.year || '2025');
    const t = esc(sl.title || '');
    const sub = esc(sl.subtitle || '');
    return `
<div style="width:960px;height:540px;background:#fff;position:relative;overflow:hidden;font-family:'Microsoft YaHei',sans-serif;display:flex;">
  <!-- 左侧内容区 -->
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:64px 56px;position:relative;z-index:2;">
    <!-- 年份色块 -->
    <div style="background:#${c.accentColor};color:#fff;font-size:16px;font-weight:700;padding:6px 18px;display:inline-block;margin-bottom:24px;letter-spacing:2px;max-width:120px;">${year}</div>
    <!-- 主标题 -->
    <div style="font-size:44px;font-weight:700;color:${dark};line-height:1.2;margin-bottom:28px;">${t}</div>
    <!-- 装饰线 -->
    <div style="width:80px;height:3px;background:#${c.accentColor};margin-bottom:24px;"></div>
    <!-- 副标题区域：两列小字 -->
    ${sub ? `<div style="font-size:15px;color:#666;line-height:1.6;">${sub}</div>` : ''}
  </div>
  <!-- 右侧：深色竖条 + 浮动图片框 -->
  <div style="width:320px;background:#${c.accentColor};position:relative;flex-shrink:0;">
    <!-- 白色图片框占位 -->
    <div style="position:absolute;left:-60px;top:50%;transform:translateY(-50%);width:260px;height:240px;background:rgba(255,255,255,0.15);border:3px solid rgba(255,255,255,0.3);"></div>
    <!-- 小装饰方块 -->
    <div style="position:absolute;left:-80px;top:50%;transform:translateY(-30%);width:60px;height:56px;background:#${c.accentColor};opacity:0.7;"></div>
  </div>
</div>`;
  },

  buildPptx(pptx, sl, th) {
    const s = pptx.addSlide();
    const c = th.cover; const f = th.font;
    const year = sl.year || '2025';
    // 白背景
    s.addShape(pptx.ShapeType.rect, { x:0,y:0,w:'100%',h:'100%', fill:{color:'FFFFFF'} });
    // 右侧蓝色竖条
    s.addShape(pptx.ShapeType.rect, { x:8.5,y:0,w:4.833,h:'100%', fill:{color:c.accentColor} });
    // 小方块装饰
    s.addShape(pptx.ShapeType.rect, { x:7.2,y:2.05,w:0.9,h:0.82, fill:{color:c.accentColor} });
    // 图片框
    s.addShape(pptx.ShapeType.rect, { x:7.7,y:1.75,w:4.2,h:3.12,
      fill:{color:'FFFFFF'}, line:{color:'FFFFFF',width:0}, transparency:85 });
    // 年份色块
    s.addShape(pptx.ShapeType.rect, { x:0.6,y:1.35,w:1.8,h:0.45, fill:{color:c.accentColor} });
    s.addText(year, { x:0.6,y:1.35,w:1.8,h:0.45,
      fontSize:14,bold:true,color:'FFFFFF',fontFace:f.title,align:'center',valign:'middle' });
    // 主标题
    s.addText(sl.title||'', { x:0.6,y:1.95,w:6.8,h:2.0,
      fontSize:f.titleSize+4,bold:true,color:'0E2841',fontFace:f.title,
      align:'left',valign:'top',wrap:true });
    // 装饰线
    s.addShape(pptx.ShapeType.rect, { x:0.6,y:4.05,w:0.8,h:0.05, fill:{color:c.accentColor} });
    // 副标题
    if (sl.subtitle) s.addText(sl.subtitle, { x:0.6,y:4.2,w:6.5,h:0.9,
      fontSize:f.subtitleSize,color:'666666',fontFace:f.body,align:'left',wrap:true });
    // 底部小方块
    s.addShape(pptx.ShapeType.rect, { x:0.7,y:5.28,w:0.45,h:0.32, fill:{color:c.accentColor} });
  }
});


// ═══════════════════════════════════════════════
// COVER END — 结尾页（与封面对称）
// ═══════════════════════════════════════════════
LayoutEngine.register({
  id: 'cover_end',
  name: '结尾·谢谢',
  desc: '与封面风格一致的结尾感谢页',
  slots: ['title', 'subtitle', 'year'],

  buildHTML(sl, th, esc) {
    const c = th.cover;
    const primary = th._primary || '#' + (th.cover?.accentColor || '1C4AFF');
    const dark = th._dark || '#0E2841';
    const year = esc(sl.year || '2025');
    const t = esc(sl.title || '谢谢');
    const sub = esc(sl.subtitle || '');
    return `
<div style="width:960px;height:540px;background:#fff;position:relative;overflow:hidden;font-family:'Microsoft YaHei',sans-serif;display:flex;">
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:64px 56px;z-index:2;">
    <div style="background:#${c.accentColor};color:#fff;font-size:16px;font-weight:700;padding:6px 18px;display:inline-block;margin-bottom:24px;letter-spacing:2px;max-width:120px;">${year}</div>
    <div style="font-size:52px;font-weight:700;color:${dark};line-height:1.15;margin-bottom:22px;">${t}</div>
    <div style="width:80px;height:3px;background:#${c.accentColor};margin-bottom:20px;"></div>
    ${sub ? `<div style="font-size:15px;color:#666;">${sub}</div>` : ''}
  </div>
  <div style="width:320px;background:#${c.accentColor};position:relative;flex-shrink:0;">
    <div style="position:absolute;left:-60px;top:50%;transform:translateY(-50%);width:260px;height:240px;background:rgba(255,255,255,0.15);border:3px solid rgba(255,255,255,0.3);"></div>
  </div>
</div>`;
  },

  buildPptx(pptx, sl, th) {
    // 复用封面逻辑，标题换成结尾文字
    LayoutEngine.get('cover_hero').buildPptx(pptx, sl, th);
  }
});


// ═══════════════════════════════════════════════
// AGENDA — 目录（Slide 2 风格）
// 左侧全屏图片，右侧目录序号卡片
// ═══════════════════════════════════════════════
LayoutEngine.register({
  id: 'agenda_grid',
  name: '目录·序号格',
  desc: '左图右目录，最多4个章节，序号突出',
  slots: ['title', 'subtitle', 'points'],

  buildHTML(sl, th, esc) {
    const c = th.agenda;
    const primary = th._primary || '#1C4AFF';
    const dark = th._dark || '#0E2841';
    const items = (sl.points || []).slice(0, 4);
    const t = esc(sl.title || 'Contents');
    const sub = esc(sl.subtitle || '');
    return `
<div style="width:960px;height:540px;background:#fff;display:flex;overflow:hidden;font-family:'Microsoft YaHei',sans-serif;">
  <!-- 左侧：深色图片占位区 -->
  <div style="width:420px;background:${dark};flex-shrink:0;position:relative;">
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,${dark} 60%,${primary} 100%);"></div>
    <div style="position:absolute;bottom:40px;left:32px;right:32px;">
      <div style="font-size:13px;color:rgba(255,255,255,0.5);letter-spacing:2px;margin-bottom:8px;">ABOUT US</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.6;">${sub}</div>
    </div>
  </div>
  <!-- 右侧：标题 + 目录卡片 -->
  <div style="flex:1;display:flex;flex-direction:column;padding:36px 40px;">
    <div style="font-size:32px;font-weight:700;color:${dark};margin-bottom:6px;">${t}</div>
    <div style="font-size:15px;color:${primary};font-weight:500;margin-bottom:24px;">Introduce us</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;">
      ${items.map((item, i) => `
        <div style="background:#f5f8ff;border-radius:6px;padding:16px 18px;display:flex;align-items:flex-start;gap:12px;">
          <div style="background:${primary};color:#fff;font-size:18px;font-weight:700;width:36px;height:36px;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${String(i+1).padStart(2,'0')}</div>
          <div style="font-size:14px;color:${dark};line-height:1.5;font-weight:500;">${esc(item)}</div>
        </div>`).join('')}
    </div>
  </div>
</div>`;
  },

  buildPptx(pptx, sl, th) {
    const s = pptx.addSlide();
    const c = th.agenda; const f = th.font;
    const items = (sl.points || []).slice(0, 6);
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:'100%',h:'100%',fill:{color:'FFFFFF'}});
    // 左侧深色区
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:5.0,h:'100%',fill:{color:'0E2841'}});
    // 右侧标题
    s.addText(sl.title||'Contents', {x:5.3,y:0.9,w:7.5,h:0.8,
      fontSize:28,bold:true,color:'0E2841',fontFace:f.title,align:'left',valign:'middle'});
    s.addText('Introduce us', {x:5.3,y:1.75,w:5,h:0.4,
      fontSize:14,color:'1C4AFF',bold:true,fontFace:f.body,align:'left'});
    // 目录卡片：最多6条，2列布局
    const cols = items.length <= 3 ? 1 : 2;
    const perCol = Math.ceil(items.length / cols);
    const colW = cols === 1 ? 7.6 : 3.7;
    const rowH = Math.min(1.5, (5.625 - 2.3 - 0.2) / perCol);
    items.forEach((item, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const x = 5.3 + col * (colW + 0.2);
      const y = 2.3 + row * (rowH + 0.12);
      s.addShape(pptx.ShapeType.rect, {x,y,w:colW,h:rowH,fill:{color:'F0F4FF'},rectRadius:0.06});
      s.addShape(pptx.ShapeType.rect, {x:x+0.15,y:y+0.12,w:0.4,h:0.4,fill:{color:'1C4AFF'},rectRadius:0.04});
      s.addText(String(i+1).padStart(2,'0'), {x:x+0.15,y:y+0.12,w:0.4,h:0.4,
        fontSize:11,bold:true,color:'FFFFFF',fontFace:f.body,align:'center',valign:'middle'});
      s.addText(item, {x:x+0.65,y:y+0.1,w:colW-0.8,h:rowH-0.2,
        fontSize:12,color:'0E2841',fontFace:f.body,bold:true,valign:'middle',wrap:true});
    });
  }
});


// ═══════════════════════════════════════════════
// SECTION — 章节过渡（Slides 3/7/11/15 风格）
// 左侧文字，底部蓝色通栏 + 右下角双图
// ═══════════════════════════════════════════════
LayoutEngine.register({
  id: 'section_left',
  name: '章节·左文底蓝',
  desc: '章节过渡页，左侧章节名，底部主色通栏',
  slots: ['title', 'subtitle', 'chapterNum'],

  buildHTML(sl, th, esc) {
    const c = th.section || th.cover;
    const primary = th._primary || '#' + (c.accentColor || '1C4AFF');
    const dark = th._dark || '#0E2841';
    const num = esc(sl.chapterNum || '01');
    const t = esc(sl.title || '');
    const sub = esc(sl.subtitle || '');
    return `
<div style="width:960px;height:540px;background:#fff;position:relative;overflow:hidden;font-family:'Microsoft YaHei',sans-serif;">
  <!-- 底部蓝色通栏 -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:116px;background:#${c.accentColor};"></div>
  <!-- 右下两个图片框 -->
  <div style="position:absolute;bottom:116px;right:0;width:415px;height:168px;background:#e8edf5;"></div>
  <div style="position:absolute;bottom:116px;right:262px;width:168px;height:168px;background:#c8d4e8;"></div>
  <!-- 右上章节号 -->
  <div style="position:absolute;top:24px;right:40px;font-size:22px;font-weight:700;color:${dark};opacity:0.25;">${num}</div>
  <!-- 左上角品牌标 -->
  <div style="position:absolute;top:22px;left:80px;font-size:13px;color:#999;">About our</div>
  <!-- 主内容 -->
  <div style="position:absolute;top:0;left:62px;right:0;bottom:116px;display:flex;flex-direction:column;justify-content:center;padding-right:440px;">
    <div style="font-size:36px;font-weight:700;color:${dark};line-height:1.2;margin-bottom:12px;">${t}</div>
    <div style="font-size:17px;color:#${c.accentColor};font-weight:600;margin-bottom:16px;">${sub}</div>
  </div>
  <!-- 装饰小方块 右中 -->
  <div style="position:absolute;right:36px;top:50%;transform:translateY(-50%);width:36px;height:26px;background:#${c.accentColor};"></div>
</div>`;
  },

  buildPptx(pptx, sl, th) {
    const s = pptx.addSlide();
    const c = th.section || th.cover; const f = th.font;
    const num = sl.chapterNum || '01';
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:'100%',h:'100%',fill:{color:'FFFFFF'}});
    // 底部通栏
    s.addShape(pptx.ShapeType.rect, {x:0,y:5.1,w:'100%',h:0.525,fill:{color:c.accentColor}});
    // 右下图片框
    s.addShape(pptx.ShapeType.rect, {x:5.43,y:4.71,w:3.45,h:1.26,fill:{color:'E0E8F5'}});
    s.addShape(pptx.ShapeType.rect, {x:9.13,y:4.71,w:3.45,h:1.26,fill:{color:'C8D4E8'}});
    // 右上章节号
    s.addText(num, {x:10.0,y:0.25,w:2.5,h:0.5,fontSize:20,bold:true,color:'0E2841',
      fontFace:f.title,align:'right',transparency:75});
    // 装饰小方块
    s.addShape(pptx.ShapeType.rect, {x:12.1,y:1.99,w:0.47,h:0.34,fill:{color:c.accentColor}});
    // 主标题
    s.addText(sl.title||'', {x:0.65,y:1.66,w:7.2,h:1.0,
      fontSize:f.titleSize-2,bold:true,color:'0E2841',fontFace:f.title,align:'left',valign:'middle',wrap:true});
    // 章节说明副标题
    s.addText(sl.subtitle||'', {x:0.68,y:2.54,w:5.1,h:0.5,
      fontSize:16,color:c.accentColor,bold:true,fontFace:f.title,align:'left'});
  }
});


// ═══════════════════════════════════════════════
// CONTENT — 左右分栏（Slide 4/10/16 风格）
// 左侧标题色块，右侧图片；或左文右图
// ═══════════════════════════════════════════════
LayoutEngine.register({
  id: 'content_split',
  name: '内容·左右分栏',
  desc: '左侧标题+正文，右侧图片或色块，适合单一主题深度展开',
  slots: ['title', 'subtitle', 'points'],

  buildHTML(sl, th, esc) {
    const c = th.content;
    const primary = th._primary || '#' + (th.cover?.accentColor || '1C4AFF');
    const dark = th._dark || '#0E2841';
    const t = esc(sl.title || '');
    const sub = esc(sl.subtitle || '');
    const pts = (sl.points || []);
    return `
<div style="width:960px;height:540px;background:#fff;display:flex;overflow:hidden;font-family:'Microsoft YaHei',sans-serif;">
  <!-- 左侧内容 -->
  <div style="width:420px;flex-shrink:0;display:flex;flex-direction:column;padding:44px 40px;">
    <!-- 标题色块 -->
    <div style="background:${primary};color:#fff;font-size:22px;font-weight:700;padding:14px 20px;margin-bottom:16px;line-height:1.3;">${t}</div>
    ${sub ? `<div style="font-size:13px;color:${primary};font-weight:600;margin-bottom:14px;padding-left:4px;">${sub}</div>` : ''}
    <div style="flex:1;display:flex;flex-direction:column;gap:12px;">
      ${pts.map(p => `
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <div style="width:6px;height:6px;background:${primary};border-radius:50%;margin-top:6px;flex-shrink:0;"></div>
          <div style="font-size:13px;color:#333;line-height:1.65;">${esc(p)}</div>
        </div>`).join('')}
    </div>
  </div>
  <!-- 右侧：蓝色背景 + 图片 -->
  <div style="flex:1;background:${primary};position:relative;">
    <div style="position:absolute;inset:30px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);"></div>
    <div style="position:absolute;bottom:30px;right:30px;font-size:48px;font-weight:700;color:rgba(255,255,255,0.1);">→</div>
  </div>
</div>`;
  },

  buildPptx(pptx, sl, th) {
    const s = pptx.addSlide();
    const c = th.content; const f = th.font;
    const pts = sl.points || [];
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:'100%',h:'100%',fill:{color:'FFFFFF'}});
    // 右侧蓝色区
    s.addShape(pptx.ShapeType.rect, {x:5.44,y:0,w:7.89,h:'100%',fill:{color:'1C4AFF'}});
    // 右侧装饰框
    s.addShape(pptx.ShapeType.rect, {x:5.86,y:0.3,w:7.1,h:6.9,
      fill:{type:'none'},line:{color:'FFFFFF',width:1.5,transparency:75}});
    // 左侧标题色块
    s.addShape(pptx.ShapeType.rect, {x:0.5,y:1.1,w:4.5,h:1.0,fill:{color:'1C4AFF'}});
    s.addText(sl.title||'', {x:0.5,y:1.1,w:4.5,h:1.0,
      fontSize:18,bold:true,color:'FFFFFF',fontFace:f.title,align:'left',valign:'middle',
      margin:[0,12,0,12],wrap:true});
    // subtitle
    if(sl.subtitle) s.addText(sl.subtitle, {x:0.5,y:2.2,w:4.5,h:0.5,
      fontSize:12,color:'1C4AFF',bold:true,fontFace:f.body});
    // 要点
    const startY = sl.subtitle ? 2.85 : 2.4;
    const itemH = Math.min(0.85, (5.625-startY-0.3)/Math.max(pts.length,1));
    pts.forEach((pt,i) => {
      const y = startY + i*itemH;
      s.addShape(pptx.ShapeType.ellipse, {x:0.52,y:y+itemH/2-0.07,w:0.12,h:0.12,fill:{color:'1C4AFF'}});
      s.addText(pt, {x:0.76,y,w:4.2,h:itemH,fontSize:12,color:'333333',fontFace:f.body,valign:'middle',wrap:true});
    });
  }
});


// ═══════════════════════════════════════════════
// CONTENT — 数据统计（Slide 18 变体）
// 顶部宽色带，底部3列卡片
// ═══════════════════════════════════════════════
LayoutEngine.register({
  id: 'content_stats',
  name: '内容·数据三列',
  desc: '顶部主题色带+引言，底部三个数据卡片，适合数据展示',
  slots: ['title', 'subtitle', 'points'],

  buildHTML(sl, th, esc) {
    const c = th.content;
    const primary = th._primary || '#' + (th.cover?.accentColor || '1C4AFF');
    const dark = th._dark || '#0E2841';
    const t = esc(sl.title || '');
    const sub = esc(sl.subtitle || '');
    const pts = (sl.points || []).slice(0, 3);
    // 尝试从要点中提取数字
    const parsePoint = (p) => {
      const numMatch = p.match(/(\d+[\.\d]*[%亿万千百+]?)/);
      const num = numMatch ? numMatch[1] : '—';
      const label = p.replace(num, '').replace(/^[：:]/,'').trim().slice(0, 20);
      return { num, label, full: p };
    };
    return `
<div style="width:960px;height:540px;background:#fff;display:flex;flex-direction:column;overflow:hidden;font-family:'Microsoft YaHei',sans-serif;">
  <!-- 顶部蓝色区 -->
  <div style="background:${primary};padding:36px 52px 32px;flex-shrink:0;">
    <div style="font-size:26px;font-weight:700;color:#fff;margin-bottom:10px;">${t}</div>
    ${sub ? `<div style="font-size:14px;color:rgba(255,255,255,0.8);line-height:1.5;">${sub}</div>` : ''}
  </div>
  <!-- 底部三卡片 -->
  <div style="flex:1;display:flex;gap:0;padding:0;">
    ${pts.map((p, i) => {
      const {num, label, full} = parsePoint(p);
      return `
      <div style="flex:1;border-right:${i<pts.length-1?'1px solid #eee':0};padding:28px 32px;display:flex;flex-direction:column;justify-content:space-between;position:relative;">
        <div style="font-size:11px;font-weight:600;color:${primary};letter-spacing:2px;margin-bottom:12px;">0${i+1}</div>
        <div style="font-size:44px;font-weight:700;color:${primary};line-height:1;">${esc(num)}</div>
        <div style="font-size:13px;color:#333;line-height:1.65;margin-top:12px;">${esc(full)}</div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:${primary};"></div>
      </div>`;
    }).join('')}
  </div>
</div>`;
  },

  buildPptx(pptx, sl, th) {
    const s = pptx.addSlide();
    const c = th.content; const f = th.font;
    const pts = (sl.points||[]).slice(0,3);
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:'100%',h:'100%',fill:{color:'FFFFFF'}});
    // 顶部色带
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:'100%',h:2.8,fill:{color:'1C4AFF'}});
    s.addText(sl.title||'', {x:0.5,y:0.5,w:12,h:0.9,
      fontSize:24,bold:true,color:'FFFFFF',fontFace:f.title,align:'left',valign:'middle',wrap:true});
    if(sl.subtitle) s.addText(sl.subtitle, {x:0.5,y:1.5,w:12,h:0.8,
      fontSize:13,color:'FFFFFF',fontFace:f.body,align:'left',wrap:true,transparency:20});
    // 三列卡片
    const colW = 13.333/pts.length;
    pts.forEach((pt,i) => {
      const x = i * colW;
      const numMatch = pt.match(/(\d+[\.\d]*[%亿万千百+]?)/);
      const num = numMatch ? numMatch[1] : '—';
      // 序号
      s.addText(`0${i+1}`, {x:x+0.3,y:2.95,w:colW-0.4,h:0.4,
        fontSize:11,color:'1C4AFF',bold:true,fontFace:f.body,charSpacing:3});
      // 数字
      s.addText(num, {x:x+0.3,y:3.4,w:colW-0.4,h:1.0,
        fontSize:40,bold:true,color:'1C4AFF',fontFace:f.title,align:'left',valign:'middle'});
      // 说明
      s.addText(pt, {x:x+0.3,y:4.45,w:colW-0.5,h:1.0,
        fontSize:12,color:'333333',fontFace:f.body,align:'left',valign:'top',wrap:true});
      // 底部色条
      s.addShape(pptx.ShapeType.rect, {x,y:5.5,w:colW,h:0.125,fill:{color:'1C4AFF'}});
      // 分割线
      if(i>0) s.addShape(pptx.ShapeType.rect, {x,y:2.9,w:0.01,h:4.5,fill:{color:'EEEEEE'}});
    });
  }
});


// ═══════════════════════════════════════════════
// CONTENT — 卡片网格（Slide 13/14 风格）
// 图标+标题+正文的卡片，2×2或1×3
// ═══════════════════════════════════════════════
LayoutEngine.register({
  id: 'content_cards',
  name: '内容·图标卡片',
  desc: '3-4个并列卡片，每张图标+标题+说明，适合特性/优势/步骤',
  slots: ['title', 'subtitle', 'points'],

  buildHTML(sl, th, esc) {
    const c = th.content;
    const primary = th._primary || '#' + (th.cover?.accentColor || '1C4AFF');
    const dark = th._dark || '#0E2841';
    const t = esc(sl.title || '');
    const sub = esc(sl.subtitle || '');
    const pts = (sl.points || []).slice(0, 4);
    const icons = ['◆','◈','◉','◎'];
    const cols = pts.length <= 3 ? pts.length : 2;
    return `
<div style="width:960px;height:540px;background:#f5f8ff;display:flex;flex-direction:column;overflow:hidden;font-family:'Microsoft YaHei',sans-serif;">
  <!-- 顶部标题栏 -->
  <div style="background:${dark};padding:20px 48px;display:flex;align-items:center;gap:20px;">
    <div style="font-size:22px;font-weight:700;color:#fff;">${t}</div>
    ${sub ? `<div style="font-size:13px;color:rgba(255,255,255,0.65);margin-left:auto;max-width:400px;text-align:right;">${sub}</div>` : ''}
  </div>
  <!-- 卡片区 -->
  <div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px;padding:20px 32px;">
    ${pts.map((p, i) => `
      <div style="background:#fff;border-radius:8px;padding:24px 22px;display:flex;flex-direction:column;gap:12px;box-shadow:0 2px 8px rgba(28,74,255,0.08);">
        <div style="width:44px;height:44px;background:${primary};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;font-weight:700;">${icons[i]}</div>
        <div style="font-size:14px;font-weight:700;color:${dark};">${esc(p.split(/[：:]/)[0] || p.slice(0,15))}</div>
        <div style="font-size:12px;color:#555;line-height:1.65;">${esc(p)}</div>
      </div>`).join('')}
  </div>
</div>`;
  },

  buildPptx(pptx, sl, th) {
    const s = pptx.addSlide();
    const c = th.content; const f = th.font;
    const pts = (sl.points||[]).slice(0,4);
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:'100%',h:'100%',fill:{color:'F5F8FF'}});
    // 顶栏
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:'100%',h:1.1,fill:{color:'0E2841'}});
    s.addText(sl.title||'', {x:0.5,y:0.12,w:8,h:0.85,
      fontSize:f.headingSize,bold:true,color:'FFFFFF',fontFace:f.title,align:'left',valign:'middle',wrap:true});
    if(sl.subtitle) s.addText(sl.subtitle, {x:8.5,y:0.12,w:4.3,h:0.85,
      fontSize:11,color:'FFFFFF',fontFace:f.body,align:'right',valign:'middle',wrap:true,transparency:35});
    // 卡片
    const cols = pts.length <= 3 ? pts.length : 2;
    const rows = Math.ceil(pts.length / cols);
    const cardW = (13.333 - 0.6 - (cols-1)*0.2) / cols;
    const cardH = (5.625 - 1.3 - (rows-1)*0.18) / rows;
    pts.forEach((pt, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = 0.3 + col*(cardW+0.2);
      const y = 1.2 + row*(cardH+0.18);
      s.addShape(pptx.ShapeType.rect, {x,y,w:cardW,h:cardH,fill:{color:'FFFFFF'},rectRadius:0.08,
        shadow:{type:'outer',color:'1C4AFF',opacity:0.08,blur:4,offset:2}});
      // 图标色块
      s.addShape(pptx.ShapeType.rect, {x:x+0.2,y:y+0.18,w:0.45,h:0.45,fill:{color:'1C4AFF'},rectRadius:0.06});
      s.addText(String(i+1), {x:x+0.2,y:y+0.18,w:0.45,h:0.45,
        fontSize:12,bold:true,color:'FFFFFF',fontFace:f.body,align:'center',valign:'middle'});
      // 小标题
      const ptTitle = pt.split(/[：:]/)[0] || pt.slice(0,12);
      s.addText(ptTitle, {x:x+0.2,y:y+0.72,w:cardW-0.4,h:0.4,
        fontSize:13,bold:true,color:'0E2841',fontFace:f.title,align:'left',valign:'middle'});
      // 说明
      s.addText(pt, {x:x+0.2,y:y+1.15,w:cardW-0.4,h:cardH-1.35,
        fontSize:11,color:'555555',fontFace:f.body,align:'left',valign:'top',wrap:true});
    });
  }
});


// ═══════════════════════════════════════════════
// CONTENT — 时间轴/流程（Slide 5 风格）
// 横向图标流程，底部引用色带
// ═══════════════════════════════════════════════
LayoutEngine.register({
  id: 'content_timeline',
  name: '内容·横向流程',
  desc: '横向流程轴，3-4个步骤，适合进程、发展阶段、操作步骤',
  slots: ['title', 'subtitle', 'points'],

  buildHTML(sl, th, esc) {
    const c = th.content;
    const primary = th._primary || '#' + (th.cover?.accentColor || '1C4AFF');
    const dark = th._dark || '#0E2841';
    const accent = th._accent || primary;
    const t = esc(sl.title || '');
    const sub = esc(sl.subtitle || '');
    const pts = (sl.points || []).slice(0, 4);
    return `
<div style="width:960px;height:540px;background:#fff;display:flex;flex-direction:column;overflow:hidden;font-family:'Microsoft YaHei',sans-serif;">
  <!-- 顶部标题 -->
  <div style="padding:30px 52px 20px;">
    <div style="font-size:24px;font-weight:700;color:${dark};">${t}</div>
    ${sub ? `<div style="font-size:13px;color:#999;margin-top:6px;">${sub}</div>` : ''}
  </div>
  <!-- 流程主体 -->
  <div style="flex:1;display:flex;align-items:center;padding:0 40px;gap:0;position:relative;">
    <!-- 连接线 -->
    <div style="position:absolute;top:50%;left:80px;right:80px;height:2px;background:${accent}22;transform:translateY(-50%);z-index:0;"></div>
    ${pts.map((p, i) => {
      const ptTitle = p.split(/[：:]/)[0] || p.slice(0,10);
      return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:14px;position:relative;z-index:1;">
        <!-- 节点圆圈 -->
        <div style="width:52px;height:52px;background:${primary};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;box-shadow:0 4px 12px rgba(28,74,255,0.3);">0${i+1}</div>
        <div style="text-align:center;max-width:180px;">
          <div style="font-size:14px;font-weight:700;color:${dark};margin-bottom:6px;">${esc(ptTitle)}</div>
          <div style="font-size:11px;color:#666;line-height:1.6;">${esc(p)}</div>
        </div>
      </div>`;}).join('')}
  </div>
  <!-- 底部引用色带 -->
  <div style="background:${primary};padding:14px 52px;display:flex;align-items:center;gap:16px;">
    <div style="font-size:24px;color:rgba(255,255,255,0.4);">"</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.9);line-height:1.5;">${sub || 'Each stage marks a strategic milestone in our growth journey.'}</div>
  </div>
</div>`;
  },

  buildPptx(pptx, sl, th) {
    const s = pptx.addSlide();
    const c = th.content; const f = th.font;
    const pts = (sl.points||[]).slice(0,4);
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:'100%',h:'100%',fill:{color:'FFFFFF'}});
    // 标题
    s.addText(sl.title||'', {x:0.5,y:0.4,w:12,h:0.75,
      fontSize:f.headingSize,bold:true,color:'0E2841',fontFace:f.title,align:'left',valign:'middle',wrap:true});
    if(sl.subtitle) s.addText(sl.subtitle, {x:0.5,y:1.2,w:12,h:0.4,
      fontSize:12,color:'999999',fontFace:f.body});
    // 连接线
    s.addShape(pptx.ShapeType.rect, {x:0.8,y:3.15,w:11.7,h:0.04,fill:{color:'E0E8FF'}});
    // 底部色带
    s.addShape(pptx.ShapeType.rect, {x:0,y:4.95,w:'100%',h:0.675,fill:{color:'1C4AFF'}});
    const quote = sl.subtitle || 'Each stage marks a strategic milestone in our growth journey.';
    s.addText('"  ' + quote, {x:0.5,y:4.98,w:12,h:0.6,
      fontSize:13,color:'FFFFFF',fontFace:f.body,align:'left',valign:'middle',wrap:true,transparency:10});
    // 流程节点
    const nodeW = 13.333 / pts.length;
    pts.forEach((pt, i) => {
      const cx = i * nodeW + nodeW/2;
      const ptTitle = pt.split(/[：:]/)[0] || pt.slice(0,10);
      // 节点圆
      s.addShape(pptx.ShapeType.ellipse, {x:cx-0.35,y:2.85,w:0.7,h:0.7,fill:{color:'1C4AFF'}});
      s.addText(`0${i+1}`, {x:cx-0.35,y:2.85,w:0.7,h:0.7,
        fontSize:14,bold:true,color:'FFFFFF',fontFace:f.body,align:'center',valign:'middle'});
      // 步骤标题
      s.addText(ptTitle, {x:cx-1.2,y:3.7,w:2.4,h:0.45,
        fontSize:13,bold:true,color:'0E2841',fontFace:f.title,align:'center',valign:'middle',wrap:true});
      // 说明
      s.addText(pt, {x:cx-1.4,y:4.2,w:2.8,h:1.6,
        fontSize:11,color:'555555',fontFace:f.body,align:'center',valign:'top',wrap:true});
    });
  }
});


// ═══════════════════════════════════════════════
// CONTENT — 左深右内容（Slide 8/13 风格）
// 左侧深蓝色背景+主标题，右侧白底内容列表
// ═══════════════════════════════════════════════
LayoutEngine.register({
  id: 'content_feature',
  name: '内容·左深右列',
  desc: '左侧深色背景展示核心主题，右侧列出要点，视觉对比强',
  slots: ['title', 'subtitle', 'points'],

  buildHTML(sl, th, esc) {
    const c = th.content;
    const primary = th._primary || '#' + (th.cover?.accentColor || '1C4AFF');
    const dark = th._dark || '#0E2841';
    const t = esc(sl.title || '');
    const sub = esc(sl.subtitle || '');
    const pts = (sl.points || []);
    return `
<div style="width:960px;height:540px;background:#fff;display:flex;overflow:hidden;font-family:'Microsoft YaHei',sans-serif;">
  <!-- 左侧深色 -->
  <div style="width:340px;background:${dark};flex-shrink:0;display:flex;flex-direction:column;justify-content:center;padding:44px 36px;position:relative;">
    <div style="position:absolute;top:0;right:0;bottom:0;width:4px;background:${primary};"></div>
    <div style="font-size:28px;font-weight:700;color:#fff;line-height:1.3;margin-bottom:16px;">${t}</div>
    <div style="width:40px;height:3px;background:${primary};margin-bottom:16px;"></div>
    ${sub ? `<div style="font-size:13px;color:rgba(255,255,255,0.65);line-height:1.6;">${sub}</div>` : ''}
  </div>
  <!-- 右侧要点 -->
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:36px 44px;gap:14px;">
    ${pts.map((p,i) => `
      <div style="display:flex;gap:16px;align-items:flex-start;">
        <div style="width:28px;height:28px;background:${primary};color:#fff;font-size:12px;font-weight:700;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">0${i+1}</div>
        <div style="font-size:13px;color:#333;line-height:1.65;flex:1;">${esc(p)}</div>
      </div>`).join('')}
  </div>
</div>`;
  },

  buildPptx(pptx, sl, th) {
    const s = pptx.addSlide();
    const c = th.content; const f = th.font;
    const pts = sl.points || [];
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:'100%',h:'100%',fill:{color:'FFFFFF'}});
    // 左侧深色
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:4.2,h:'100%',fill:{color:'0E2841'}});
    // 左侧强调线
    s.addShape(pptx.ShapeType.rect, {x:4.16,y:0,w:0.06,h:'100%',fill:{color:'1C4AFF'}});
    // 左侧标题
    s.addText(sl.title||'', {x:0.4,y:1.6,w:3.4,h:2.0,
      fontSize:24,bold:true,color:'FFFFFF',fontFace:f.title,align:'left',valign:'top',wrap:true});
    // 装饰线
    s.addShape(pptx.ShapeType.rect, {x:0.4,y:3.7,w:0.5,h:0.05,fill:{color:'1C4AFF'}});
    // 副标题
    if(sl.subtitle) s.addText(sl.subtitle, {x:0.4,y:3.85,w:3.4,h:1.2,
      fontSize:12,color:'FFFFFF',fontFace:f.body,align:'left',valign:'top',wrap:true,transparency:35});
    // 右侧要点
    const startY = 0.9;
    const itemH = Math.min(1.0, (5.625-startY-0.3)/Math.max(pts.length,1));
    pts.forEach((pt,i) => {
      const y = startY + i * itemH;
      s.addShape(pptx.ShapeType.rect, {x:4.5,y:y+0.02,w:0.38,h:0.38,fill:{color:'1C4AFF'},rectRadius:0.04});
      s.addText(`0${i+1}`, {x:4.5,y:y+0.02,w:0.38,h:0.38,
        fontSize:11,bold:true,color:'FFFFFF',fontFace:f.body,align:'center',valign:'middle'});
      s.addText(pt, {x:5.0,y,w:7.8,h:itemH,
        fontSize:13,color:'333333',fontFace:f.body,align:'left',valign:'middle',wrap:true});
    });
  }
});


// ═══════════════════════════════════════════════
// CONTENT — 强调列表（Slide 6 变体）
// 左侧图片，右侧带序号强调的要点列表
// ═══════════════════════════════════════════════
LayoutEngine.register({
  id: 'content_list_accent',
  name: '内容·强调列表',
  desc: '右侧主色标题块+列表，左侧图片，适合5-6个要点',
  slots: ['title', 'subtitle', 'points'],

  buildHTML(sl, th, esc) {
    const c = th.content;
    const primary = th._primary || '#' + (th.cover?.accentColor || '1C4AFF');
    const dark = th._dark || '#0E2841';
    const accent = th._accent || primary;
    const t = esc(sl.title || '');
    const sub = esc(sl.subtitle || '');
    const pts = sl.points || [];
    return `
<div style="width:960px;height:540px;background:#fff;display:flex;overflow:hidden;font-family:'Microsoft YaHei',sans-serif;">
  <!-- 左侧图片区 -->
  <div style="width:400px;flex-shrink:0;background:linear-gradient(150deg,${dark},${primary});position:relative;">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:rgba(255,255,255,0.2);font-size:72px;font-weight:700;">IMG</div>
    <!-- 底部色条 -->
    <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:${accent};"></div>
  </div>
  <!-- 右侧内容 -->
  <div style="flex:1;display:flex;flex-direction:column;">
    <!-- 标题色块 -->
    <div style="background:${primary};padding:18px 28px;">
      <div style="font-size:20px;font-weight:700;color:#fff;">${t}</div>
      ${sub ? `<div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px;">${sub}</div>` : ''}
    </div>
    <!-- 要点列表 -->
    <div style="flex:1;padding:16px 24px;display:flex;flex-direction:column;justify-content:center;gap:10px;background:#f5f8ff;">
      ${pts.map((p,i) => `
        <div style="display:flex;gap:12px;align-items:flex-start;background:#fff;padding:10px 14px;border-radius:4px;border-left:3px solid ${primary};">
          <span style="font-size:11px;font-weight:700;color:${primary};flex-shrink:0;margin-top:1px;">0${i+1}</span>
          <span style="font-size:12px;color:#333;line-height:1.6;">${esc(p)}</span>
        </div>`).join('')}
    </div>
  </div>
</div>`;
  },

  buildPptx(pptx, sl, th) {
    const s = pptx.addSlide();
    const c = th.content; const f = th.font;
    const pts = sl.points || [];
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:'100%',h:'100%',fill:{color:'F5F8FF'}});
    // 左侧图片区
    s.addShape(pptx.ShapeType.rect, {x:0,y:0,w:4.2,h:'100%',fill:{color:'0E2841'}});
    s.addShape(pptx.ShapeType.rect, {x:0,y:5.5,w:4.2,h:0.125,fill:{color:'00AAFB'}});
    // 右侧标题色块
    s.addShape(pptx.ShapeType.rect, {x:4.2,y:0,w:9.133,h:1.35,fill:{color:'1C4AFF'}});
    s.addText(sl.title||'', {x:4.5,y:0.15,w:8.5,h:0.75,
      fontSize:18,bold:true,color:'FFFFFF',fontFace:f.title,align:'left',valign:'middle',wrap:true});
    if(sl.subtitle) s.addText(sl.subtitle, {x:4.5,y:0.92,w:8.5,h:0.35,
      fontSize:11,color:'FFFFFF',fontFace:f.body,transparency:25});
    // 要点
    const startY = 1.5;
    const itemH = Math.min(0.85, (5.625-startY-0.15)/Math.max(pts.length,1));
    pts.forEach((pt,i) => {
      const y = startY + i*itemH;
      s.addShape(pptx.ShapeType.rect, {x:4.3,y:y+0.04,w:8.8,h:itemH-0.08,
        fill:{color:'FFFFFF'},rectRadius:0.04});
      s.addShape(pptx.ShapeType.rect, {x:4.3,y:y+0.04,w:0.06,h:itemH-0.08,fill:{color:'1C4AFF'}});
      s.addText(`0${i+1}`, {x:4.45,y,w:0.45,h:itemH,
        fontSize:10,bold:true,color:'1C4AFF',fontFace:f.body,align:'center',valign:'middle'});
      s.addText(pt, {x:4.95,y,w:7.9,h:itemH,
        fontSize:12,color:'333333',fontFace:f.body,align:'left',valign:'middle',wrap:true});
    });
  }
});


// 导出
if (typeof module !== 'undefined') module.exports = { LayoutEngine };
if (typeof window !== 'undefined') window.LayoutEngine = LayoutEngine;
