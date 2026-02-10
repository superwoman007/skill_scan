/**
 * 从文本中提取第一个 JSON 对象并解析
 * @param {string} text - 大模型返回的文本
 * @returns {unknown} 解析得到的对象
 */
export function parseFirstJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed);
  }

  const start = trimmed.indexOf('{');
  if (start < 0) {
    throw new Error('未找到 JSON 对象起始字符');
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < trimmed.length; i += 1) {
    const ch = trimmed[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const jsonText = trimmed.slice(start, i + 1);
        return JSON.parse(jsonText);
      }
    }
  }

  throw new Error('未找到完整 JSON 对象结束位置');
}

