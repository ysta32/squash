import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markdown, renderInline } from './markdown'

function html(source: string) {
  const { container } = render(<Markdown source={source} />)
  return container
}

describe('Markdown', () => {
  it('renders paragraphs and line breaks', () => {
    const c = html('one\ntwo\n\nthree')
    expect(c.querySelectorAll('p')).toHaveLength(2)
    expect(c.querySelectorAll('br')).toHaveLength(1)
  })

  it('renders bold, italic and inline code', () => {
    const c = html('**b** *i* _u_ `x < y`')
    expect(c.querySelector('strong')?.textContent).toBe('b')
    expect(Array.from(c.querySelectorAll('em')).map((e) => e.textContent)).toEqual(['i', 'u'])
    expect(c.querySelector('code')?.textContent).toBe('x < y')
  })

  it('renders fenced code blocks without interpreting contents', () => {
    const c = html('```\n**not bold**\n<b>x</b>\n```')
    expect(c.querySelector('pre code')?.textContent).toBe('**not bold**\n<b>x</b>')
    expect(c.querySelector('strong')).toBeNull()
  })

  it('renders bullet and ordered lists with nested emphasis', () => {
    const c = html('- **a** and *b*\n* two\n\n1. one\n2. `two`')
    expect(c.querySelectorAll('ul > li')).toHaveLength(2)
    expect(c.querySelector('ul li strong')?.textContent).toBe('a')
    expect(c.querySelector('ul li em')?.textContent).toBe('b')
    expect(c.querySelectorAll('ol > li')).toHaveLength(2)
    expect(c.querySelector('ol li code')?.textContent).toBe('two')
  })

  it('renders block quotes', () => {
    const c = html('> quoted **text**')
    expect(c.querySelector('blockquote strong')?.textContent).toBe('text')
  })

  it('renders http, https and mailto links safely', () => {
    const c = html('[a](https://x.dev/p) [m](mailto:a@b.co) see http://y.dev/z.')
    const links = Array.from(c.querySelectorAll('a'))
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://x.dev/p',
      'mailto:a@b.co',
      'http://y.dev/z',
    ])
    for (const a of links) {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toBe('noreferrer noopener')
    }
  })

  it('renders javascript: and data: links as text', () => {
    const c = html('[x](javascript:alert(1)) [y](data:text/html,hi)')
    expect(c.querySelector('a')).toBeNull()
    expect(c.textContent).toContain('[x](javascript:alert(1))')
  })

  it('renders mentions and bug refs', () => {
    const c = html('ping @Ana.Lee, see #123 and a@b.co')
    const spans = Array.from(c.querySelectorAll('span')).map((s) => s.textContent)
    expect(spans).toEqual(['@Ana.Lee', '#123'])
    expect(c.textContent).toContain('a@b.co')
  })

  it('never injects HTML', () => {
    const c = html('<img src=x onerror="alert(1)"> <script>bad()</script>')
    expect(c.querySelector('img')).toBeNull()
    expect(c.querySelector('script')).toBeNull()
    expect(c.textContent).toContain('<img src=x onerror="alert(1)">')
  })

  it('leaves unclosed markers literal', () => {
    const c = html('**bold and `code and *it and [x](')
    expect(c.querySelector('strong, code, em, a')).toBeNull()
    expect(c.textContent).toBe('**bold and `code and *it and [x](')
  })

  it('leaves an unclosed fence literal', () => {
    const c = html('```\ncode')
    expect(c.querySelector('pre')).toBeNull()
    expect(c.textContent).toContain('```')
  })

  it('does not italicise snake_case', () => {
    expect(html('use snake_case_name here').querySelector('em')).toBeNull()
  })
})

describe('renderInline', () => {
  it('returns plain strings for plain text', () => {
    expect(renderInline('hello')).toEqual(['hello'])
  })
})
