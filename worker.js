/**
 * SlideForge — Cloudflare Worker
 *
 * 路由：
 *   POST /api/parse    → 文章文本解析为幻灯片，Key 存在环境变量 DEEPSEEK_API_KEY
 *   POST /api/generate → 根据一句话主题创作幻灯片内容
 *   其他               → 交给 Assets 静态托管（index.html / parser.js 等）
 *
 * 部署后在 Cloudflare Dashboard → Workers → aiartppt → Settings → Variables
 * 添加环境变量：DEEPSEEK_API_KEY = sk-xxxxxxxxxxxx
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── 拦截 /api/parse（POST + OPTIONS 预检）────────────
    if (url.pathname === '/api/parse') {
      return handleParse(request, env);
    }

    // ── 拦截 /api/generate（主题生成）───────────────────
    if (url.pathname === '/api/generate') {
      return handleGenerate(request, env);
    }

    // ── 屏蔽 worker.js 直接访问 ──────────────────────────
    if (url.pathname === '/worker.js') {
      return new Response('Not Found', { status: 404 });
    }

    // ── 其他请求交给静态资源 ──────────────────────────────
    return env.ASSETS.fetch(request);
  }
};

// ── /api/parse 处理 ───────────────────────────────────────
async function handleParse(request, env) {
  // CORS 预检（浏览器跨域时会先发 OPTIONS）
  if (request.method === 'OPTIONS') {
    return corsResponse(null, 204);
  }

  // 只允许 POST
  if (request.method !== 'POST') {
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return corsResponse({ error: 'Server misconfiguration: missing API key' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { text, maxSlides = 12, maxPoints = 4 } = body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return corsResponse({ error: 'Missing text field' }, 400);
  }

  // 限制文本长度，避免超出 token 限制
  const trimmedText = text.slice(0, 12000);

  const prompt = `你是专业PPT大纲生成助手。将以下文章解析为PPT幻灯片结构，严格输出JSON数组，不要任何其他内容、不要markdown代码块。

规则：
- 最多 ${maxSlides} 张幻灯片
- 每张内容页最多 ${maxPoints} 个要点，每个要点≤30字
- 必须有封面（cover）和结尾（end）
- 有明显章节时加目录页（agenda），agenda只在开头出现一次
- 要点精炼提取核心，禁止照抄原文超过15字

JSON格式：
[
  {"type":"cover","title":"主标题","subtitle":"副标题/作者/日期"},
  {"type":"agenda","title":"目录","points":["章节1","章节2","章节3"]},
  {"type":"content","title":"页面标题","points":["要点1","要点2","要点3"]},
  {"type":"end","title":"谢谢","subtitle":"感谢聆听"}
]

文章内容：
${trimmedText}`;

  let dsResp;
  try {
    dsResp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 4096,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      })
    });
  } catch (e) {
    return corsResponse({ error: '请求DeepSeek失败: ' + e.message }, 502);
  }

  if (!dsResp.ok) {
    const errBody = await dsResp.json().catch(() => ({}));
    return corsResponse({
      error: errBody.error?.message || `DeepSeek返回 ${dsResp.status}`
    }, 502);
  }

  const dsData = await dsResp.json();
  const rawContent = dsData.choices?.[0]?.message?.content || '';

  // 提取 JSON（兼容 AI 偶尔加 markdown 代码块的情况）
  const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                rawContent.match(/(\[[\s\S]*\])/);
  const jsonStr = match ? match[1] : rawContent;

  let slides;
  try {
    slides = JSON.parse(jsonStr.trim());
  } catch {
    return corsResponse({ error: 'AI返回格式解析失败，请重试' }, 502);
  }

  if (!Array.isArray(slides) || slides.length === 0) {
    return corsResponse({ error: 'AI未返回有效幻灯片数据' }, 502);
  }

  // 保证首尾完整
  if (slides[0]?.type !== 'cover') {
    slides.unshift({ type: 'cover', title: '演示文稿', subtitle: '' });
  }
  if (slides[slides.length - 1]?.type !== 'end') {
    slides.push({ type: 'end', title: '谢谢', subtitle: '感谢聆听' });
  }

  return corsResponse({ slides: slides.slice(0, maxSlides) }, 200);
}

// ── /api/generate 处理（SSE 流式推送，主题 → PPT）──────
async function handleGenerate(request, env) {
  if (request.method === 'OPTIONS') {
    return corsResponse(null, 204);
  }
  if (request.method !== 'POST') {
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return corsResponse({ error: 'Server misconfiguration: missing API key' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { topic, maxSlides = 12, maxPoints = 4 } = body;
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return corsResponse({ error: 'Missing topic field' }, 400);
  }

  const prompt = `你是专业PPT内容创作助手。根据以下主题，创作一份完整的PPT幻灯片内容，严格输出JSON数组，不要任何其他内容、不要markdown代码块。

主题：${topic.slice(0, 200)}

规则：
- 最多 ${maxSlides} 张幻灯片（含封面和结尾）
- 每张内容页最多 ${maxPoints} 个要点，每个要点≤30字，言简意赅
- 必须有封面（cover）和结尾（end）
- 内容页数量合理（建议5-10张），章节清晰、逻辑递进
- 如果内容有明显章节，在开头加一张目录页（agenda）
- 内容要专业、有深度，避免空泛

JSON格式：
[
  {"type":"cover","title":"PPT主标题","subtitle":"副标题或一句核心概括"},
  {"type":"agenda","title":"目录","points":["章节1","章节2","章节3"]},
  {"type":"content","title":"章节标题","points":["核心要点1","核心要点2","核心要点3"]},
  {"type":"end","title":"谢谢","subtitle":"感谢聆听"}
]`;

  let dsResp;
  try {
    dsResp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 4096,
        temperature: 0.7,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });
  } catch (e) {
    return corsResponse({ error: '请求DeepSeek失败: ' + e.message }, 502);
  }

  if (!dsResp.ok) {
    const errBody = await dsResp.json().catch(() => ({}));
    return corsResponse({
      error: errBody.error?.message || `DeepSeek返回 ${dsResp.status}`
    }, 502);
  }

  // ── SSE 流式透传给前端 ────────────────────────────────
  const sseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  };

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  // 后台异步读取 DeepSeek 流，写入 SSE
  (async () => {
    let fullText = '';
    const reader = dsResp.body.getReader();
    const dec = new TextDecoder();
    let lineBuffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 追加到行缓冲，确保跨 chunk 的行能完整处理
        lineBuffer += dec.decode(value, { stream: true });

        // 按双换行切分（SSE 标准分隔符），保留未完成的部分
        const parts = lineBuffer.split('\n\n');
        lineBuffer = parts.pop(); // 最后一段可能不完整，留待下次

        for (const part of parts) {
          for (const line of part.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;

            let parsed;
            try { parsed = JSON.parse(payload); } catch { continue; }

            const token = parsed.choices?.[0]?.delta?.content || '';
            if (!token) continue;

            fullText += token;

            // 推给前端
            await writer.write(enc.encode(`data: ${JSON.stringify({ token })}\n\n`));
          }
        }
      }

      // 处理缓冲区剩余内容
      if (lineBuffer.trim()) {
        for (const line of lineBuffer.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          let parsed;
          try { parsed = JSON.parse(payload); } catch { continue; }
          const token = parsed.choices?.[0]?.delta?.content || '';
          if (token) fullText += token;
        }
      }

      // 流结束后解析完整 JSON
      // 先尝试提取 markdown 代码块，再尝试提取 [...] 数组
      let jsonStr = fullText;
      const mdMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) {
        jsonStr = mdMatch[1];
      } else {
        // 找到第一个 [ 和最后一个 ] 之间的内容
        const start = fullText.indexOf('[');
        const end = fullText.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
          jsonStr = fullText.slice(start, end + 1);
        }
      }

      let slides;
      try {
        slides = JSON.parse(jsonStr.trim());
      } catch {
        // 尝试修复常见问题：去掉末尾不完整的对象
        try {
          const lastComma = jsonStr.lastIndexOf(',');
          const fixedStr = jsonStr.slice(0, lastComma) + ']';
          slides = JSON.parse(fixedStr);
        } catch {
          await writer.write(enc.encode(`data: ${JSON.stringify({ error: 'AI返回格式解析失败，请重试' })}\n\n`));
          return;
        }
      }

      if (!Array.isArray(slides) || slides.length === 0) {
        await writer.write(enc.encode(`data: ${JSON.stringify({ error: 'AI未返回有效幻灯片数据' })}\n\n`));
        return;
      }

      if (slides[0]?.type !== 'cover') {
        slides.unshift({ type: 'cover', title: topic, subtitle: '' });
      }
      if (slides[slides.length - 1]?.type !== 'end') {
        slides.push({ type: 'end', title: '谢谢', subtitle: '感谢聆听' });
      }

      await writer.write(enc.encode(`data: ${JSON.stringify({ slides: slides.slice(0, maxSlides) })}\n\n`));
    } catch (e) {
      await writer.write(enc.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, { status: 200, headers: sseHeaders });
}

// ── CORS 工具 ─────────────────────────────────────────────
function corsResponse(data, status) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  return new Response(
    data !== null ? JSON.stringify(data) : null,
    { status, headers }
  );
}
