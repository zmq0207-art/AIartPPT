/**
 * SlideParser — 自研文本解析引擎
 * 无需任何 AI API，纯规则 + 启发式算法
 *
 * 架构：
 *   TextCleaner → StructureDetector → SectionSplitter → SlideBuilder → SlideOptimizer
 */

// ─────────────────────────────────────────────
// 1. TextCleaner  清洗原始输入
// ─────────────────────────────────────────────
const TextCleaner = {
  clean(raw) {
    return raw
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, '  ')
      .replace(/[ \u3000]+/g, ' ')       // 全角空格归一
      .replace(/\n{3,}/g, '\n\n')        // 多空行压缩为一个
      .replace(/^[ \t]+/gm, '')          // 行首空白
      .trim();
  }
};

// ─────────────────────────────────────────────
// 2. StructureDetector  判断文档结构类型
//    返回: 'markdown' | 'numbered' | 'plain' | 'mixed'
// ─────────────────────────────────────────────
const StructureDetector = {
  detect(text) {
    const lines = text.split('\n');
    let mdHeaders = 0, numberedLines = 0, bulletLines = 0, totalNonEmpty = 0;

    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      totalNonEmpty++;
      if (/^#{1,4}\s/.test(t)) mdHeaders++;
      if (/^[\d一二三四五六七八九十]+[\.、。]\s*\S/.test(t)) numberedLines++;
      if (/^[-*•▪▸◆◉]\s/.test(t)) bulletLines++;
    }

    if (mdHeaders >= 2) return 'markdown';
    if (numberedLines / totalNonEmpty > 0.25) return 'numbered';
    if (bulletLines / totalNonEmpty > 0.2) return 'bullet';
    return 'plain';
  }
};

