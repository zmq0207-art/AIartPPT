/**
 * Cloudflare Pages Function — POST /api/parse
 * 文件路径约定：functions/api/parse.js → 自动映射到 /api/parse 路由
 * 环境变量 DEEPSEEK_API_KEY 在 Pages → Settings → Environment variables 里设置
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration: missing API key' }),
      { status: 500, headers: corsHeaders }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { text, maxSlides = 12, maxPoints = 4 } = body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'Missing text field' }),
      { status: 400, headers: corsHeaders }
    );
  }

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
    return new Response(
      JSON.stringify({ error: '请求DeepSeek失败: ' + e.message }),
      { status: 502, headers: corsHeaders }
    );
  }

  if (!dsResp.ok) {
    const errBody = await dsResp.json().catch(() => ({}));
    return new Response(
      JSON.stringify({ error: errBody.error?.message || `DeepSeek返回 ${dsResp.status}` }),
      { status: 502, headers: corsHeaders }
    );
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
    return new Response(
      JSON.stringify({ error: 'AI返回格式解析失败，请重试' }),
      { status: 502, headers: corsHeaders }
    );
  }

  if (!Array.isArray(slides) || slides.length === 0) {
    return new Response(
      JSON.stringify({ error: 'AI未返回有效幻灯片数据' }),
      { status: 502, headers: corsHeaders }
    );
  }

  if (slides[0]?.type !== 'cover') {
    slides.unshift({ type: 'cover', title: '演示文稿', subtitle: '' });
  }
  if (slides[slides.length - 1]?.type !== 'end') {
    slides.push({ type: 'end', title: '谢谢', subtitle: '感谢聆听' });
  }

  return new Response(
    JSON.stringify({ slides: slides.slice(0, maxSlides) }),
    { status: 200, headers: corsHeaders }
  );
}

// OPTIONS 预检
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
