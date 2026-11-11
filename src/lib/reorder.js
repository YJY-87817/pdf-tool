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
