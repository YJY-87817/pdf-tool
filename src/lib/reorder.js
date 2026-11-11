// 拖曳已選取的頁面時，會一併移動所有已選取的頁面。回傳新陣列；無法移動時回傳 null。
export function reorderPages(pages, selectedIds, draggedId, targetId, placeAfter) {
  const movingIds = selectedIds.has(draggedId) ? new Set(selectedIds) : new Set([draggedId])
  if (movingIds.has(targetId)) return null
  const moving = pages.filter((page) => movingIds.has(page.id))
  const rest = pages.filter((page) => !movingIds.has(page.id))
  const targetIndex = rest.findIndex((page) => page.id === targetId)
  if (targetIndex === -1) return null
  rest.splice(targetIndex + (placeAfter ? 1 : 0), 0, ...moving)
  return rest
}

// 把選取的頁面整體往前（-1）或往後（+1）移一格；選取區塊碰到邊界就停住。
// 回傳新陣列；沒有任何頁面能移動時回傳 null。
export function shiftPages(pages, selectedIds, direction) {
  const result = [...pages]
  let moved = false
  if (direction < 0) {
    for (let i = 1; i < result.length; i += 1) {
      if (selectedIds.has(result[i].id) && !selectedIds.has(result[i - 1].id)) {
        ;[result[i - 1], result[i]] = [result[i], result[i - 1]]
        moved = true
      }
    }
  } else {
    for (let i = result.length - 2; i >= 0; i -= 1) {
      if (selectedIds.has(result[i].id) && !selectedIds.has(result[i + 1].id)) {
        ;[result[i + 1], result[i]] = [result[i], result[i + 1]]
        moved = true
      }
    }
  }
  return moved ? result : null
}

// 還原刪除：把頁面依原本的索引插回去（entries 需依索引遞增排序）。
export function restorePages(pages, entries) {
  const result = [...pages]
  for (const { page, index } of entries) result.splice(Math.min(index, result.length), 0, page)
  return result
}
