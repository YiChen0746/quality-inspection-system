// 多智能体合同审查引擎
// 借鉴 FMARLJP（Knowledge-Based Systems 2026）的三项核心思想，适配到合同质检场景：
//   1) “核心角色—元角色”分层协作：审判组 / 委托方组 / 相对方组，每组拆成 3 个细粒度元角色；
//   2) 基于辩论演化的动态知识检索：法条检索元角色每轮根据上一轮检索结果与最新辩论重写查询式；
//   3) 全链条终审精炼：终审法官复核残余争议，输出“要素—结论”映射和结构化审查结论。
const express = require('express');
const axios = require('axios');
const { Contract, QualityResult } = require('../models');
const { retrieveKnowledge, loadKnowledgeSources, inferContractCategory } = require('../utils/knowledge-service');

const router = express.Router();

// 通用 OpenAI 兼容配置（智谱 GLM / DeepSeek / 硅基流动 / 本地 Ollama 均可）
const LLM_BASE = process.env.LLM_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const LLM_KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';

// ==================== 元角色定义（细粒度角色解耦） ====================
const META_ROLES = {
  judgeFocus: { name: 'JudgeFocus', label: '审判长·争议焦点确认', group: 'judge' },
  judgeDebate: { name: 'JudgeDebate', label: '审判长·庭审主持', group: 'judge' },
  judgeVerdict: { name: 'JudgeVerdict', label: '审判长·终审裁决', group: 'judge' },
  partyALead: { name: 'PartyALead', label: '委托方·首席主张', group: 'partyA' },
  partyAEvidence: { name: 'PartyAEvidence', label: '委托方·条款证据审查', group: 'partyA' },
  partyALegal: { name: 'PartyALegal', label: '委托方·法律检索', group: 'partyA' },
  partyBLead: { name: 'PartyBLead', label: '相对方·首席抗辩', group: 'partyB' },
  partyBEvidence: { name: 'PartyBEvidence', label: '相对方·条款证据审查', group: 'partyB' },
  partyBLegal: { name: 'PartyBLegal', label: '相对方·法律检索', group: 'partyB' },
  historySage: { name: 'HistorySage', label: '历史洞察·经验总结', group: 'sage' }
};

