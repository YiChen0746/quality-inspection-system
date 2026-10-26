// 多源知识检索服务：法规库 + 系统历史审查案例 + 合同模板标准条款库
const { retrieve } = require('./legal-kb');
const CONTRACT_TEMPLATES = require('./contract-templates');

// 中文二元组切分（与法规库检索保持一致的近似匹配口径）
function bigrams(text) {
  const clean = String(text || '').replace(/[\s，。；：、！？,.;:!?（）()《》【】"'“”‘’\-—]/g, '');
  const set = new Set();
  for (let i = 0; i < clean.length - 1; i++) {
    set.add(clean.slice(i, i + 2));
  }
  return set;
}

function scoreItem(query, item) {
  const q = String(query || '');
  let score = 0;
  for (const kw of item.keywords || []) {
    if (kw && q.includes(kw)) score += 6;
  }
  const qBi = bigrams(q);
  const itemBi = bigrams(item.title + ' ' + item.content);
  let overlap = 0;
  for (const b of qBi) {
    if (itemBi.has(b)) overlap += 1;
  }
  score += Math.min(10, overlap * 0.5);
  return Math.round(score * 100) / 100;
}

function buildTemplateItems() {
  return CONTRACT_TEMPLATES.map((t) => ({
    id: `template-${t.id}`,
    title: `合同模板·${t.name}`,
    category: '标准条款库',
    keywords: [t.category, ...(t.fields || [])],
    content: `${t.description}。标准条款应包含：${(t.fields || []).join('、')}。参考表述：${t.content}`,
    source: '系统内置合同模板库',
    effectiveDate: ''
  }));
}

/**
 * 加载本系统内部知识源（历史审查记录 + 合同模板）
 * 每次审查开始时调用一次，避免每条检索式都查库
 */
async function loadKnowledgeSources() {
  let historyCases = [];
  try {
    const { QualityResult } = require('../models');
    const rows = await QualityResult.findAll({
      limit: 40,
      order: [['created_at', 'DESC']],
      attributes: ['id', 'contract_name', 'contract_type', 'risk_clauses', 'created_at']
    });
    historyCases = rows.map((r) => ({
      id: `history-${r.id}`,
      title: `历史审查：${r.contract_name || '未命名合同'}`,
      category: '历史风险案例',
      keywords: [r.contract_type || '', '历史风险', '审查经验'],
      content: String(r.risk_clauses || '').slice(0, 500),
      source: '本系统历史审查记录',
      effectiveDate: r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : ''
    })).filter((x) => x.content.trim());
  } catch (error) {
    console.warn('加载历史审查案例失败（不影响主流程）:', error.message);
  }

  return {
    historyCases,
    templates: buildTemplateItems()
  };
}

/**
 * 多源检索：法规为主，历史案例与模板为辅
 * @param {string} query 检索式
 * @param {object} sources loadKnowledgeSources() 的返回值
 * @param {number} lawTopK 法规返回条数
 * @param {string} categoryHint 合同类型提示（如“租赁合同”），用于过滤跨领域法条
 */
function retrieveKnowledge(query, sources = {}, lawTopK = 4, categoryHint = '') {
  // 通用规则：任何合同都可能用到
  const GENERAL_CATEGORIES = new Set([
    '合同通则', '合同履行', '合同解除', '合同效力', '违约责任',
    '格式条款', '争议解决', '担保', '签约主体', '债权保护',
    '债权转让', '债务转移', '保密义务'
  ]);

  const laws = retrieve(query, lawTopK)
    .filter((item) => {
      if (!categoryHint) return true;
      if (GENERAL_CATEGORIES.has(item.category)) return true;
      // 分类名归一化匹配（如库内「服务/委托合同」对用户选的「服务合同」）
      const parts = String(item.category || '').split('/');
      return parts.some(p => p && (categoryHint.includes(p) || p.includes(categoryHint)));
    })
    .map((item) => ({ ...item, type: 'law' }));

  const history = (sources.historyCases || [])
    .map((item) => ({ ...item, score: scoreItem(query, item), type: 'history' }))
    .filter((item) => item.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const templates = (sources.templates || [])
    .map((item) => ({ ...item, score: scoreItem(query, item), type: 'template' }))
    .filter((item) => item.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 1);

  const merged = [...laws, ...history, ...templates].sort((a, b) => (b.score || 0) - (a.score || 0));
  if (!merged.length) return [];

  // 相对阈值过滤：放宽比例，避免低分但相关的条目被第一名的高分全部砍掉
  const maxScore = merged[0].score;
  const GENERIC_CATEGORIES = new Set(['合同通则', '担保']);
  return merged
    .filter((item) => {
      if (item.type !== 'law') return item.score >= maxScore * 0.35;
      const ratio = GENERIC_CATEGORIES.has(item.category) ? 0.6 : 0.35;
      return item.score >= maxScore * ratio;
    })
    .slice(0, 8);
}

// 根据合同名称推断合同类型，用于知识检索时的领域过滤
function inferContractCategory(contractName) {
  const name = String(contractName || '');
  const rules = [
    ['租赁', '租赁合同'],
    ['买卖', '买卖合同'],
    ['劳动', '劳动合同'],
    ['借款', '借款合同'],
    ['服务', '服务合同'],
    ['建设', '建设工程合同'],
    ['施工', '建设工程合同'],
    ['技术', '技术合同'],
    ['承揽', '承揽合同'],
    ['委托', '委托合同'],
    ['数据', '数据合规'],
    ['消费', '消费者权益']
  ];
  for (const [key, category] of rules) {
    if (name.includes(key)) return category;
  }
  return '';
}

module.exports = { loadKnowledgeSources, retrieveKnowledge, inferContractCategory };
