/**
 * SlideForge — Parser
 * AI 解析通过 /api/parse (Cloudflare Worker) 代理，Key 不暴露在前端
 */

// ── TextCleaner ──────────────────────────────────────────
const TextCleaner = {
  clean(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
};

// ── StructureDetector ────────────────────────────────────
const StructureDetector = {
  detect(text) {
    if (/^#{1,3}\s/m.test(text))                              return 'markdown';
    if (/^[一二三四五六七八九十]+[、．.]/m.test(text))          return 'numbered';
    if (/^[\d]+[.、]/m.test(text))                            return 'numbered';
    if (/^[-*•]\s/m.test(text))                               return 'bullet';
    return 'plain';
  }
};

// ── 本地降级解析（API 失败时兜底）────────────────────────
function parseLocal(text, maxSlides, maxPoints) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const slides = [];

  slides.push({
    type: 'cover',
    title: lines[0] || '演示文稿',
    subtitle: lines.slice(1, 4).find(l => l.length < 60) || ''
  });

  const headingRe = /^(#{1,3}\s+|[一二三四五六七八九十百]+[、．.]\s*|第[一二三四五六七八九十百\d]+[章节部分]\s*|\d+[.、]\s+)/;
  let cur = null;

  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    const isHeading = headingRe.test(l) ||
      (l.length < 35 && /[\u4e00-\u9fa5]{4,}/.test(l) && !/[，。；：,.、]$/.test(l));

    if (isHeading) {
      if (cur) slides.push(cur);
      cur = { type: 'content', title: l.replace(headingRe, '').trim() || l, points: [] };
    } else if (cur && l.length > 10 && cur.points.length < maxPoints) {
      cur.points.push(l.slice(0, 60));
    }
  }
  if (cur) slides.push(cur);

  // 章节太少则按段落强制分页
  if (slides.length < 4) {
    slides.splice(1);
    const paras = text.split(/\n{2,}/).filter(p => p.trim().length > 30);
    for (const para of paras.slice(0, maxSlides - 2)) {
      const sentences = para.split(/[。；\n]/).map(s => s.trim()).filter(s => s.length > 8);
      if (sentences.length > 0) {
        slides.push({
          type: 'content',
          title: sentences[0].slice(0, 28),
          points: sentences.slice(1, maxPoints + 1).map(s => s.slice(0, 55))
        });
      }
    }
  }

  slides.push({ type: 'end', title: '谢谢', subtitle: '感谢聆听' });
  return slides.slice(0, maxSlides);
}

// ── 对外统一接口 ─────────────────────────────────────────
const SlideParser = {
  // 同步降级接口（向后兼容）
  parse(text, opts = {}) {
    const { maxSlides = 12, maxPointsPerSlide = 4 } = opts;
    return parseLocal(text, maxSlides, maxPointsPerSlide);
  },

  // 异步 AI 接口：请求打到自己的 Worker，Key 在服务端
  async parseWithAI(text, opts = {}) {
    const { maxSlides = 12, maxPointsPerSlide = 4 } = opts;

    const resp = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, maxSlides, maxPoints: maxPointsPerSlide })
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || `请求失败 ${resp.status}`);
    }

    return data.slides;
  }
};