// 每个元角色只关注自己的职责，避免“全能角色”造成的注意力分散（论文的核心动机）
const PROMPTS = {
  judgeFocus:
    '你在模拟法庭中担任【JudgeFocus｜争议焦点确认】子角色。你只负责从合同文本中识别最需要在审查中辩论的争议焦点，不给出最终裁判结论，也不做全文泛泛评价。' +
    '要求：1) 输出2-3个焦点；2) 每个焦点必须指向具体条款或具体权利义务；3) 按风险严重程度排序；4) 只输出JSON，不要markdown代码块。' +
    'JSON格式：{"focuses":[{"title":"焦点标题","reason":"为什么成为焦点","severity":"高|中|低","relatedClauses":["相关条款摘要"]}]}',

  partyALead:
    '你是【PartyALead｜委托方首席代理】。委托方在本合同中为甲方。你只从甲方立场提出主张、诉求和谈判底线，聚焦当前争议焦点。' +
    '不引用具体法条编号，不作裁判，不评价对方人格。要求：中文，120字以内，观点鲜明，直接输出论证文本。',

  partyAEvidence:
    '你是【PartyAEvidence｜委托方条款证据审查】。你只负责从合同具体条款中构建事实与条款证据链，指出对甲方不利、缺失、模糊或前后矛盾的约定。' +
    '不引用具体法条编号，不作裁判。要求：中文，120字以内，尽量引用条款原文，直接输出文本。',

  partyALegal:
    '你是【PartyALegal｜委托方法律检索】。你只负责把当前争议焦点和甲方论点转写为一条精准的法律检索式，并说明检索意图，不展开论证。' +
    '检索式需包含：合同类型、法律主题词、行为要件。只输出JSON：{"query":"检索式","intent":"检索意图"}',

  partyBLead:
    '你是【PartyBLead｜相对方首席抗辩】。相对方在本合同中为乙方。你只从乙方立场提出抗辩、免责或减轻责任的理由，聚焦当前争议焦点。' +
    '不引用具体法条编号，不作裁判。要求：中文，120字以内，直接输出论证文本。',

  partyBEvidence:
    '你是【PartyBEvidence｜相对方条款证据审查】。你只负责从合同具体条款中挑出对乙方有利的解释、以及甲方主张缺乏条款或事实支撑的地方。' +
    '不引用具体法条编号，不作裁判。要求：中文，120字以内，尽量引用条款原文，直接输出文本。',

  partyBLegal:
    '你是【PartyBLegal｜相对方法律检索】。你只负责把当前争议焦点和乙方抗辩转写为一条精准的法律检索式，并说明检索意图，不展开论证。' +
    '检索式需包含：合同类型、法律主题词、抗辩要件。只输出JSON：{"query":"检索式","intent":"检索意图"}',

  judgeDebate:
    '你是【JudgeDebate｜庭审主持】。你负责归纳第一轮辩论：双方无争议点、仍未解决的争议点、下一步需要补充检索的问题。不作最终裁判。' +
    '只输出JSON：{"agreed":["..."],"residual":[{"title":"未决争议","question":"需要回答的问题","reason":"未决原因"}],"nextQueries":["补充检索式"]}',

  partyARebuttal:
    '你是【PartyALead｜委托方首席代理】。现在进入第二轮焦点攻坚。你已看到第一轮对方观点和检索到的法律依据。' +
    '请针对未决争议作针对性回应，指出对方论证漏洞，并给出可执行的合同修改建议。中文120字以内，直接输出文本。',

  partyBRebuttal:
    '你是【PartyBLead｜相对方首席抗辩】。现在进入第二轮焦点攻坚。你已看到第一轮对方观点和检索到的法律依据。' +
    '请针对未决争议作针对性回应，指出甲方主张的漏洞，并说明乙方可接受的修改边界。中文120字以内，直接输出文本。',

  partyALegalRefine:
    '你是【PartyALegal｜委托方法律检索】。现在进行第二轮检索式重写。请基于：上一轮检索式、上一轮检索到的法条、最新辩论内容、未决争议，' +
    '重写一条更精准、更细化的检索式（必须递进，不得重复上一轮）。只输出JSON：{"query":"新检索式","intent":"检索意图","refinedFrom":"上一轮检索式"}',

  partyBLegalRefine:
    '你是【PartyBLegal｜相对方法律检索】。现在进行第二轮检索式重写。请基于：上一轮检索式、上一轮检索到的法条、最新辩论内容、未决争议，' +
    '从乙方抗辩角度重写一条更精准的检索式（必须递进，不得重复上一轮）。只输出JSON：{"query":"新检索式","intent":"检索意图","refinedFrom":"上一轮检索式"}',

  judgeVerdict:
    '你是【JudgeVerdict｜终审法官】。你负责全链条复核并输出最终合同审查结论。要求：' +
    '1) 对两轮辩论中未达成一致的残余争议逐项说明处理方式；' +
    '2) 做“要素—结论”映射：合同要素 / 事实或条款依据 / 法律依据 / 结论；' +
    '3) 评分0-100，分数越高风险越大；等级为低/中/高；' +
    '4) 每条风险必须给出条款位置、风险说明、法律依据、修改建议；' +
    '5) 只输出JSON，不要markdown代码块。' +
    'JSON格式：{"score":75,"level":"中","summary":"总体结论","findings":[{"clause":"条款位置","risk":"风险说明","level":"高|中|低","basis":"法律依据","suggestion":"修改建议"}],' +
    '"factorConclusion":[{"factor":"合同要素","evidence":"条款或事实依据","basis":"法律依据","conclusion":"结论"}],' +
    '"residualDisputes":[{"title":"残余争议","handling":"处理方式"}],"historyWarnings":["用户历史高频风险提醒..."],"disclaimer":"免责说明"}'
  ,historySage:
    '你是【HistorySage｜历史洞察者】。你需要从用户过往的合同审查历史记录中，' +
    '归纳总结出这个用户在合同起草和审查中的常见问题模式。' +
    '请从提供的历史审查记录中识别：' +
    '1) 这个用户最容易遗漏的合同要素或必备条款（commonOmissions，4-8条）；' +
    '2) 这个用户合同中反复出现的结构性不足或模糊约定（commonDeficiencies，4-8条）；' +
    '3) 针对当前用户合同习惯的个性化风险提醒和注意事项（reminders，3-6条，要具体可执行）；' +
    '4) 历史高频风险类型的统计（frequentRiskTypes：[{"type":"风险类别","count":出现次数}]）；' +
    '5) 历史合同整体风险等级分布（riskLevelDist：{low:n, mid:n, high:n}）；' +
    '所有结论必须基于提供的历史记录内容，不得编造不存在的模式。' +
    '只输出JSON，不要markdown代码块。' +
    'JSON格式：{"commonOmissions":["..."],"commonDeficiencies":["..."],"reminders":["..."],"frequentRiskTypes":[],"riskLevelDist":{"low":0,"mid":0,"high":0}}'

};

