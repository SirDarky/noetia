import { useEffect, useRef } from 'react'
import { getTheme } from '../../lib/themes'
import { ASCII_RENDERING_ENABLED } from './renderingPolicy'

// Original Noetia renderer. Only time displaces the luminance field; pointer movement is ignored.
export function AnimatedAsciiBackdrop({ motion, theme, src = '/assets/witch.png', preview = false }: { motion: boolean; theme: string; src?: string; preview?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!ASCII_RENDERING_ENABLED) return
    const canvas = canvasRef.current!
    const context = canvas.getContext('2d')!
    const sample = document.createElement('canvas')
    const sampleContext = sample.getContext('2d', { willReadFrequently: true })!
    const image = new Image()
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const palette = getTheme(theme), lightTheme = palette.mode === 'light'
    const chars = ' .·:+=*#%@'
    const cellW = preview ? 3 : 5, cellH = preview ? 5 : 7
    let width = 0, height = 0, columns = 0, rows = 0
    let luminance = new Float32Array(0)
    let frame = 0, previous = 0, visible = true, disposed = false
    const animate = () => motion && !media.matches && visible && !document.hidden

    function draw(time: number) {
      context.clearRect(0, 0, width, height)
      context.font = `${preview ? 5 : 7}px Consolas, monospace`; context.textBaseline = 'top'
      const moving = animate()
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const x = col * cellW, y = row * cellH
          const wave = moving ? Math.sin(y * 0.013 + time * 0.00028) * 6 : 0
          const sx = Math.max(0, Math.min(columns - 1, Math.round(col + wave / cellW)))
          const value = luminance[row * columns + sx] ?? 0
          const glyph = chars[Math.min(chars.length - 1, Math.floor(value * (chars.length - 1)))]
          if (glyph === ' ') continue
          const fade = Math.min(1, Math.max(0, (height - y) / (height * 0.22)))
          context.fillStyle = `rgba(${palette.palette.ink},${(lightTheme ? .58 + value * .4 : .12 + value * .62) * fade})`
          context.fillText(glyph, x, y)
        }
      }
    }
    function tick(time: number) {
      frame = 0
      if (!animate() || disposed) return
      if (time - previous >= 1000 / 24) { draw(time); previous = time }
      frame = requestAnimationFrame(tick)
    }
    function play() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      if (!luminance.length || disposed) return
      draw(performance.now())
      if (animate()) frame = requestAnimationFrame(tick)
    }
    function resize() {
      if (!image.naturalWidth || disposed) return
      const rect = canvas.getBoundingClientRect()
      width = Math.round(rect.width); height = Math.round(rect.height)
      if (!width || !height) return
      const pixelRatio = Math.min(devicePixelRatio, 1.5)
      canvas.width = Math.round(width * pixelRatio); canvas.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      columns = Math.ceil(width / cellW); rows = Math.ceil(height / cellH)
      sample.width = columns; sample.height = rows
      const factor = preview ? Math.min(width / image.naturalWidth, height / image.naturalHeight) : Math.max(width / image.naturalWidth, height / image.naturalHeight)
      const iw = image.naturalWidth * factor / cellW, ih = image.naturalHeight * factor / cellH
      sampleContext.clearRect(0, 0, columns, rows)
      sampleContext.drawImage(image, (columns - iw) / 2, (rows - ih) / 2, iw, ih)
      const pixels = sampleContext.getImageData(0, 0, columns, rows).data
      luminance = new Float32Array(columns * rows)
      for (let i = 0; i < luminance.length; i++) {
        const light = (pixels[i * 4] * 0.21 + pixels[i * 4 + 1] * 0.72 + pixels[i * 4 + 2] * 0.07) / 255 * (pixels[i * 4 + 3] / 255)
        luminance[i] = Math.max(0, Math.min(1, (light - 0.035) * 2))
      }
      play()
    }
    const observer = new ResizeObserver(resize)
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; play() })
    observer.observe(canvas); intersection.observe(canvas)
    document.addEventListener('visibilitychange', play)
    media.addEventListener('change', play)
    image.onload = resize; image.src = src
    return () => {
      disposed = true; cancelAnimationFrame(frame)
      observer.disconnect(); intersection.disconnect(); image.onload = null
      document.removeEventListener('visibilitychange', play)
      media.removeEventListener('change', play)
    }
  }, [motion, theme, src, preview])
  return ASCII_RENDERING_ENABLED
    ? <canvas ref={canvasRef} className="ascii-backdrop" aria-hidden="true" />
    : <div className="ascii-backdrop" aria-hidden="true" data-rendering="paused" />
}
