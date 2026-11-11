import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'

async function makePdf(pageCount) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i += 1) doc.addPage([300, 400]).drawText(`page ${i + 1}`)
  return Buffer.from(await doc.save())
}

test('add, rotate, reorder, delete, export and split', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('./')
  await page.setInputFiles('#file-input', [
    { name: 'a.pdf', mimeType: 'application/pdf', buffer: await makePdf(3) },
    { name: 'b.pdf', mimeType: 'application/pdf', buffer: await makePdf(2) },
    { name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') },
  ])
  await expect(page.locator('.page-card')).toHaveCount(5)
  await expect(page.locator('#toast')).toContainText('bad.pdf')

  // 旋轉第 2 頁；其他卡片節點不應被重建。
  await page.evaluate(() => { window.__cards = [...document.querySelectorAll('.page-card')] })
  await page.locator('.page-check').nth(1).click()
  await page.click('[data-action="rotate-selected"]')
  await expect.poll(() => page.evaluate(() => window.__cards.every((card, i) => card === document.querySelectorAll('.page-card')[i]))).toBe(true)

  // 鍵盤把第 1 頁往後移一格。
  await page.locator('.page-check').nth(0).focus()
  await page.keyboard.press('Alt+ArrowRight')
  await expect(page.locator('.page-card').nth(1)).toHaveAttribute('data-page-id', await page.evaluate(() => window.__cards[0].dataset.pageId))

  // 匯出合併檔，驗證頁數與旋轉角度（原第 2 頁現在是第 1 頁）。
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="merge"]')])
  const exported = await PDFDocument.load(await (await import('node:fs/promises')).readFile(await download.path()))
  expect(exported.getPageCount()).toBe(5)
  expect(exported.getPages().map((p) => p.getRotation().angle)).toEqual([90, 0, 0, 0, 0])

  // 刪光 b.pdf 的頁面後，來源文件應同步消失（先取消之前的選取，並等匯出結束）。
  await expect(page.locator('#toast')).toContainText('已匯出 5 頁')
  await page.click('[data-action="select-all"]') // 全選
  await page.click('[data-action="select-all"]') // 取消全選
  await page.locator('.page-check').nth(3).click()
  await page.locator('.page-check').nth(4).click()
  await page.click('[data-action="delete-selected"]')
  await expect(page.locator('#document-stats')).toContainText('共 3 頁，來自 1 份文件')

  // 拆分：全形範圍輸入。
  await page.click('[data-action="open-split"]')
  await page.fill('#page-range', '１－２')
  const [split] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="confirm-split"]')])
  const extracted = await PDFDocument.load(await (await import('node:fs/promises')).readFile(await split.path()))
  expect(extracted.getPageCount()).toBe(2)
  expect(pageErrors).toEqual([])
})
