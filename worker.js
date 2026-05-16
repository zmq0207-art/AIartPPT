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

  const prompt = `你是资深PPT顾问，擅长将文章提炼为专业演示稿。将以下文章解析为PPT幻灯片结构，输出纯JSON数组，不加任何说明或代码块标记。

【幻灯片类型说明】
- cover（封面）：主标题简洁有力，副标题说明场合/作者/日期/一句核心概括
- agenda（目录）：仅在文章有3个以上明确章节时使用，出现一次，章节名要是"议题"而非标签
- content（内容页）：每页聚焦一个明确议题，不要把不相关内容堆在一页
- end（结尾）：行动号召、总结金句或致谢，简短有力

【content页subtitle字段——必须填写】
每张content页必须有subtitle字段，是本页的"核心论点"：
用一句话（20-40字）说明这页要证明什么或传达什么，读者看完subtitle就能抓住本页重心，要点是支撑论点的证据。

【content页要点写法——最重要】
每个要点必须做到以下之一，严禁只写概念词：
① 数据支撑型：具体指标 + 数值 + 与基准的对比（如"错误率从12%降至1.3%，节省人工60%"）
② 对比说明型：传统方式是X，新方法是Y，差异在于Z
③ 因果逻辑型：因为X，导致Y，具体表现为Z
④ 例证型：以XX为例，具体做了什么，结果是什么
⑤ 步骤操作型：第一步做X，关键在于Y，最终达成Z
每个要点25-50字，必须能脱离标题独立理解。

禁止出现的写法：
✗ "提高工作效率" → ✓ "引入自动化后日处理量从800件升至3200件，人力减少40%"
✗ "市场机会广阔" → ✓ "国内市场2024年规模达480亿，渗透率仅11%，头部格局尚未形成"

【分页逻辑】
- 一个主题下有多个子议题时，宁可拆成2页也不要堆在1页
- 每页3-4个要点最佳，超过4个必须拆页，第二页标题加"（续）"或换角度命名
- 相邻页要有逻辑递进，不要跳跃
- 严格保留文章原有数据、案例、专有名词，不要编造

【约束】
- 总幻灯片数：${maxSlides}张以内
- 每页要点数：${maxPoints}个以内

【JSON格式示例】
[
  {"type":"cover","title":"简洁有力的主标题","subtitle":"副标题/作者/场合/日期"},
  {"type":"agenda","title":"本次分享结构","points":["一、为什么现在必须做","二、主要挑战在哪里","三、三步落地路径"]},
  {"type":"content","title":"当前面临的核心挑战","subtitle":"三重压力叠加，传统模式已无法支撑业务增长","points":["成本压力：原材料涨价23%，人工成本5年翻倍，毛利率从35%压缩至18%","效率瓶颈：订单处理仍依赖人工录入，平均响应时间4.2小时，竞对已实现分钟级","客户流失：2023年净流失率8.3%，主因交付不稳定，投诉中62%与此相关"]},
  {"type":"end","title":"立即行动","subtitle":"每推迟一个月，损失的市场窗口期无法追回"}
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
        temperature: 0.4,
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

  const prompt = `你是资深PPT内容创作专家，服务于咨询公司、企业高管和行业峰会。根据以下主题创作一份专业PPT，输出纯JSON数组，不加任何说明或代码块标记。

主题：${topic.slice(0, 200)}

【创作原则——金字塔结构】
1. 封面：主标题是核心结论或最有冲击力的观点，不是主题的简单复述
2. 目录：每个章节名要是"议题"而非"标签"，如"为什么现在必须转型"而非"背景介绍"
3. 内容页：每页有明确的subtitle论点，要点是支撑论点的论据
4. 结尾：行动号召或核心金句，让观众带着明确指令离场

【内容深度要求】
围绕主题必须覆盖以下维度（按逻辑顺序展开）：
- 现状/背景：数据量化当前规模或问题严重程度
- 原因/驱动力：3-5个具体的结构性原因，不是"时代变化"这种泛泛表述
- 挑战/痛点：具体场景下的具体困难，带数据或案例
- 解决方案/机会：可操作的路径，分阶段或分维度展开
- 结论/行动：明确的下一步建议

【content页subtitle字段——必须填写】
每张content页必须有subtitle字段，格式："核心论点 + 为什么重要/程度有多大"
示例："技术成本已不再是主要障碍，组织能力和执行意愿才是关键分水岭"

【要点写法标准——核心要求】
每个要点必须是"有信息量的完整表述"，做到以下之一：
① 数据支撑：具体指标 + 数值 + 与基准对比
② 机制说明：什么原因 → 导致什么结果 → 影响什么
③ 对比结构：旧方式 vs 新方式，差异在哪，优势多大
④ 场景例证：在XX场景下，XX做了XX，结果是XX
⑤ 趋势判断：XX正在发生，速度是XX，拐点在XX
每个要点25-50字。

禁止出现的写法：
✗ "提高工作效率" → ✓ "引入自动化流程后，日处理量从800件→3200件，人力减少40%"
✗ "市场机会广阔" → ✓ "中国市场2024年规模达480亿，渗透率仅11%，头部玩家尚未形成"
✗ "加强团队协作" → ✓ "跨部门项目引入周同步机制后，决策延迟从平均9天降至2天"

【分页与结构规则】
- 总张数：${maxSlides}张以内（含封面结尾）
- 每页要点：${maxPoints}个以内，建议3-4个
- 一个议题要点超过4个时必须拆成两页，第二页标题加"（续）"或换角度命名
- 章节逻辑递进：为什么（背景）→ 是什么（现状）→ 怎么做（方案）→ 怎么看（展望）
- 如内容有明显章节，在开头加一张agenda目录页

【JSON格式示例】
[
  {"type":"cover","title":"核心结论式标题","subtitle":"场合定位或补充说明"},
  {"type":"agenda","title":"本次分享结构","points":["一、为什么现在必须做","二、主要挑战在哪里","三、三步落地路径","四、预期成果与行动建议"]},
  {"type":"content","title":"市场已进入临界点","subtitle":"渗透率突破15%意味着增长逻辑将从教育市场转向争夺存量","points":["规模拐点：2024年用户数突破2.1亿，同比+67%，增速首次超过移动互联网同期水平","竞争格局：TOP5玩家合计占据73%市场份额，新进入者窗口期不超过18个月","用户行为变化：复购率从31%升至58%，说明产品已从尝鲜转向依赖，LTV测算逻辑需重建"]},
  {"type":"end","title":"现在开始，还不晚","subtitle":"未来12个月是建立壁垒的最后窗口"}
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
        temperature: 0.6,
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
