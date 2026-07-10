import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowRight,
  ChevronDown,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react'

interface PromptTemplate {
  id: string
  title: string
  category: string
  description: string
  prompt: string
  source: 'builtin' | 'custom'
}

interface PromptTemplateLibraryProps {
  currentPrompt: string
  style?: CSSProperties
  onApply: (prompt: string) => void
  onClose: () => void
}

const CUSTOM_PROMPT_TEMPLATES_KEY = 'jimeng-flow.customPromptTemplates'

const BUILTIN_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'builtin-character-cinematic',
    title: '电影角色设定',
    category: '角色',
    description: '主体、服装、动作、氛围一次性补齐',
    prompt:
      '主体：一个极具辨识度的角色，清晰的面部特征和服装层次。动作与构图：角色处于动态姿态，镜头为电影感中景，主体占据画面中心。风格与色彩：高质量 3D 渲染质感，细腻材质，柔和但有方向性的光线，背景与主体形成明确层次。',
    source: 'builtin',
  },
  {
    id: 'builtin-product-hero',
    title: '产品主视觉',
    category: '产品',
    description: '适合电商首图、广告海报、详情页头图',
    prompt:
      '主体：产品位于画面中心，轮廓清晰，材质真实。构图：干净的商业摄影构图，前景与背景层次分明，留出品牌文案空间。光影：柔和棚拍光，高级反光，细节锐利。整体风格：现代、高端、可信赖，适合商业广告主视觉。',
    source: 'builtin',
  },
  {
    id: 'builtin-shot-continuity',
    title: '连续分镜参考',
    category: '分镜',
    description: '同一主体的多机位、多角度参考',
    prompt:
      '同一主体在同一场景中连续呈现，保持角色外观、服装、道具和环境一致。画面包含多个不同机位：远景建立环境，中景表现动作，近景突出表情和细节。整体保持统一光影、色彩和电影感叙事节奏。',
    source: 'builtin',
  },
  {
    id: 'builtin-lighting-texture',
    title: '细碎处理',
    category: '光影',
    description: '强化材质、微细节和真实光感',
    prompt:
      '避免细节堆砌。画面风格要求：柔焦边缘，克制的细节表达，大色块优先，材质统一干净，避免堆砌细碎纹理，整体通透高级。参考电影摄影质感：浅景深柔光、自然胶片颗粒、精心打光的电影剧照，而不是高清数码照片。',
    source: 'builtin',
  },
  {
    id: 'builtin-style-board',
    title: '风格板',
    category: '风格',
    description: '快速建立统一的视觉语言',
    prompt:
      '生成一张风格板，用于定义项目的视觉语言。包含主色调、材质方向、光影气质、构图参考和氛围关键词。画面整体统一、克制、可延展，适合作为后续图片和视频生成的风格参考。',
    source: 'builtin',
  },
]

function readCustomTemplates(): PromptTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PROMPT_TEMPLATES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is PromptTemplate =>
        typeof item?.id === 'string' &&
        typeof item?.title === 'string' &&
        typeof item?.prompt === 'string',
    )
  } catch {
    return []
  }
}

