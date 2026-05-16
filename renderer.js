/**
 * PptxRenderer — 将 SlideData[] + Theme → .pptx 文件
 * 依赖: PptxGenJS (全局 PptxGenJS 或 require('pptxgenjs'))
 */

const PptxRenderer = {
  /**
   * @param {SlideData[]} slides      来自 SlideParser.parse()
   * @param {object}      theme       来自 ThemeEngine.get()
   * @param {string}      fileName    输出文件名（不含扩展名）
   */
  async render(slides, theme, fileName = '演示文稿') {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';   // 16:9，宽 10" 高 5.625"

    for (const slide of slides) {
      switch (slide.type) {
        case 'cover':   this._cover(pptx, slide, theme);   break;
        case 'agenda':  this._agenda(pptx, slide, theme);  break;
        case 'section': this._section(pptx, slide, theme); break;
        case 'content': this._content(pptx, slide, theme); break;
        case 'end':     this._end(pptx, slide, theme);     break;
      }
    }

    await pptx.writeFile({ fileName: `${fileName}.pptx` });
  },

  // ── 封面 ────────────────────────────────────
  _cover(pptx, slide, theme) {
    const s = pptx.addSlide();
    const c = theme.cover;
    const f = theme.font;

    // 背景
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: c.bg }
    });

    // 底部装饰条（左对齐，宽度可配）
    s.addShape(pptx.ShapeType.rect, {
      x: c.accentX, y: c.accentY,
      w: c.accentW, h: c.accentH,
      fill: { color: c.accentColor }
    });

    // 主标题
    s.addText(slide.title, {
      x: 0.6, y: 1.5, w: 8.8, h: 1.4,
      fontSize: f.titleSize, bold: true,
      color: c.titleColor,
      fontFace: f.title,
      align: 'left', valign: 'middle',
      wrap: true
    });

    // 副标题
    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 0.6, y: 3.3, w: 8.0, h: 0.9,
        fontSize: f.subtitleSize,
        color: c.subtitleColor,
        fontFace: f.body,
        align: 'left', valign: 'top',
        wrap: true
      });
    }
  },

  // ── 目录 ────────────────────────────────────
  _agenda(pptx, slide, theme) {
    const s = pptx.addSlide();
    const c = theme.agenda;
    const f = theme.font;

    // 背景
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: c.bg }
    });

    // 顶栏
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 1.05,
      fill: { color: c.headerBg }
    });

    s.addText(slide.title, {
      x: 0.5, y: 0.12, w: 9, h: 0.8,
      fontSize: f.headingSize, bold: true,
      color: c.titleColor, fontFace: f.title,
      align: 'left', valign: 'middle'
    });

    // 目录项（两列布局）
    const items = slide.points || [];
    const cols = items.length > 4 ? 2 : 1;
    const perCol = Math.ceil(items.length / cols);
    const colW = cols === 2 ? 4.3 : 8.8;
    const startX = [0.5, 5.2];

    items.forEach((item, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const x = startX[col];
      const y = 1.3 + row * 0.82;

      // 序号圆圈
      s.addShape(pptx.ShapeType.rect, {
        x, y: y + 0.05,
        w: 0.4, h: 0.4,
        fill: { color: c.itemBorder },
        rectRadius: 0.05
      });
      s.addText(String(i + 1), {
        x, y: y + 0.05,
        w: 0.4, h: 0.4,
        fontSize: 12, bold: true, color: 'FFFFFF',
        fontFace: f.body, align: 'center', valign: 'middle'
      });

      // 文本
      s.addText(item, {
        x: x + 0.52, y,
        w: colW - 0.6, h: 0.5,
        fontSize: f.pointSize,
        color: c.itemText,
        fontFace: f.body,
        valign: 'middle', wrap: true
      });
    });
  },

  // ── 章节过渡页 ──────────────────────────────
  _section(pptx, slide, theme) {
    const s = pptx.addSlide();
    const c = theme.section || theme.cover;   // 兜底用 cover
    const f = theme.font;

    // 主背景
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: c.bg }
    });

    // 右侧装饰色块（半透明感用深色叠加模拟）
    s.addShape(pptx.ShapeType.rect, {
      x: 6.8, y: 0, w: 3.2, h: '100%',
      fill: { color: c.accentColor },
      transparency: 90          // 10% 不透明
    });

    // 右侧装饰圆圈
    s.addShape(pptx.ShapeType.ellipse, {
      x: 7.6, y: 1.5, w: 2.2, h: 2.2,
      fill: { type: 'none' },
      line: { color: c.accentColor, width: 2.5, transparency: 80 }
    });

    // 顶部强调线
    s.addShape(pptx.ShapeType.rect, {
      x: 0.6, y: 1.55, w: 0.7, h: 0.06,
      fill: { color: c.accentColor }
    });

    // "SECTION" 标签
    s.addText('SECTION', {
      x: 0.6, y: 1.72, w: 5, h: 0.35,
      fontSize: 11, bold: true,
      color: c.labelColor || c.accentColor,
      fontFace: f.body,
      align: 'left', charSpacing: 3
    });

    // 章节标题
    s.addText(slide.title, {
      x: 0.6, y: 2.15, w: 6.0, h: 1.6,
      fontSize: f.titleSize - 2, bold: true,
      color: c.titleColor,
      fontFace: f.title,
      align: 'left', valign: 'top',
      wrap: true
    });

    // 章节说明副标题
    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 0.6, y: 3.85, w: 6.0, h: 0.8,
        fontSize: f.subtitleSize - 1,
        color: c.subtitleColor,
        fontFace: f.body,
        align: 'left', valign: 'top',
        wrap: true
      });
    }
  },

  // ── 内容页 ───────────────────────────────────
  _content(pptx, slide, theme) {
    const s = pptx.addSlide();
    const c = theme.content;
    const f = theme.font;

    // 背景
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: c.bg }
    });

    // 顶栏
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 1.05,
      fill: { color: c.headerBg }
    });

    // 标题
    s.addText(slide.title, {
      x: 0.5, y: 0.12, w: 8.6, h: 0.8,
      fontSize: f.headingSize, bold: true,
      color: c.titleColor, fontFace: f.title,
      align: 'left', valign: 'middle', wrap: true
    });

    // 要点列表
    const points = slide.points || [];
    const totalH = 5.625 - 1.05 - 0.25;   // 可用高度
    const itemH = Math.min(0.9, totalH / Math.max(points.length, 1));

    points.forEach((pt, i) => {
      const y = 1.2 + i * itemH;
      this._renderBullet(s, pptx, {
        x: 0.5, y,
        bulletColor: c.bulletColor,
        bulletShape: c.bulletShape,
        text: pt,
        textColor: c.pointColor,
        fontSize: f.pointSize,
        fontFace: f.body,
        itemH
      });
    });
  },

  // ── 结尾 ────────────────────────────────────
  _end(pptx, slide, theme) {
    const s = pptx.addSlide();
    const c = theme.end;
    const f = theme.font;

    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: c.bg }
    });

    s.addText(slide.title, {
      x: 0.6, y: 1.6, w: 8.8, h: 1.3,
      fontSize: f.titleSize + 4, bold: true,
      color: c.titleColor, fontFace: f.title,
      align: 'left', valign: 'middle'
    });

    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 0.6, y: 3.1, w: 8.0, h: 0.8,
        fontSize: f.subtitleSize,
        color: c.subtitleColor, fontFace: f.body,
        align: 'left'
      });
    }
  },

  // ── 通用子方法：渲染 bullet ──────────────────
  _renderBullet(slide, pptx, opts) {
    const { x, y, bulletColor, bulletShape, text, textColor, fontSize, fontFace, itemH } = opts;
    const bSize = 0.28;
    const bY = y + (itemH - bSize) / 2;

    if (bulletShape === 'circle') {
      slide.addShape(pptx.ShapeType.ellipse, {
        x, y: bY, w: bSize, h: bSize,
        fill: { color: bulletColor }
      });
    } else if (bulletShape === 'line') {
      slide.addShape(pptx.ShapeType.rect, {
        x, y: y + itemH * 0.25,
        w: 0.06, h: itemH * 0.5,
        fill: { color: bulletColor }
      });
    } else {
      // rect (default)
      slide.addShape(pptx.ShapeType.rect, {
        x, y: bY, w: bSize, h: bSize,
        fill: { color: bulletColor },
        rectRadius: 0.04
      });
    }

    slide.addText(text, {
      x: x + 0.45, y,
      w: 8.8, h: itemH,
      fontSize, color: textColor,
      fontFace, valign: 'middle', wrap: true
    });
  }
};

if (typeof module !== 'undefined') module.exports = { PptxRenderer };
if (typeof window !== 'undefined') window.PptxRenderer = PptxRenderer;
