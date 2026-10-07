export type Tool = 'arrow' | 'box' | 'pen'
export type Point = { x: number; y: number }
export type Shape = { tool: Tool; color: string; width: number; points: Point[] }

export function arrowHead(from: Point, to: Point, size: number): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  return [
    {
      x: to.x - size * Math.cos(angle - Math.PI / 6),
      y: to.y - size * Math.sin(angle - Math.PI / 6),
    },
    {
      x: to.x - size * Math.cos(angle + Math.PI / 6),
      y: to.y - size * Math.sin(angle + Math.PI / 6),
    },
  ]
}

export function strokeWidthFor(imageWidth: number): number {
  return Math.min(16, Math.max(4, imageWidth * 0.008))
}

export function drawShapes(ctx: CanvasRenderingContext2D, shapes: Shape[]): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const style = getComputedStyle(document.documentElement)
  for (const shape of shapes) {
    if (shape.points.length < 2) continue
    const first = shape.points[0]
    const last = shape.points[shape.points.length - 1]
    const token = /^var\((--[\w-]+)\)$/.exec(shape.color)
    ctx.strokeStyle = token ? style.getPropertyValue(token[1]).trim() : shape.color
    ctx.lineWidth = shape.width
    if (shape.tool === 'box') {
      ctx.strokeRect(first.x, first.y, last.x - first.x, last.y - first.y)
      continue
    }
    ctx.beginPath()
    ctx.moveTo(first.x, first.y)
    if (shape.tool === 'pen') {
      for (const point of shape.points.slice(1)) ctx.lineTo(point.x, point.y)
    } else {
      ctx.lineTo(last.x, last.y)
      const [left, right] = arrowHead(first, last, shape.width * 4)
      ctx.moveTo(left.x, left.y)
      ctx.lineTo(last.x, last.y)
      ctx.lineTo(right.x, right.y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

export async function fitUnder(file: File, maxBytes: number): Promise<File> {
  if (file.size <= maxBytes) return file
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Could not load the marked-up image.'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create the marked-up image.')
    // JPEG has no alpha channel, so flatten transparency onto white.
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    )
    if (!blob || blob.type !== 'image/jpeg') throw new Error('Could not save the marked-up image.')
    if (blob.size > maxBytes) throw new Error('too-large')
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, {
      type: 'image/jpeg',
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
