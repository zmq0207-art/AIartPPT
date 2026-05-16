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

// ── /api/generate 处理（根据主题创作 PPT 内容）─────────
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

  if (slides[0]?.type !== 'cover') {
    slides.unshift({ type: 'cover', title: topic, subtitle: '' });
  }
  if (slides[slides.length - 1]?.type !== 'end') {
    slides.push({ type: 'end', title: '谢谢', subtitle: '感谢聆听' });
  }

  return corsResponse({ slides: slides.slice(0, maxSlides) }, 200);
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