export function PromptTemplateLibrary({
  currentPrompt: _currentPrompt,
  style,
  onApply,
  onClose,
}: PromptTemplateLibraryProps) {
  const [customTemplates, setCustomTemplates] = useState<PromptTemplate[]>([])
  const [category, setCategory] = useState('全部')
  const [savedId, setSavedId] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const categoryFieldRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setCustomTemplates(readCustomTemplates())
  }, [])

  useEffect(() => {
    if (!categoryDropdownOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!categoryFieldRef.current) return
      if (categoryFieldRef.current.contains(event.target as Node)) return
      setCategoryDropdownOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [categoryDropdownOpen])

  const templates = useMemo(
    () => [...customTemplates, ...BUILTIN_PROMPT_TEMPLATES],
    [customTemplates],
  )
  const categories = useMemo(() => {
    const builtinCats = BUILTIN_PROMPT_TEMPLATES.map((item) => item.category)
    const customCats = customTemplates
      .filter((item) => item.category && item.category !== '我的')
      .map((item) => item.category)
    return ['全部', '我的', ...Array.from(new Set([...builtinCats, ...customCats]))]
  }, [customTemplates])
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesCategory =
        category === '全部' ||
        (category === '我的' ? template.source === 'custom' : template.category === category)
      return matchesCategory
    })
  }, [category, templates])

  const persistCustomTemplates = (nextTemplates: PromptTemplate[]) => {
    setCustomTemplates(nextTemplates)
    localStorage.setItem(CUSTOM_PROMPT_TEMPLATES_KEY, JSON.stringify(nextTemplates))
  }

  const handleDeleteCustomTemplate = (id: string) => {
    persistCustomTemplates(customTemplates.filter((template) => template.id !== id))
  }

  const handleOpenNew = () => {
    setNewTitle('')
    setNewCategory('')
    setNewPrompt('')
    setNewOpen(true)
  }

  const handleSaveNew = () => {
    const title = newTitle.trim()
    const prompt = newPrompt.trim()
    if (!title || !prompt) return
    const cat = newCategory.trim() || '我的'
    const nextTemplate: PromptTemplate = {
      id: `custom_${Date.now()}`,
      title,
      category: cat,
      description: '自定义模板',
      prompt,
      source: 'custom',
    }
    persistCustomTemplates([nextTemplate, ...customTemplates])
    setCategory(cat)
    setSavedId(nextTemplate.id)
    setNewOpen(false)
  }

  const categoryOptions = useMemo(
    () => categories.filter((item) => item !== '全部' && item !== '我的'),
    [categories],
  )

  return (
    <section className="prompt-template-library" style={style}>
      <header className="prompt-template-library-head">
        <strong className="prompt-template-library-title">提示词模板库</strong>
        <button type="button" onClick={onClose} aria-label="关闭模板库">
          <X size={18} strokeWidth={1.8} />
        </button>
      </header>

      <div className="prompt-template-library-controls">
        <button
          type="button"
          className="prompt-template-new-btn"
          onClick={handleOpenNew}
        >
          <Plus size={16} strokeWidth={1.8} />
          <span>新建</span>
        </button>
      </div>

      {newOpen ? (
        <div className="prompt-template-new-form">
          <label className="prompt-template-new-field">
            <span>标题</span>
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="输入模板标题"
            />
          </label>
          <div
            className="prompt-template-new-field prompt-template-category-select"
            ref={categoryFieldRef}
          >
            <span>分类</span>
            <button
              type="button"
              className="prompt-template-category-trigger"
              onClick={() => setCategoryDropdownOpen((open) => !open)}
            >
              <span>{newCategory || '选择或输入分类'}</span>
              <ChevronDown size={14} strokeWidth={1.8} />
            </button>
            {categoryDropdownOpen ? (
              <div className="prompt-template-category-dropdown">
                {categoryOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`prompt-template-category-option${
                      item === newCategory ? ' active' : ''
                    }`}
                    onClick={() => {
                      setNewCategory(item)
                      setCategoryDropdownOpen(false)
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
            <input
              className="prompt-template-category-input"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="或自定义分类名"
            />
          </div>
          <label className="prompt-template-new-field prompt-template-new-prompt-field">
            <span>提示词</span>
            <textarea
              value={newPrompt}
              onChange={(event) => setNewPrompt(event.target.value)}
              placeholder="粘贴提示词内容..."
            />
          </label>
          <div className="prompt-template-new-actions">
            <button
              type="button"
              className="prompt-template-new-cancel"
              onClick={() => setNewOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="prompt-template-new-save"
              onClick={handleSaveNew}
              disabled={!newTitle.trim() || !newPrompt.trim()}
            >
              保存
            </button>
          </div>
        </div>
      ) : null}

      <div className="prompt-template-tabs">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={item === category ? 'active' : ''}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="prompt-template-list">
        {filteredTemplates.map((template) => (
          <article
            className={`prompt-template-card${template.id === savedId ? ' saved' : ''}`}
            key={template.id}
          >
            <div className="prompt-template-card-head">
              <div>
                <strong>{template.title}</strong>
              </div>
              {template.source === 'custom' ? (
                <button
                  type="button"
                  className="prompt-template-delete"
                  onClick={() => handleDeleteCustomTemplate(template.id)}
                  aria-label="删除收藏"
                >
                  <Trash2 size={15} strokeWidth={1.8} />
                </button>
              ) : (
                <Star size={15} strokeWidth={1.8} />
              )}
            </div>
            <div className="prompt-template-preview">{template.prompt}</div>
            <button
              type="button"
              className="prompt-template-apply"
              onClick={() => {
                onApply(template.prompt)
                onClose()
              }}
              aria-label="应用模板"
              title="应用模板"
            >
              <ArrowRight size={15} strokeWidth={1.8} />
            </button>
          </article>
        ))}
        {filteredTemplates.length === 0 ? (
          <div className="prompt-template-empty">没有找到匹配的模板</div>
        ) : null}
      </div>
    </section>
  )
}
