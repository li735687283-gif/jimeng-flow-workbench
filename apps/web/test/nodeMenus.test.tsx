import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

function getMenuText(html: string): { title: string; labels: string[] } {
  const titleMatch = html.match(/<div class="[^"]*menu-title">([^<]+)<\/div>/)
  const labels = Array.from(
    html.matchAll(/<span class="[^"]*menu-label">([^<]+)<\/span>/g),
  ).map((match) => match[1])
  return {
    title: titleMatch?.[1] ?? '',
    labels,
  }
}

test('reference node menu mirrors the double-click add-node menu', async () => {
  const { AddNodeMenu } = await import('../src/components/menus/AddNodeMenu')
  const { ReferenceNodeMenu } = await import(
    '../src/components/menus/ReferenceNodeMenu'
  )

  const addMenu = renderToStaticMarkup(
    <AddNodeMenu
      state={{ x: 0, y: 0, flowPosition: { x: 0, y: 0 } }}
      onSelect={() => undefined}
      onUpload={() => undefined}
      onClose={() => undefined}
    />,
  )
  const referenceMenu = renderToStaticMarkup(
    <ReferenceNodeMenu
      state={{
        x: 0,
        y: 0,
        flowPosition: { x: 0, y: 0 },
        sourceNodeId: 'node-1',
        sourceHandleId: null,
        sourceHandleType: 'source',
      }}
      onSelect={() => undefined}
      onUpload={() => undefined}
      onClose={() => undefined}
    />,
  )

  assert.deepEqual(getMenuText(referenceMenu), getMenuText(addMenu))
  for (const removedLabel of ['视频合成', '导演台', '参考节点', '脚本']) {
    assert.equal(referenceMenu.includes(removedLabel), false)
  }
})
