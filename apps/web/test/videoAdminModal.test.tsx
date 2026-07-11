import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ManagedWork } from '@jimeng-flow/shared/video'
import {
  buildWorkAdminEditForm,
  buildWorkAdminListQuery,
  clampWorkAdminPage,
} from '../src/utils/videoAdminState'

Object.assign(globalThis, { React })

const managedWork: ManagedWork = {
  id: 'work_demo',
  mediaType: 'image',
  title: '海报作品',
  description: '编辑表单示例',
  mediaAssetId: 'asset_image_demo',
  coverAssetId: 'asset_image_demo',
  mediaUrl: '/api/assets/asset_image_demo/file',
  coverUrl: '/api/assets/asset_image_demo/file',
  isFeatured: true,
  isPinned: false,
  isPublished: true,
  sortOrder: 42,
  createdAt: '2026-07-08T10:00:00.000Z',
  updatedAt: '2026-07-08T10:00:00.000Z',
}

test('work admin tab filters map to API list queries', () => {
  assert.deepEqual(buildWorkAdminListQuery('all', 2, 8), { page: 2, pageSize: 8 })
  assert.deepEqual(buildWorkAdminListQuery('featured', 1, 8), {
    page: 1,
    pageSize: 8,
    isFeatured: true,
  })
  assert.deepEqual(buildWorkAdminListQuery('video', 3, 8), {
    page: 3,
    pageSize: 8,
    mediaType: 'video',
  })
  assert.deepEqual(buildWorkAdminListQuery('image', 1, 8), {
    page: 1,
    pageSize: 8,
    mediaType: 'image',
  })
})

test('managed work maps every editable field into the edit form', () => {
  assert.deepEqual(buildWorkAdminEditForm(managedWork), {
    mediaType: 'image',
    title: '海报作品',
    description: '编辑表单示例',
    sortOrder: '42',
    isFeatured: true,
    isPinned: false,
    isPublished: true,
  })
})

test('work admin pagination clamps both boundaries', () => {
  assert.equal(clampWorkAdminPage(-1, 5), 1)
  assert.equal(clampWorkAdminPage(3, 5), 3)
  assert.equal(clampWorkAdminPage(8, 5), 5)
  assert.equal(clampWorkAdminPage(2, 0), 1)
})

function elementBlocks(html: string, tagName: string): string[] {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?</${tagName}>`, 'g')) ?? []
}

function textContent(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function findElementByText(html: string, tagName: string, text: string): string {
  const element = elementBlocks(html, tagName).find(
    (candidate) => textContent(candidate) === text,
  )
  assert.ok(element, `Missing <${tagName}> with text "${text}"`)
  return element
}

function findElementByAttribute(
  html: string,
  tagName: string,
  attribute: string,
  value: string,
): string {
  const element = elementBlocks(html, tagName).find((candidate) => {
    const tag = candidate.match(new RegExp(`<${tagName}\\b[^>]*>`))?.[0]
    return tag?.includes(`${attribute}="${value}"`)
  })
  assert.ok(element, `Missing <${tagName}> with ${attribute}="${value}"`)
  return element
}

function findLabeledControl(
  html: string,
  labelText: string,
  controlTagName: string,
): string {
  const label = elementBlocks(html, 'label').find((candidate) =>
    textContent(candidate).includes(labelText),
  )
  assert.ok(label, `Missing label containing "${labelText}"`)

  const control = label.match(new RegExp(`<${controlTagName}\\b[^>]*>`))?.[0]
  assert.ok(control, `Label "${labelText}" must contain a <${controlTagName}>`)
  return control
}

test('work admin modal renders its shell and labeled upload controls', async () => {
  const { VideoAdminModal } = await import('../src/components/VideoAdminModal')

  const closedHtml = renderToStaticMarkup(
    <VideoAdminModal open={false} onClose={() => undefined} />,
  )
  assert.equal(closedHtml, '')

  const html = renderToStaticMarkup(
    <VideoAdminModal open={true} onClose={() => undefined} />,
  )

  const editSection = findElementByAttribute(html, 'section', 'aria-label', '作品编辑')
  findElementByAttribute(html, 'section', 'aria-label', '作品列表')

  for (const text of [
    '视频作品',
    '图片作品',
    '新增作品',
  ]) {
    const button = findElementByText(editSection, 'button', text)
    assert.match(button, /^<button\b[^>]*\btype="button"/)
  }

  const videoUpload = findLabeledControl(editSection, '上传视频', 'input')
  assert.match(videoUpload, /\btype="file"/)
  assert.match(videoUpload, /\baccept="video\/\*"/)

  const coverUpload = findLabeledControl(editSection, '上传封面', 'input')
  assert.match(coverUpload, /\btype="file"/)
  assert.match(coverUpload, /\baccept="image\/\*"/)

  const titleInput = findLabeledControl(editSection, '标题', 'input')
  assert.match(titleInput, /\bplaceholder="作品标题"/)

  const description = findLabeledControl(editSection, '简介', 'textarea')
  assert.match(description, /^<textarea\b/)

  const sortOrderInput = findLabeledControl(editSection, '排序权重', 'input')
  assert.match(sortOrderInput, /\btype="number"/)
})
