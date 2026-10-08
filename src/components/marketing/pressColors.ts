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
    name: 'Viridian',
    token: '--accent',
    hex: '#0D6B57',
    ink: '#FFFFFF',
    note: 'The accent, on paper',
  },
  {
    name: 'Viridian, dark',
    token: '--accent',
    hex: '#4CC4A3',
    ink: '#0B1F1A',
    note: 'The accent, in the darkroom',
  },
  { name: 'Paper', token: '--bg', hex: '#F5F3EE', ink: '#1C1B18', note: 'Light background' },
  { name: 'Ink', token: '--text-1', hex: '#1C1B18', ink: '#F5F3EE', note: 'Text on paper' },
  { name: 'Darkroom', token: '--bg', hex: '#141412', ink: '#EDEAE3', note: 'Dark background' },
  {
    name: 'Darkroom ink',
    token: '--text-1',
    hex: '#EDEAE3',
    ink: '#141412',
    note: 'Text in the darkroom',
  },
  {
    name: 'Marker red',
    token: '--markup',
    hex: '#E0321C',
    ink: '#FFFFFF',
    note: 'Annotations only',
  },
  {
    name: 'Marker yellow',
    token: '--highlight',
    hex: '#F9E27D',
    ink: '#1C1B18',
    note: 'Highlights and selection',
  },
]
