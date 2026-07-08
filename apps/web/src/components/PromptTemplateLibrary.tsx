import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  BookmarkPlus,
  Check,
  Search,
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

function getPromptTitle(prompt: string) {
  const firstLine = prompt.trim().split(/\r?\n/)[0]?.trim() ?? ''
  return firstLine.slice(0, 18) || '我的提示词'
}

export function PromptTemplateLibrary({
  currentPrompt,
  style,
  onApply,
  onClose,
}: PromptTemplateLibraryProps) {
  const [customTemplates, setCustomTemplates] = useState<PromptTemplate[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')
  const [savedId, setSavedId] = useState('')

  useEffect(() => {
    setCustomTemplates(readCustomTemplates())
  }, [])

  const templates = useMemo(
    () => [...customTemplates, ...BUILTIN_PROMPT_TEMPLATES],
    [customTemplates],
  )
  const categories = useMemo(() => {
    return ['全部', '我的', ...Array.from(new Set(BUILTIN_PROMPT_TEMPLATES.map((item) => item.category)))]
  }, [])
  const filteredTemplates = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return templates.filter((template) => {
      const matchesCategory =
        category === '全部' ||
        (category === '我的' ? template.source === 'custom' : template.category === category)
      if (!matchesCategory) return false
      if (!keyword) return true
      return `${template.title} ${template.description} ${template.prompt}`
        .toLowerCase()
        .includes(keyword)
    })
  }, [category, query, templates])

  const persistCustomTemplates = (nextTemplates: PromptTemplate[]) => {
    setCustomTemplates(nextTemplates)
    localStorage.setItem(CUSTOM_PROMPT_TEMPLATES_KEY, JSON.stringify(nextTemplates))
  }

  const handleSaveCurrent = () => {
    const prompt = currentPrompt.trim()
    if (!prompt) return
    const nextTemplate: PromptTemplate = {
      id: `custom_${Date.now()}`,
      title: getPromptTitle(prompt),
      category: '我的',
      description: '从当前节点收藏',
      prompt,
      source: 'custom',
    }
    persistCustomTemplates([nextTemplate, ...customTemplates])
    setCategory('我的')
    setSavedId(nextTemplate.id)
  }

  const handleDeleteCustomTemplate = (id: string) => {
    persistCustomTemplates(customTemplates.filter((template) => template.id !== id))
  }

  return (
    <section className="prompt-template-library" style={style}>
      <header className="prompt-template-library-head">
        <div>
          <strong>提示词模板库</strong>
          <span>内置标准库 + 我的收藏</span>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭模板库">
          <X size={18} strokeWidth={1.8} />
        </button>
      </header>

      <div className="prompt-template-library-controls">
        <label className="prompt-template-search">
          <Search size={16} strokeWidth={1.8} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模板..."
          />
        </label>
        <button
          type="button"
          className="prompt-template-save-current"
          onClick={handleSaveCurrent}
          disabled={!currentPrompt.trim()}
        >
          <BookmarkPlus size={16} strokeWidth={1.8} />
          <span>收藏当前</span>
        </button>
      </div>

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
                <span>{template.source === 'custom' ? '我的收藏' : template.category}</span>
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
            <p>{template.description}</p>
            <div className="prompt-template-preview">{template.prompt}</div>
            <button
              type="button"
              className="prompt-template-apply"
              onClick={() => {
                onApply(template.prompt)
                onClose()
              }}
            >
              {template.id === savedId ? <Check size={15} strokeWidth={1.8} /> : null}
              <span>应用模板</span>
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
