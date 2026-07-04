// 即梦 Flow 前端 - SettingsModal 设置弹窗组件
// 暗色主题，固定遮罩 + 居中卡片。
// 字段分组：JimengCli_api、LLM Provider、输出、默认参数。
// 加载时拉取 GET /api/settings；保存时 PUT /api/settings，成功后更新 store 并关闭。
// 参考 PRD 7.1、8.6、11.3、12.1。

import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, X } from 'lucide-react'
import type { AuthMode, Settings } from '@jimeng-flow/shared'
import { DEFAULT_SETTINGS } from '@jimeng-flow/shared'
import { useSettingsStore } from '../state/settingsStore'
import { testJimengConnection, testLlmConnection } from '../api/settings'

export interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

// 表单状态：以完整 Settings 形式保存，避免字段缺失
type FormState = Settings

const AUTH_MODES: AuthMode[] = ['apiKey', 'cookie', 'token']

const sectionStyle: React.CSSProperties = {
  borderBottom: '1px solid #2a2a2a',
  padding: '16px 0',
}
const sectionLastStyle: React.CSSProperties = { padding: '16px 0' }
const sectionTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#a0a0a0',
  marginBottom: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
}
const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}
const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9a9a9a',
}
const inputStyle: React.CSSProperties = {
  background: '#0f0f0f',
  border: '1px solid #333',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#e8e8e8',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'auto',
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, loadSettings, saveSettings } = useSettingsStore()
  const [form, setForm] = useState<FormState>(DEFAULT_SETTINGS)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // 测试连接状态
  const [testingJimeng, setTestingJimeng] = useState(false)
  const [jimengTestResult, setJimengTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)
  const [testingLlm, setTestingLlm] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)

  // 打开时拉取一次最新 settings
  useEffect(() => {
    if (!open) return
    setLoadError(null)
    setSaveError(null)
    setJimengTestResult(null)
    setLlmTestResult(null)
    loadSettings().catch((err: unknown) => {
      setLoadError(err instanceof Error ? err.message : String(err))
    })
  }, [open, loadSettings])

  // settings 加载完成后同步到本地 form
  useEffect(() => {
    if (settings) {
      setForm(settings)
    }
  }, [settings])

  if (!open) return null

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSubmitting(true)
    setSaveError(null)
    try {
      await saveSettings(form)
      onClose()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSaveError(null)
    onClose()
  }

  const handleTestJimeng = async () => {
    setTestingJimeng(true)
    setJimengTestResult(null)
    try {
      const result = await testJimengConnection(form)
      setJimengTestResult({
        ok: result.ok,
        message: result.message ?? (result.ok ? '连接成功' : '连接失败'),
      })
    } catch (err: unknown) {
      setJimengTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTestingJimeng(false)
    }
  }

  const handleTestLlm = async () => {
    setTestingLlm(true)
    setLlmTestResult(null)
    try {
      const result = await testLlmConnection(form)
      setLlmTestResult({
        ok: result.ok,
        message: result.message ?? (result.ok ? '连接成功' : '连接失败'),
      })
    } catch (err: unknown) {
      setLlmTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTestingLlm(false)
    }
  }

  const renderTestResult = (result: { ok: boolean; message: string } | null) => {
    if (!result) return null
    return (
      <div
        style={{
          marginBottom: '12px',
          padding: '8px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          background: result.ok
            ? 'rgba(40, 160, 80, 0.12)'
            : 'rgba(220, 50, 50, 0.12)',
          border: result.ok
            ? '1px solid rgba(40, 160, 80, 0.5)'
            : '1px solid rgba(220, 50, 50, 0.5)',
          color: result.ok ? '#7ee0a0' : '#ff9a9a',
        }}
      >
        {result.ok ? '连接成功：' : '连接失败：'}
        {result.message}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          background: '#1a1a1a',
          color: '#e8e8e8',
          borderRadius: '10px',
          width: '640px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
          border: '1px solid #2a2a2a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid #2a2a2a',
            position: 'sticky',
            top: 0,
            background: '#1a1a1a',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingsIcon size={16} color="#a0a0a0" />
            <span style={{ fontSize: '15px', fontWeight: 600 }}>设置</span>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="关闭"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9a9a9a',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 18px' }}>
          {loadError && (
            <div
              style={{
                marginTop: '12px',
                padding: '8px 10px',
                background: 'rgba(220, 50, 50, 0.12)',
                border: '1px solid rgba(220, 50, 50, 0.5)',
                borderRadius: '6px',
                color: '#ff9a9a',
                fontSize: '12px',
              }}
            >
              加载设置失败：{loadError}
            </div>
          )}

          {/* JimengCli_api */}
          <section style={sectionStyle}>
            <div
              style={{
                ...sectionTitleStyle,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>JimengCli_api 服务</span>
              <button
                type="button"
                onClick={handleTestJimeng}
                disabled={testingJimeng}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: testingJimeng ? '#333' : '#252525',
                  color: testingJimeng ? '#888' : '#cfcfcf',
                  cursor: testingJimeng ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                }}
              >
                {testingJimeng ? '测试中...' : '测试连接'}
              </button>
            </div>
            {renderTestResult(jimengTestResult)}
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-jimeng-base">
                  Base URL
                </label>
                <input
                  id="set-jimeng-base"
                  style={inputStyle}
                  value={form.jimengBaseUrl}
                  onChange={(e) => update('jimengBaseUrl', e.target.value)}
                  placeholder="http://localhost:3000"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-auth-mode">
                  鉴权方式
                </label>
                <select
                  id="set-auth-mode"
                  style={selectStyle}
                  value={form.authMode}
                  onChange={(e) => update('authMode', e.target.value as AuthMode)}
                >
                  {AUTH_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ ...fieldStyle, gridColumn: '1 / span 2' }}>
                <label style={labelStyle} htmlFor="set-api-key">
                  API Key / Cookie / Token
                </label>
                <input
                  id="set-api-key"
                  style={inputStyle}
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => update('apiKey', e.target.value)}
                  placeholder="根据鉴权方式填写"
                />
              </div>
            </div>
          </section>

          {/* LLM Provider */}
          <section style={sectionStyle}>
            <div
              style={{
                ...sectionTitleStyle,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>LLM Provider（OpenAI-compatible）</span>
              <button
                type="button"
                onClick={handleTestLlm}
                disabled={testingLlm}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: testingLlm ? '#333' : '#252525',
                  color: testingLlm ? '#888' : '#cfcfcf',
                  cursor: testingLlm ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                }}
              >
                {testingLlm ? '测试中...' : '测试连接'}
              </button>
            </div>
            {renderTestResult(llmTestResult)}
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-llm-base">
                  Base URL
                </label>
                <input
                  id="set-llm-base"
                  style={inputStyle}
                  value={form.llmBaseUrl}
                  onChange={(e) => update('llmBaseUrl', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-llm-model">
                  默认模型
                </label>
                <input
                  id="set-llm-model"
                  style={inputStyle}
                  value={form.llmModel}
                  onChange={(e) => update('llmModel', e.target.value)}
                  placeholder="gpt-4o-mini"
                />
              </div>
              <div style={{ ...fieldStyle, gridColumn: '1 / span 2' }}>
                <label style={labelStyle} htmlFor="set-llm-key">
                  API Key
                </label>
                <input
                  id="set-llm-key"
                  style={inputStyle}
                  type="password"
                  value={form.llmApiKey}
                  onChange={(e) => update('llmApiKey', e.target.value)}
                  placeholder="sk-..."
                />
              </div>
            </div>
          </section>

          {/* 输出 */}
          <section style={sectionStyle}>
            <div style={sectionTitleStyle}>输出</div>
            <div style={gridStyle}>
              <div style={{ ...fieldStyle, gridColumn: '1 / span 2' }}>
                <label style={labelStyle} htmlFor="set-output-dir">
                  输出目录（相对项目根）
                </label>
                <input
                  id="set-output-dir"
                  style={inputStyle}
                  value={form.outputDir}
                  onChange={(e) => update('outputDir', e.target.value)}
                  placeholder="./workspace/outputs"
                />
              </div>
            </div>
          </section>

          {/* 默认参数 */}
          <section style={sectionLastStyle}>
            <div style={sectionTitleStyle}>默认参数</div>
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-default-model">
                  图片模型
                </label>
                <input
                  id="set-default-model"
                  style={inputStyle}
                  value={form.defaultModel}
                  onChange={(e) => update('defaultModel', e.target.value)}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-default-size">
                  图片尺寸
                </label>
                <input
                  id="set-default-size"
                  style={inputStyle}
                  value={form.defaultSize}
                  onChange={(e) => update('defaultSize', e.target.value)}
                  placeholder="1024x1024"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-video-model">
                  视频模型
                </label>
                <input
                  id="set-video-model"
                  style={inputStyle}
                  value={form.defaultVideoModel}
                  onChange={(e) => update('defaultVideoModel', e.target.value)}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-video-ratio">
                  视频比例
                </label>
                <input
                  id="set-video-ratio"
                  style={inputStyle}
                  value={form.defaultVideoAspectRatio}
                  onChange={(e) => update('defaultVideoAspectRatio', e.target.value)}
                  placeholder="16:9"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-video-res">
                  视频分辨率
                </label>
                <input
                  id="set-video-res"
                  style={inputStyle}
                  value={form.defaultVideoResolution}
                  onChange={(e) => update('defaultVideoResolution', e.target.value)}
                  placeholder="720P"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-video-quality">
                  视频清晰度
                </label>
                <input
                  id="set-video-quality"
                  style={inputStyle}
                  value={form.defaultVideoQuality}
                  onChange={(e) => update('defaultVideoQuality', e.target.value)}
                  placeholder="standard"
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-video-duration">
                  视频时长（秒）
                </label>
                <input
                  id="set-video-duration"
                  style={inputStyle}
                  type="number"
                  min={1}
                  value={form.defaultVideoDurationSeconds}
                  onChange={(e) =>
                    update('defaultVideoDurationSeconds', Number(e.target.value) || 0)
                  }
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-video-count">
                  视频数量
                </label>
                <input
                  id="set-video-count"
                  style={inputStyle}
                  type="number"
                  min={1}
                  value={form.defaultVideoCount}
                  onChange={(e) => update('defaultVideoCount', Number(e.target.value) || 0)}
                />
              </div>
              <div style={{ ...fieldStyle, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input
                  id="set-video-audio"
                  type="checkbox"
                  checked={form.defaultVideoGenerateAudio}
                  onChange={(e) => update('defaultVideoGenerateAudio', e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <label style={{ ...labelStyle, cursor: 'pointer' }} htmlFor="set-video-audio">
                  视频默认生成音频
                </label>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '14px 18px',
            borderTop: '1px solid #2a2a2a',
            position: 'sticky',
            bottom: 0,
            background: '#1a1a1a',
          }}
        >
          {saveError && (
            <div style={{ marginRight: 'auto', color: '#ff9a9a', fontSize: '12px', alignSelf: 'center' }}>
              保存失败：{saveError}
            </div>
          )}
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #333',
              background: 'transparent',
              color: '#cfcfcf',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #4a4a4a',
              background: submitting ? '#3a3a3a' : '#2d2d2d',
              color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
