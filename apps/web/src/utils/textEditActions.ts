/** 文本输入框选区编辑的纯逻辑，供右键菜单等交互复用。 */

export interface TextSelectionEdit {
  value: string
  caret: number
}

function clampSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): { start: number; end: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  return { start, end }
}

/** 把 text 插入到当前选区（替换选中内容），光标落在插入文本之后。 */
export function insertTextAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  text: string,
): TextSelectionEdit {
  const { start, end } = clampSelection(value, selectionStart, selectionEnd)
  return {
    value: value.slice(0, start) + text + value.slice(end),
    caret: start + text.length,
  }
}

/** 删除当前选区内容，光标落在选区起点。 */
export function deleteSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextSelectionEdit {
  const { start, end } = clampSelection(value, selectionStart, selectionEnd)
  return {
    value: value.slice(0, start) + value.slice(end),
    caret: start,
  }
}
