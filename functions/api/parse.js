/**
 * Cloudflare Pages Function — POST /api/parse
 * 文件路径约定：functions/api/parse.js → 自动映射到 /api/parse 路由
 * 环境变量 DEEPSEEK_API_KEY 在 Pages → Settings → Environment variables 里设置
 */

export async function onRequestPost(context) {
  const { request, env } = context;

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

  const { text, maxSlides = 18, maxContentSlides = 15, maxPoints = 4 } = body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'Missing text field' }),
      { status: 400, headers: corsHeaders }
    );
  }

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
- 内容页（type=content）数量：至少${maxContentSlides}页，充分覆盖文章所有要点；如果文章内容丰富，可以超过此数量，内容完整性优先，不要为了控制页数而合并不同议题或省略重要内容
- 封面、目录、结尾不计入上述内容页数量
- 每页要点数：${maxPoints}个以内
- 要点文字中禁止使用英文双引号（"），用中文引号（「」）代替

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
        max_tokens: 10000,
        temperature: 0.4,
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

  // 内容优先：不强制截断内容页，只设防刷硬顶（用户设定值的 2 倍）
  const hardCap = maxContentSlides * 2;
  let contentCount = 0;
  slides = slides.filter(sl => {
    if (sl.type !== 'content') return true;
    contentCount++;
    return contentCount <= hardCap;
  });
  if (slides[0]?.type !== 'cover') {
    slides.unshift({ type: 'cover', title: '演示文稿', subtitle: '' });
  }
  if (slides[slides.length - 1]?.type !== 'end') {
    slides.push({ type: 'end', title: '谢谢', subtitle: '感谢聆听' });
  }

  return new Response(
    JSON.stringify({ slides }),
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
