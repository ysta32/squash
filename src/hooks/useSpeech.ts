import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechResultEvent {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }>
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

export function useSpeech(opts: {
  onFinal: (text: string) => void
  onInterim: (text: string) => void
}): {
  supported: boolean
  listening: boolean
  start(): void
  stop(): void
  toggle(): void
  error: string | null
} {
  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognition = useRef<SpeechRecognitionInstance | null>(null)
  const requested = useRef(false)
  const callbacks = useRef(opts)

  useEffect(() => {
    callbacks.current = opts
  }, [opts])

  useEffect(() => {
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Constructor) return
    const instance = new Constructor()
    recognition.current = instance
    instance.continuous = true
    instance.interimResults = true
    instance.lang = navigator.language
    instance.onresult = (event) => {
      let finalChunk = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          if (i >= event.resultIndex) finalChunk += result[0].transcript
        } else interimText += result[0].transcript
      }
      if (finalChunk) callbacks.current.onFinal(finalChunk)
      callbacks.current.onInterim(interimText)
    }
    instance.onerror = (event) => {
      if (event.error === 'no-speech') return
      requested.current = false
      setListening(false)
      setError(event.error === 'not-allowed' ? 'Microphone permission denied' : event.error)
      callbacks.current.onInterim('')
    }
    instance.onend = () => {
      if (!requested.current) return
      try {
        instance.start()
      } catch (cause) {
        requested.current = false
        setListening(false)
        setError(cause instanceof Error ? cause.message : 'Speech recognition failed')
      }
    }
    return () => {
      requested.current = false
      recognition.current = null
      instance.onresult = null
      instance.onerror = null
      instance.onend = null
      instance.abort()
    }
  }, [])

  const start = useCallback(() => {
    if (requested.current || !recognition.current) return
    try {
      recognition.current.start()
      requested.current = true
      setListening(true)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Speech recognition failed')
    }
  }, [])

  const stop = useCallback(() => {
    requested.current = false
    setListening(false)
    callbacks.current.onInterim('')
    try {
      recognition.current?.stop()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Speech recognition failed')
    }
  }, [])

  const toggle = useCallback(() => {
    if (requested.current) stop()
    else start()
  }, [start, stop])

  return { supported, listening, start, stop, toggle, error }
}
