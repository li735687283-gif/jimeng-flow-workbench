import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  pushX: number
  pushY: number
  phase: number
}

const SPACING = 42
const BASE_RADIUS = 1.7
const SYMBOL_SIZE = 14
const REPEL_RADIUS = 136
const REPEL_FORCE = 28
const LERP = 0.16
const FALL_SPEED = 0.24
const BASE_COLOR = [255, 255, 255, 0.13] as const
const HOT_COLOR = [255, 215, 0, 0.82] as const
const SYMBOL_THRESHOLD = 0.25

function mixChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function particleColor(hot: number, alpha: number): string {
  return `rgba(${mixChannel(BASE_COLOR[0], HOT_COLOR[0], hot)}, ${mixChannel(
    BASE_COLOR[1],
    HOT_COLOR[1],
    hot,
  )}, ${mixChannel(BASE_COLOR[2], HOT_COLOR[2], hot)}, ${(
    (BASE_COLOR[3] + (HOT_COLOR[3] - BASE_COLOR[3]) * hot) *
    alpha
  ).toFixed(3)})`
}

export function HomeParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const pointer = { x: -9999, y: -9999, active: false }
    let particles: Particle[] = []
    let raf = 0
    let idleTimer = 0
    let lastFrame = performance.now()
    let lastPointerMove = 0
    let viewW = 0
    let viewH = 0
    let trackLength = 0

    const resize = () => {
      viewW = window.innerWidth
      viewH = window.innerHeight
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      canvas.width = Math.floor(viewW * dpr)
      canvas.height = Math.floor(viewH * dpr)
      canvas.style.width = `${viewW}px`
      canvas.style.height = `${viewH}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const rowCount = Math.ceil((viewH + SPACING * 2) / SPACING)
      trackLength = rowCount * SPACING
      particles = []
      for (let row = 0; row < rowCount; row += 1) {
        const y = -SPACING + row * SPACING
        for (let x = SPACING / 2; x < viewW; x += SPACING) {
          particles.push({
            x,
            y,
            pushX: 0,
            pushY: 0,
            phase: Math.random() * Math.PI * 2,
          })
        }
      }
    }

    const updatePointer = (event: PointerEvent | MouseEvent) => {
      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.active = true
      lastPointerMove = performance.now()
    }

    const clearPointer = () => {
      pointer.x = -9999
      pointer.y = -9999
      pointer.active = false
    }

    const draw = (now: number) => {
      const dt = Math.min(48, now - lastFrame)
      lastFrame = now
      const speed = dt / 16.667
      const pointerFresh = pointer.active && now - lastPointerMove < 1400
      if (!pointerFresh) pointer.active = false

      ctx.clearRect(0, 0, viewW, viewH)
      for (const particle of particles) {
        if (!reducedMotion) {
          particle.y += FALL_SPEED * speed
          if (particle.y > trackLength - SPACING) particle.y -= trackLength
        }

        let hot = 0
        let targetX = 0
        let targetY = 0
        if (pointerFresh) {
          const dx = particle.x - pointer.x
          const dy = particle.y - pointer.y
          const distSq = dx * dx + dy * dy
          if (distSq < REPEL_RADIUS * REPEL_RADIUS) {
            const dist = Math.sqrt(distSq) || 1
            const power = 1 - dist / REPEL_RADIUS
            hot = power * power
            targetX = (dx / dist) * hot * REPEL_FORCE
            targetY = (dy / dist) * hot * REPEL_FORCE
          }
        }

        particle.pushX += (targetX - particle.pushX) * LERP
        particle.pushY += (targetY - particle.pushY) * LERP

        const breath = (Math.sin(now * 0.0013 + particle.phase) + 1) * 0.5
        const px = particle.x + particle.pushX
        const py = particle.y + particle.pushY
        const alpha = 0.64 + breath * 0.36

        if (hot > SYMBOL_THRESHOLD) {
          const symbolAlpha = Math.min(1, (hot - SYMBOL_THRESHOLD) / (1 - SYMBOL_THRESHOLD)) * alpha
          ctx.save()
          ctx.fillStyle = particleColor(hot, symbolAlpha)
          ctx.font = `bold ${SYMBOL_SIZE}px "Microsoft YaHei", "SimHei", Arial, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('¥', px, py)
          ctx.restore()
        } else {
          const radius = BASE_RADIUS + breath * 0.42 + hot * 1.2
          const dotAlpha = alpha * (1 - Math.max(0, (hot - 0) / SYMBOL_THRESHOLD) * 0.3)
          ctx.fillStyle = particleColor(hot, dotAlpha)
          ctx.beginPath()
          ctx.arc(px, py, radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (reducedMotion) return
      if (pointerFresh) {
        raf = window.requestAnimationFrame(draw)
      } else {
        idleTimer = window.setTimeout(() => {
          raf = window.requestAnimationFrame(draw)
        }, 33)
      }
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', updatePointer, { passive: true })
    window.addEventListener('mousemove', updatePointer, { passive: true })
    window.addEventListener('pointerdown', updatePointer, { passive: true })
    window.addEventListener('mousedown', updatePointer, { passive: true })
    window.addEventListener('pointerleave', clearPointer)
    window.addEventListener('blur', clearPointer)
    draw(performance.now())

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(idleTimer)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', updatePointer)
      window.removeEventListener('mousemove', updatePointer)
      window.removeEventListener('pointerdown', updatePointer)
      window.removeEventListener('mousedown', updatePointer)
      window.removeEventListener('pointerleave', clearPointer)
      window.removeEventListener('blur', clearPointer)
    }
  }, [])

  return <canvas className="home-particle-field" aria-hidden="true" ref={canvasRef} />
}