// ==================== 基础工具 ====================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 兼容模型输出 ```json 代码块、前后夹杂解释文字的情况
function parseJson(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(s);
  } catch (e) {
    // 继续尝试截取
  }
  const start = s.search(/[\{\[]/);
  if (start === -1) return null;
  const openChar = s[start];
  const closeChar = openChar === '{' ? '}' : ']';
  const end = s.lastIndexOf(closeChar);
  if (end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

// 单次大模型调用（带一次重试；失败返回 null，主流程降级继续）
async function callLLM(systemPrompt, userPrompt, options = {}) {
  const { temperature = 0.3, maxTokens = 1000, retry = 1 } = options;

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const resp = await axios.post(
        `${LLM_BASE}/chat/completions`,
        {
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature,
          max_tokens: maxTokens,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LLM_KEY}`
          },
          timeout: 90000
        }
      );
      const content = resp.data?.choices?.[0]?.message?.content;
      if (content && String(content).trim()) return String(content).trim();
      return null;
    } catch (error) {
      const status = error?.response?.status;
      console.error(`[multi-agent] 调用失败 (attempt ${attempt + 1}):`, status || '', error.message);
      // 429 限流 / 5xx 服务端错误时等待后重试一次
      if (attempt < retry && (status === 429 || (status >= 500 && status < 600) || !status)) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      return null;
    }
  }
  return null;
}

// 过程事件推送：有 emit 时才推送，任何推送异常都不影响主流程
function trace(ctx, type, data) {
  if (!ctx || typeof ctx.emit !== 'function') return;
  try {
    ctx.emit(type, data);
  } catch (e) {
    // 推送失败只记录，不中断审查
    console.warn('庭审事件推送失败:', e.message);
  }
}

function roleMeta(roleKey, options) {
  const role = META_ROLES[roleKey] || {};
  return {
    role: roleKey,
    label: role.label || roleKey,
    group: role.group || 'judge',
    round: options.round || 0,
    focus: options.focus || ''
  };
}

// 调用某个元角色，统一记录调用统计；同时推送“开始发言/发言结束”事件供前端做实时庭审动画
async function callRole(ctx, roleKey, userPrompt, options = {}) {
  const meta = roleMeta(roleKey, options);
  trace(ctx, 'agent:start', meta);
  const content = await callLLM(PROMPTS[roleKey], userPrompt, options);
  ctx.calls += 1;
  if (!content) ctx.failedCalls += 1;
  trace(ctx, 'agent:speech', Object.assign({}, meta, {
    text: content || '',
    isLegal: /Legal|Refine/.test(roleKey),
    isJudge: meta.group === 'judge'
  }));
  return content;
}

function clip(text, max = 8000) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max) : s;
}

// 去除检索结果中的重复法条
function mergeKnowledge(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const item of list || []) {
      if (!map.has(item.id) || map.get(item.id).score < item.score) {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

// 全局去噪：合并多轮检索结果后，按相对相关度裁剪，避免知识列表过长
function pruneKnowledge(items, maxItems = 8) {
  if (!items || !items.length) return [];
  const topScore = items[0].score || 0;
  const GENERIC_CATEGORIES = new Set(['合同通则', '担保']);
  return items
    .filter((item) => {
      if (item.type === 'history' || item.type === 'template') {
        return (item.score || 0) >= topScore * 0.35;
      }
      const ratio = GENERIC_CATEGORIES.has(item.category) ? 0.8 : 0.5;
      return (item.score || 0) >= topScore * ratio;
    })
    .slice(0, maxItems);
}

function formatKnowledge(items) {
  if (!items || !items.length) return '（本轮未检索到相关知识）';
  return items
    .map((item, i) => {
      const typeLabel = item.type === 'history' ? '历史案例' : item.type === 'template' ? '标准模板' : '法规';
      const meta = [item.source, item.effectiveDate ? `${item.effectiveDate} 施行` : '']
        .filter(Boolean)
        .join('，');
      return `${i + 1}. 【${typeLabel}】${item.title}（${item.category}${meta ? '；' + meta : ''}）：${item.content}`;
    })
    .join('\n');
}

// ==================== 审查流程 ====================
// 阶段一：争议焦点识别
async function identifyFocuses(ctx, contractName, content) {
  const userPrompt =
    `合同名称：${contractName || '未命名合同'}\n` +
    `请从以下合同文本中识别2-3个最关键的争议焦点：\n\n${clip(content)}`;

  const raw = await callRole(ctx, 'judgeFocus', userPrompt, { maxTokens: 900, round: 0, focus: '争议焦点识别' });
  const parsed = parseJson(raw);
  let focuses = parsed && Array.isArray(parsed.focuses) ? parsed.focuses : [];

  focuses = focuses
    .filter((f) => f && f.title)
    .slice(0, 2)
    .map((f, i) => ({
      id: `F${i + 1}`,
      title: String(f.title).slice(0, 120),
      reason: String(f.reason || '').slice(0, 300),
      severity: ['高', '中', '低'].includes(f.severity) ? f.severity : '中',
      relatedClauses: Array.isArray(f.relatedClauses) ? f.relatedClauses.slice(0, 3).map(String) : []
    }));

  // 模型失败或无有效输出时的兜底焦点，保证流程不中断
  if (!focuses.length) {
    focuses = [
      {
        id: 'F1',
        title: '合同核心权利义务与违约责任是否对等',
        reason: '模型焦点识别未返回有效结果，按合同审查通用重点降级处理',
        severity: '中',
        relatedClauses: []
      }
    ];
  }

  trace(ctx, 'focuses', focuses);
  return focuses;
}

// 第一轮：委托方组 / 相对方组各自三个元角色并行开庭
async function runFirstRound(ctx, contractName, content, focus) {
  const base =
    `合同名称：${contractName || '未命名合同'}\n` +
    `合同全文：\n${clip(content, 6000)}\n\n` +
    `本轮争议焦点：${focus.title}\n焦点说明：${focus.reason || '无'}\n`;

  const traceOpts = { round: 1, focus: focus.title };
  const [aLead, aEvidence, aLegalRaw, bLead, bEvidence, bLegalRaw] = await Promise.all([
    callRole(ctx, 'partyALead', `${base}\n请从甲方（委托方）立场提出你的核心主张。`, Object.assign({ maxTokens: 400 }, traceOpts)),
    callRole(ctx, 'partyAEvidence', `${base}\n请从合同条款中构建对甲方有利/不利的证据链。`, Object.assign({ maxTokens: 400 }, traceOpts)),
    callRole(ctx, 'partyALegal', `${base}\n请生成甲方本轮的法律检索式。`, Object.assign({ maxTokens: 250 }, traceOpts)),
    callRole(ctx, 'partyBLead', `${base}\n请从乙方（相对方）立场提出你的核心抗辩。`, Object.assign({ maxTokens: 400 }, traceOpts)),
    callRole(ctx, 'partyBEvidence', `${base}\n请从合同条款中找出对乙方有利、或甲方主张缺乏支撑的地方。`, Object.assign({ maxTokens: 400 }, traceOpts)),
    callRole(ctx, 'partyBLegal', `${base}\n请生成乙方本轮的法律检索式。`, Object.assign({ maxTokens: 250 }, traceOpts))
  ]);

  const aLegal = parseJson(aLegalRaw) || {};
  const bLegal = parseJson(bLegalRaw) || {};
  const queryA = String(aLegal.query || `${focus.title} 合同 违约责任 法律依据`).slice(0, 200);
  const queryB = String(bLegal.query || `${focus.title} 合同 免责 抗辩 法律依据`).slice(0, 200);

  trace(ctx, 'agent:query', { role: 'partyALegal', group: 'partyA', side: 'A', round: 1, focus: focus.title, query: queryA, intent: aLegal.intent || '' });
  trace(ctx, 'agent:query', { role: 'partyBLegal', group: 'partyB', side: 'B', round: 1, focus: focus.title, query: queryB, intent: bLegal.intent || '' });

  return {
    entries: [
      { round: 1, focus: focus.title, role: 'partyALead', roleLabel: META_ROLES.partyALead.label, side: 'A', content: aLead || '（甲方主张未生成）' },
      { round: 1, focus: focus.title, role: 'partyAEvidence', roleLabel: META_ROLES.partyAEvidence.label, side: 'A', content: aEvidence || '（甲方证据分析未生成）' },
      { round: 1, focus: focus.title, role: 'partyALegal', roleLabel: META_ROLES.partyALegal.label, side: 'A', content: aLegalRaw || '（甲方法律检索未生成）', query: queryA, intent: aLegal.intent || '' },
      { round: 1, focus: focus.title, role: 'partyBLead', roleLabel: META_ROLES.partyBLead.label, side: 'B', content: bLead || '（乙方抗辩未生成）' },
      { round: 1, focus: focus.title, role: 'partyBEvidence', roleLabel: META_ROLES.partyBEvidence.label, side: 'B', content: bEvidence || '（乙方证据分析未生成）' },
      { round: 1, focus: focus.title, role: 'partyBLegal', roleLabel: META_ROLES.partyBLegal.label, side: 'B', content: bLegalRaw || '（乙方法律检索未生成）', query: queryB, intent: bLegal.intent || '' }
    ],
    queryA,
    queryB
  };
}

// 阶段三：庭审主持归纳，产出残余争议与补充检索式
async function summarizeDebate(ctx, contractName, focus, entries) {
  const transcript = entries
    .map((e) => `【${e.roleLabel}】${e.content}`)
    .join('\n');

  const userPrompt =
    `合同名称：${contractName || '未命名合同'}\n本轮焦点：${focus.title}\n\n` +
    `第一轮辩论记录：\n${clip(transcript, 5000)}\n\n请归纳本轮庭审结果。`;

  const raw = await callRole(ctx, 'judgeDebate', userPrompt, { maxTokens: 900, round: 1, focus: focus.title });
  const parsed = parseJson(raw);

  const residual = parsed && Array.isArray(parsed.residual)
    ? parsed.residual
        .filter((r) => r && r.title)
        .slice(0, 2)
        .map((r, i) => ({
          id: `R${i + 1}`,
          title: String(r.title).slice(0, 120),
          question: String(r.question || '').slice(0, 300),
          reason: String(r.reason || '').slice(0, 300)
        }))
    : [];

  const nextQueries = parsed && Array.isArray(parsed.nextQueries)
    ? parsed.nextQueries.filter(Boolean).slice(0, 3).map((q) => String(q).slice(0, 200))
    : [];

  const agreed = parsed && Array.isArray(parsed.agreed) ? parsed.agreed.slice(0, 5).map(String) : [];

  trace(ctx, 'summary', { focus: focus.title, agreed, residual, nextQueries });
  return {
    agreed,
    residual: residual.length ? residual : [{ id: 'R1', title: focus.title, question: '该焦点是否已形成一致结论', reason: '模型未返回残余争议，按焦点本身复核' }],
    nextQueries
  };
}

// 第二轮：针对未决争议的攻坚与检索式重写（历史依赖）
async function runSecondRound(ctx, contractName, content, residual, knowledge, previousQueries) {
  const knowledgeText = formatKnowledge(knowledge);
  const base =
    `合同名称：${contractName || '未命名合同'}\n` +
    `合同全文摘要：\n${clip(content, 4000)}\n\n` +
    `未决争议：${residual.title}\n待回答的问题：${residual.question || '无'}\n` +
    `已检索到的法律依据：\n${knowledgeText}\n`;

  const traceOpts = { round: 2, focus: residual.title };
  const [aRebuttal, aLegalRaw, bRebuttal, bLegalRaw] = await Promise.all([
    callRole(ctx, 'partyARebuttal', `${base}\n请从甲方立场作第二轮回应。`, Object.assign({ maxTokens: 450 }, traceOpts)),
    callRole(
      ctx,
      'partyALegalRefine',
      `${base}\n上一轮检索式：${previousQueries.queryA || '无'}\n请重写甲方的检索式。`,
      Object.assign({ maxTokens: 300 }, traceOpts)
    ),
    callRole(ctx, 'partyBRebuttal', `${base}\n请从乙方立场作第二轮抗辩。`, Object.assign({ maxTokens: 450 }, traceOpts)),
    callRole(
      ctx,
      'partyBLegalRefine',
      `${base}\n上一轮检索式：${previousQueries.queryB || '无'}\n请重写乙方的检索式。`,
      Object.assign({ maxTokens: 300 }, traceOpts)
    )
  ]);

  const aLegal = parseJson(aLegalRaw) || {};
  const bLegal = parseJson(bLegalRaw) || {};
  const queryA = String(aLegal.query || previousQueries.queryA || residual.title).slice(0, 200);
  const queryB = String(bLegal.query || previousQueries.queryB || residual.title).slice(0, 200);

  trace(ctx, 'agent:query', { role: 'partyALegalRefine', group: 'partyA', side: 'A', round: 2, focus: residual.title, query: queryA, intent: aLegal.intent || '' });
  trace(ctx, 'agent:query', { role: 'partyBLegalRefine', group: 'partyB', side: 'B', round: 2, focus: residual.title, query: queryB, intent: bLegal.intent || '' });

  return {
    entries: [
      { round: 2, focus: residual.title, role: 'partyALead', roleLabel: '委托方·第二轮回应', side: 'A', content: aRebuttal || '（甲方第二轮回应未生成）' },
      { round: 2, focus: residual.title, role: 'partyALegal', roleLabel: '委托方·检索式重写', side: 'A', content: aLegalRaw || '（甲方检索式重写未生成）', query: queryA, intent: aLegal.intent || '' },
      { round: 2, focus: residual.title, role: 'partyBLead', roleLabel: '相对方·第二轮抗辩', side: 'B', content: bRebuttal || '（乙方第二轮抗辩未生成）' },
      { round: 2, focus: residual.title, role: 'partyBLegal', roleLabel: '相对方·检索式重写', side: 'B', content: bLegalRaw || '（乙方检索式重写未生成）', query: queryB, intent: bLegal.intent || '' }
    ],
    queryA,
    queryB
  };
}

// 阶段五：终审裁决（全链条复核 + 要素—结论映射）
async function finalVerdict(ctx, contractName, content, focuses, allEntries, residual, knowledge, historyInsights) {
  const transcript = allEntries
    .map((e) => `【第${e.round}轮｜${e.roleLabel}】${e.content}`)
    .join('\n');

  const historyBlock = (historyInsights && historyInsights.hasHistory)
    ? `【用户历史洞察】基于该用户过往 ${historyInsights.totalRecords} 份合同的审查历史，发现以下模式：
- 常见遗漏项：${(historyInsights.commonOmissions || []).slice(0, 5).join('；')}
- 常见不足项：${(historyInsights.commonDeficiencies || []).slice(0, 5).join('；')}
- 风险提醒：${(historyInsights.reminders || []).slice(0, 4).join('；')}
请在裁决中特别关注以上历史高频问题是否在当前合同中存在。

`
    : '';

  const userPrompt =
    `合同名称：${contractName || '未命名合同'}\n\n` +
    `合同全文：\n${clip(content, 6000)}\n\n` +
    `争议焦点：${focuses.map((f) => f.title).join('；')}\n` +
    `残余争议：${residual.map((r) => r.title).join('；')}\n\n` +
    `两轮庭审记录：\n${clip(transcript, 6000)}\n\n` +
    `动态检索到的法律依据：\n${formatKnowledge(knowledge)}\n\n` +
    historyBlock +
    '请完成全链条复核，输出最终审查结论。';

  const raw = await callRole(ctx, 'judgeVerdict', userPrompt, { maxTokens: 2400, temperature: 0.2, round: 3, focus: '终审裁决' });
  const parsed = parseJson(raw);

  if (parsed && typeof parsed.score !== 'undefined') {
    const score = Math.max(0, Math.min(100, Number(parsed.score) || 60));
    return {
      score,
      level: ['低', '中', '高'].includes(parsed.level)
        ? parsed.level
        : score <= 40
          ? '低'
          : score <= 70
            ? '中'
            : '高',
      summary: String(parsed.summary || ''),
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      factorConclusion: Array.isArray(parsed.factorConclusion) ? parsed.factorConclusion : [],
      residualDisputes: Array.isArray(parsed.residualDisputes) ? parsed.residualDisputes : [],
      disclaimer: String(parsed.disclaimer || '本结论由人工智能辅助生成，仅供合同审查参考，不构成正式法律意见。'),
      raw: null
    };
  }

  // 模型输出非 JSON 时的降级结果，保留原始文本供前端展示
  return {
    score: 60,
    level: '中',
    summary: '终审模型未返回结构化结论，以下为模型原始输出，建议人工复核。',
    findings: [],
    factorConclusion: [],
    residualDisputes: residual.map((r) => ({ title: r.title, handling: '需人工复核' })),
    disclaimer: '本结论由人工智能辅助生成，仅供合同审查参考，不构成正式法律意见。',
    raw: raw || '（终审模型调用失败）'
  };
}

// ==================== 路由 ====================
// 读取已上传合同的正文，供前端“选择已有合同”后直接审查
router.get('/contract_content/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ err_code: 400, message: '合同ID无效' });

    const contract = await Contract.findOne({
      where: { id, user_id: req.user?.id || null },
      attributes: ['id', 'file_name', 'content', 'contract_type']
    });
    if (!contract) return res.status(404).json({ err_code: 404, message: '合同不存在' });

    return res.json({
      err_code: 0,
      message: '获取成功',
      data: {
        id: contract.id,
        fileName: contract.file_name,
        contractType: contract.contract_type,
        content: contract.content || ''
      }
    });
  } catch (error) {
    console.error('读取合同正文失败:', error);
    return res.status(500).json({ err_code: 500, message: '服务器错误' });
  }
});

// 多智能体审查主流程
// emit 为空时按普通 JSON 返回；传入 emit 时（流式接口）改为逐事件推送，供前端做实时庭审动画
async function handleReview(req, res, emit) {
  const fail = (status, message) => {
    if (emit) {
      emit('error', { status, message });
      return null;
    }
    res.status(status).json({ err_code: status, message });
    return null;
  };

  if (!LLM_KEY) {
    return fail(500, '服务端未配置 LLM_API_KEY（大模型密钥），请在 .env 中配置后重启后端');
  }

  const startedAt = Date.now();
  const { contractContent, contractName, contractId } = req.body || {};

  let content = String(contractContent || '');
  let name = String(contractName || '');

  // 支持只传 contractId：从数据库取正文
  if (!content && contractId) {
    try {
      const contract = await Contract.findOne({
        where: { id: parseInt(contractId), user_id: req.user?.id || null },
        attributes: ['file_name', 'content']
      });
      if (contract) {
        content = contract.content || '';
        name = name || contract.file_name || '';
      }
    } catch (dbErr) {
      console.error('读取合同正文失败:', dbErr);
    }
  }

  if (!content || content.trim().length < 50) {
    return fail(400, '合同正文过短（至少50字），请粘贴完整合同内容或选择已上传的合同');
  }

  if (emit) emit('start', { contractName: name || '未命名合同', model: LLM_MODEL, totalChars: content.length });
  const ctx = { calls: 0, failedCalls: 0, emit };

  try {
    // 加载内部知识源（历史审查案例 + 合同模板），供所有检索式复用
    const knowledgeSources = await loadKnowledgeSources();
    const categoryHint = inferContractCategory(name);

    // 阶段一：审判组识别争议焦点
    const focuses = await identifyFocuses(ctx, name, content);

    // 阶段二：第一轮庭审辩论（每组三个元角色并行）
    const allEntries = [];
    const stageFocuses = [];

    for (const focus of focuses) {
      const first = await runFirstRound(ctx, name, content, focus);

      // 阶段三：动态检索——用本轮两个法条检索元角色产出的查询式召回知识
      const knowledge1 = mergeKnowledge(
        retrieveKnowledge(first.queryA, knowledgeSources, 4, categoryHint),
        retrieveKnowledge(first.queryB, knowledgeSources, 4, categoryHint)
      );

      allEntries.push(...first.entries);
      stageFocuses.push({ focus, entries: first.entries.length, queries: [first.queryA, first.queryB], knowledgeCount: knowledge1.length });
      if (emit) emit('knowledge', { round: 1, items: knowledge1 });

      // 阶段三：庭审主持归纳未决争议（把检索到的法条一并交给主持法官）
      const summary = await summarizeDebate(ctx, name, focus, first.entries);

      // 阶段四：第二轮攻坚 + 检索式重写（查询式依赖上一轮结果，体现动态演化）
      const second = await runSecondRound(ctx, name, content, summary.residual[0], knowledge1, {
        queryA: first.queryA,
        queryB: first.queryB
      });

      const knowledge2 = mergeKnowledge(
        knowledge1,
        retrieveKnowledge(second.queryA, knowledgeSources, 4, categoryHint),
        retrieveKnowledge(second.queryB, knowledgeSources, 4, categoryHint),
        ...summary.nextQueries.map((q) => retrieveKnowledge(q, knowledgeSources, 3, categoryHint))
      );

      allEntries.push(...second.entries);
      stageFocuses[stageFocuses.length - 1].residual = summary.residual;
      stageFocuses[stageFocuses.length - 1].agreed = summary.agreed;
      stageFocuses[stageFocuses.length - 1].nextQueries = summary.nextQueries;
      stageFocuses[stageFocuses.length - 1].knowledgeCount = knowledge2.length;

      // 保存每个焦点的检索知识，最后统一去重
      focus.__knowledge = knowledge2;
      if (emit) emit('knowledge', { round: 2, items: knowledge2 });
    }

    const knowledge = pruneKnowledge(mergeKnowledge(...focuses.map((f) => f.__knowledge || [])));

    // 阶段五：终审裁决
    const allResidual = [];
    for (const sf of stageFocuses) {
      for (const r of sf.residual || []) allResidual.push(r);
    }

    // 获取用户历史洞察，供终审裁决参考
    let historyInsights = null;
    try {
      historyInsights = await summarizeHistoryForUser(req.user?.id || null);
    } catch (e) {
      console.warn('获取历史洞察失败:', e.message);
    }
    if (emit && historyInsights) emit('history-insights', historyInsights);

    const verdict = await finalVerdict(ctx, name, content, focuses, allEntries, allResidual, knowledge, historyInsights);

    // 持久化审查结论，作为后续审查的“历史案例”知识源
    if (contractId) {
      try {
        const riskText = [
          `风险评分：${verdict.score ?? '-'}（${verdict.level || '未知'}）`,
          ...(verdict.findings || []).map(
            (f) => `[${f.level || '中'}] ${f.clause || ''}：${f.risk || ''}；依据：${f.basis || ''}；建议：${f.suggestion || ''}`
          )
        ].join('\n');
        await QualityResult.create({
          contract_id: parseInt(contractId),
          contract_name: name || '未命名合同',
          contract_type: '多智能体审查',
          contract_summary: verdict.summary || '',
          risk_clauses: riskText,
          core_clauses: JSON.stringify(verdict.factorConclusion || []),
          user_id: req.user?.id || null
        });
      } catch (dbError) {
        console.warn('多智能体审查结果入库失败（不影响本次审查）:', dbError.message);
      }
    }

    // 清理内部字段
    const cleanFocuses = focuses.map(({ __knowledge, ...rest }) => rest);

    const payload = {
      contractName: name || '未命名合同',
      model: LLM_MODEL,
      metaRoles: Object.values(META_ROLES),
      focuses: cleanFocuses,
      stages: stageFocuses.map((sf) => ({
        focus: sf.focus,
        agreed: sf.agreed || [],
        residual: sf.residual || [],
        nextQueries: sf.nextQueries || [],
        queries: sf.queries,
        knowledgeCount: sf.knowledgeCount
      })),
      debate: allEntries,
      knowledge,
      verdict,
      historyInsights,
      stats: {
        llmCalls: ctx.calls,
        failedCalls: ctx.failedCalls,
        elapsedMs: Date.now() - startedAt
      }
    };

    // 流式接口：推送终审结论与完成事件；普通接口：一次性返回完整数据
    if (emit) {
      emit('verdict', verdict);
      emit('done', payload);
      return payload;
    }

    return res.json({ err_code: 0, message: '多智能体审查完成', data: payload });
  } catch (error) {
    console.error('多智能体审查失败:', error);
    if (emit) {
      emit('error', { status: 500, message: `多智能体审查失败：${error.message}` });
      return null;
    }
    return res.status(500).json({
      err_code: 500,
      message: `多智能体审查失败：${error.message}`
    });
  }
}

// 普通请求-响应接口：前端等待完整结果后一次性渲染
router.post('/review', async (req, res) => {
  await handleReview(req, res, null);
});

// 流式接口：逐事件以 NDJSON 推送，前端据此播放实时庭审过程
router.post('/review-stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  let closed = false;
  res.on('close', () => { closed = true; });

  const emit = (type, data) => {
    if (closed) return;
    try {
      res.write(JSON.stringify({ type, data }) + '\n');
    } catch (e) {
      closed = true;
    }
  };

  // 大模型单次调用可能较久，定期发心跳避免中间代理断开连接
  const heartbeat = setInterval(() => {
    if (closed) return;
    try {
      res.write(JSON.stringify({ type: 'ping', ts: Date.now() }) + '\n');
    } catch (e) {
      closed = true;
    }
  }, 15000);

  try {
    await handleReview(req, res, emit);
  } catch (error) {
    console.error('多智能体流式审查异常:', error);
    emit('error', { status: 500, message: error.message });
  } finally {
    clearInterval(heartbeat);
    if (!closed) res.end();
  }
});

// ==================== 历史洞察 ====================
async function summarizeHistoryForUser(userId) {
  try {
    const results = await QualityResult.findAll({
      where: userId ? { user_id: userId } : {},
      order: [['created_at', 'DESC']],
      limit: 50,
      attributes: ['id', 'contract_name', 'contract_type', 'contract_summary', 'risk_clauses', 'core_clauses', 'created_at']
    });

    if (!results || results.length < 2) {
      return {
        hasHistory: false,
        totalRecords: results ? results.length : 0,
        message: '历史审查记录不足（至少 2 条），暂无法生成个性化洞察',
        commonOmissions: [],
        commonDeficiencies: [],
        reminders: [],
        frequentRiskTypes: [],
        riskLevelDist: { low: 0, mid: 0, high: 0 }
      };
    }

    const historyText = results
      .map((r, i) => {
        const summary = r.contract_summary ? '摘要: ' + String(r.contract_summary).slice(0, 300) : '';
        const risks = r.risk_clauses ? '风险: ' + String(r.risk_clauses).slice(0, 500) : '';
        return '--- 记录 #' + (i + 1) + ' | ' + (r.contract_name || '未命名') + ' | ' + (r.contract_type || '') + ' ---\n' + summary + '\n' + risks;
      })
      .join('\n\n');

    const levelDist = { low: 0, mid: 0, high: 0 };
    results.forEach((r) => {
      if (r.risk_clauses) {
        levelDist.high += (String(r.risk_clauses).match(/[高]/g) || []).length;
        levelDist.mid += (String(r.risk_clauses).match(/[中]/g) || []).length;
        levelDist.low += (String(r.risk_clauses).match(/[低]/g) || []).length;
      }
    });

    const sageCtx = { calls: 0, failedCalls: 0 };
    const sageResult = await callRole(sageCtx, 'historySage', '以下是用户过往 ' + results.length + ' 份合同的审查历史记录，请归纳总结用户合同起草中的常见问题模式：\n\n' + historyText.slice(0, 8000), { maxTokens: 1500, temperature: 0.3 });
    const parsed = parseJson(sageResult) || {};

    const frequentRiskTypes = parsed.frequentRiskTypes && Array.isArray(parsed.frequentRiskTypes)
      ? parsed.frequentRiskTypes.filter((t) => t && t.type).slice(0, 6)
      : [];

    const dist = parsed.riskLevelDist || {};

    return {
      hasHistory: true,
      totalRecords: results.length,
      message: '基于您过往 ' + results.length + ' 份合同的审查历史，以下是 AI 为您总结的个性化洞察：',
      commonOmissions: parsed.commonOmissions || [],
      commonDeficiencies: parsed.commonDeficiencies || [],
      reminders: parsed.reminders || [],
      frequentRiskTypes,
      riskLevelDist: {
        low: Number(dist.low) || levelDist.low || 0,
        mid: Number(dist.mid) || levelDist.mid || 0,
        high: Number(dist.high) || levelDist.high || 0
      }
    };
  } catch (error) {
    console.warn('历史洞察生成失败（降级返回空）:', error.message);
    return {
      hasHistory: false,
      totalRecords: 0,
      message: '历史洞察生成失败：' + error.message,
      commonOmissions: [],
      commonDeficiencies: [],
      reminders: [],
      frequentRiskTypes: [],
      riskLevelDist: { low: 0, mid: 0, high: 0 }
    };
  }
}

router.get('/history-summary', async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const summary = await summarizeHistoryForUser(userId);
    return res.json({ err_code: 0, message: '获取成功', data: summary });
  } catch (error) {
    console.error('获取历史洞察失败:', error);
    return res.status(500).json({ err_code: 500, message: '服务器错误' });
  }
});

module.exports = router;
