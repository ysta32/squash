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
  return Math.min(12, Math.max(3, imageWidth * 0.004))
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