// ─────────────────────────────────────────────
// 3. SectionSplitter  按结构切割成段落组
//    返回: Array<{ heading: string, body: string[] }>
// ─────────────────────────────────────────────
const SectionSplitter = {
  split(text, structureType) {
    switch (structureType) {
      case 'markdown':  return this._splitMarkdown(text);
      case 'numbered':  return this._splitNumbered(text);
      case 'bullet':    return this._splitBullet(text);
      default:          return this._splitPlain(text);
    }
  },

  _splitMarkdown(text) {
    const lines = text.split('\n');
    const sections = [];
    let current = null;

    for (const line of lines) {
      const t = line.trim();
      const h1 = t.match(/^#\s+(.+)/);
      const h2 = t.match(/^#{2,4}\s+(.+)/);
      const heading = h1 || h2;

      if (heading) {
        if (current) sections.push(current);
        current = { heading: heading[1].trim(), body: [] };
      } else if (current && t) {
        // 去掉 markdown 符号后加入正文
        current.body.push(t.replace(/^[-*•]\s*/, '').replace(/\*\*/g, ''));
      } else if (!current && t) {
        // 文档开头尚未遇到标题，归入全局导言
        if (!sections.length) {
          current = { heading: null, body: [t] };
        }
      }
    }
    if (current) sections.push(current);
    return sections.filter(s => s.heading || s.body.length);
  },

  _splitNumbered(text) {
    const lines = text.split('\n');
    const sections = [];
    let current = null;
    const headerRe = /^[\d一二三四五六七八九十]+[\.、。]\s*(.+)/;

    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const m = t.match(headerRe);
      if (m) {
        if (current) sections.push(current);
        current = { heading: m[1].trim(), body: [] };
      } else if (current) {
        current.body.push(t.replace(/^[-*•▸]\s*/, ''));
      }
    }
    if (current) sections.push(current);
    return sections;
  },

  _splitBullet(text) {
    // 把连续的 bullet 聚合为组，遇到较长独立行当做标题
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const sections = [];
    let current = null;

    for (const line of lines) {
      const isBullet = /^[-*•▪▸◆]\s/.test(line);
      if (!isBullet && line.length < 40) {
        // 短独立行 → 当作标题
        if (current) sections.push(current);
        current = { heading: line, body: [] };
      } else if (current) {
        current.body.push(line.replace(/^[-*•▪▸◆]\s*/, ''));
      } else {
        current = { heading: null, body: [line.replace(/^[-*•▪▸◆]\s*/, '')] };
      }
    }
    if (current) sections.push(current);
    return sections;
  },

  _splitPlain(text) {
    // 纯文本：按段落拆分，每段提取关键句
    const paragraphs = text.split(/\n\n+/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean);
    return paragraphs.map(p => ({
      heading: null,
      body: SentenceExtractor.extract(p, 4)
    }));
  }
};

// ─────────────────────────────────────────────
// 4. SentenceExtractor  从段落中提取关键句
// ─────────────────────────────────────────────
const SentenceExtractor = {
  extract(paragraph, maxLines = 4) {
    // 中英文断句
    const sentences = paragraph
      .split(/[。！？\.\!\?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 8);

    if (sentences.length <= maxLines) return sentences;

    // TF-简化版：优先含关键动词/数字/转折词的句子
    const scored = sentences.map(s => ({
      text: s,
      score: this._score(s)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxLines).map(s => s.text);
  },

  _score(sentence) {
    let score = 0;
    // 含数字（数据更有说服力）
    if (/\d/.test(sentence)) score += 3;
    // 含重要关键词
    const keywords = ['重要','关键','核心','主要','首先','其次','最终','因此','总结',
                      'key','important','result','conclusion','因为','所以','通过'];
    for (const kw of keywords) if (sentence.includes(kw)) score += 2;
    // 长度适中的句子更好（15-50字）
    if (sentence.length >= 15 && sentence.length <= 50) score += 2;
    // 太短或太长扣分
    if (sentence.length < 10) score -= 2;
    if (sentence.length > 80) score -= 1;
    return score;
  }
};

// ─────────────────────────────────────────────
// 5. TitleGenerator  为无标题段落生成标题
// ─────────────────────────────────────────────
const TitleGenerator = {
  // 用第一句话的核心词组作为标题
  fromBody(bodyLines, index) {
    if (!bodyLines.length) return `第 ${index + 1} 部分`;
    const first = bodyLines[0];
    // 截取前 20 字作为候选标题
    let candidate = first.replace(/^[-*•▸]\s*/, '').slice(0, 22).trim();
    // 如果有中文标点，截断到最近的标点
    const cutRe = /[，,：:；;]/;
    const m = candidate.match(cutRe);
    if (m && m.index > 5) candidate = candidate.slice(0, m.index);
    return candidate || `第 ${index + 1} 部分`;
  }
};

// ─────────────────────────────────────────────
// 6. SlideBuilder  将 sections 组装成幻灯片列表
// ─────────────────────────────────────────────
const SlideBuilder = {
  /**
   * @param {Array<{heading,body}>} sections
   * @param {object} options - { title, maxPointsPerSlide, maxSlides }
   * @returns {SlideData[]}
   */
  build(sections, options = {}) {
    const {
      documentTitle = '演示文稿',
      maxPointsPerSlide = 4,
      maxSlides = 12
    } = options;

    const slides = [];

    // ── 封面 ──
    slides.push({
      type: 'cover',
      title: documentTitle,
      subtitle: this._generateSubtitle(sections)
    });

    // ── 目录（超过3个章节才加）──
    const contentSections = sections.filter(s => s.heading && s.body.length > 0);
    if (contentSections.length >= 4) {
      slides.push({
        type: 'agenda',
        title: '目录',
        points: contentSections.slice(0, 6).map(s => s.heading)
      });
    }

    // ── 内容页 ──
    for (let i = 0; i < sections.length && slides.length < maxSlides - 1; i++) {
      const sec = sections[i];
      const heading = sec.heading || TitleGenerator.fromBody(sec.body, i);
      const points = sec.body.slice(0, maxPointsPerSlide);

      if (!points.length) continue;

      // 要点过多则拆页
      if (sec.body.length > maxPointsPerSlide * 1.5) {
        const chunks = this._chunk(sec.body, maxPointsPerSlide);
        chunks.forEach((chunk, ci) => {
          if (slides.length >= maxSlides - 1) return;
          slides.push({
            type: 'content',
            title: ci === 0 ? heading : `${heading}（续）`,
            points: chunk
          });
        });
      } else {
        slides.push({ type: 'content', title: heading, points });
      }
    }

    // ── 结尾 ──
    slides.push({ type: 'end', title: '谢谢', subtitle: documentTitle });

    return slides;
  },

  _generateSubtitle(sections) {
    // 用前3个章节标题拼成副标题
    const headings = sections.filter(s => s.heading).slice(0, 3).map(s => s.heading);
    if (headings.length >= 2) return headings.join(' · ');
    return new Date().getFullYear() + ' 年演示';
  },

  _chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }
};

// ─────────────────────────────────────────────
// 7. SlideOptimizer  后处理：截断过长文本、去重
// ─────────────────────────────────────────────
const SlideOptimizer = {
  optimize(slides) {
    return slides.map(slide => {
      if (slide.points) {
        slide.points = slide.points
          .filter((p, i, arr) => arr.indexOf(p) === i)   // 去重
          .map(p => this._truncate(p, 60));               // 截断
      }
      if (slide.title) slide.title = this._truncate(slide.title, 30);
      return slide;
    });
  },

  _truncate(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 1) + '…';
  }
};

// ─────────────────────────────────────────────
// 8. DocumentTitleExtractor  从文本提取文档主题
// ─────────────────────────────────────────────
const DocumentTitleExtractor = {
  extract(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // 优先取第一行 H1
    if (/^#\s+/.test(lines[0])) return lines[0].replace(/^#+\s+/, '');

    // 前5行里最短且不含标点的行
    const candidates = lines.slice(0, 5).filter(l => l.length >= 4 && l.length <= 30 && !/[,，。.！!]/.test(l));
    if (candidates.length) return candidates[0];

    // fallback: 前20字
    return lines[0]?.slice(0, 20) || '演示文稿';
  }
};

// ─────────────────────────────────────────────
// 9. 主入口  SlideParser.parse(rawText) → SlideData[]
// ─────────────────────────────────────────────
const SlideParser = {
  /**
   * 全流水线解析
   * @param {string} rawText
   * @param {object} options - { maxSlides, maxPointsPerSlide }
   * @returns {SlideData[]}
   */
  parse(rawText, options = {}) {
    const text = TextCleaner.clean(rawText);
    const structureType = StructureDetector.detect(text);
    const sections = SectionSplitter.split(text, structureType);
    const documentTitle = DocumentTitleExtractor.extract(text);

    const slides = SlideBuilder.build(sections, {
      documentTitle,
      maxSlides: options.maxSlides || 12,
      maxPointsPerSlide: options.maxPointsPerSlide || 4
    });

    return SlideOptimizer.optimize(slides);
  },

  // 暴露子模块，方便外部扩展
  modules: {
    TextCleaner,
    StructureDetector,
    SectionSplitter,
    SentenceExtractor,
    TitleGenerator,
    SlideBuilder,
    SlideOptimizer,
    DocumentTitleExtractor
  }
};

// CommonJS + ESM 双出口
if (typeof module !== 'undefined') module.exports = { SlideParser };
if (typeof window !== 'undefined') window.SlideParser = SlideParser;
