/** Brand colours as defined in src/index.css (the press test checks every hex is still there). */
export interface PressColor {
  name: string
  token: string
  hex: string
  /** Text colour that reads on the swatch. */
  ink: string
  note: string
}

export const PRESS_COLORS: PressColor[] = [
  {
    name: 'Marker red',
    token: '--accent',
    hex: '#C92A14',
    ink: '#FFFFFF',
    note: 'The one colour, set as type',
  },
  {
    name: 'Marker red, drawn',
    token: '--markup',
    hex: '#FF3B20',
    ink: '#FFFFFF',
    note: 'Strokes drawn over a screenshot',
  },
  {
    name: 'Marker red, dark',
    token: '--accent',
    hex: '#FF5236',
    ink: '#180502',
    note: 'The one colour, in the negative',
  },
  { name: 'Sheet', token: '--bg', hex: '#FAF9F7', ink: '#000000', note: 'Light background' },
  { name: 'Ink', token: '--text-1', hex: '#000000', ink: '#FAF9F7', note: 'Text on the sheet' },
  { name: 'Negative', token: '--bg', hex: '#0B0B0B', ink: '#F4F3F1', note: 'Dark background' },
  {
    name: 'Negative ink',
    token: '--text-1',
    hex: '#F4F3F1',
    ink: '#0B0B0B',
    note: 'Text in the negative',
  },
  {
    name: 'Wash',
    token: '--highlight',
    hex: '#FFDCD4',
    ink: '#000000',
    note: 'Highlights and selection',
  },
]
