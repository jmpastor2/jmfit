/**
 * Rest timer shared by the session screen and the bar shown on other screens. It stores the
 * moment the rest ends (not a countdown), so it survives the screen locking, a reload or
 * leaving the app: when you come back it shows the right time, or that the rest is over.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

export interface RestState {
  endsAt: number
  totalSec: number
  label: string
}

const KEY = 'forja.rest'
const listeners = new Set<() => void>()
let state: RestState | null = read()

function read(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RestState) : null
  } catch {
    return null
  }
}

function write(next: RestState | null) {
  state = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: the timer still works for this page */
  }
  listeners.forEach((l) => l())
}

export const restTimer = {
  start(totalSec: number, label: string) {
    unlockAudio()
    write({ endsAt: Date.now() + totalSec * 1000, totalSec, label })
  },
  add(sec: number) {
    if (!state) return
    const endsAt = Math.max(Date.now(), state.endsAt + sec * 1000)
    write({ ...state, endsAt, totalSec: Math.max(1, state.totalSec + sec) })
  },
  stop() {
    write(null)
  },
}

/** Every change of the rest (started, extended, stopped), for the push alarm sync. */
export function onRestChange(l: (rest: RestState | null) => void): () => void {
  const wrapped = () => l(state)
  listeners.add(wrapped)
  return () => listeners.delete(wrapped)
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

const secondsLeft = (rest: RestState | null) =>
  rest ? Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000)) : 0

/**
 * Current rest and the seconds left. Checks four times a second but only re-renders when the
 * second shown changes.
 */
export function useRest(): { rest: RestState | null; left: number } {
  const rest = useSyncExternalStore(subscribe, () => state)
  const [tick, setTick] = useState(() => ({ rest, left: secondsLeft(rest) }))
  useEffect(() => {
    const update = () =>
      setTick((prev) => {
        const left = secondsLeft(rest)
        return prev.rest === rest && prev.left === left ? prev : { rest, left }
      })
    update()
    if (!rest) return
    const t = window.setInterval(update, 250)
    return () => window.clearInterval(t)
  }, [rest])
  return { rest, left: tick.rest === rest ? tick.left : secondsLeft(rest) }
}

/** Fires once when a rest reaches zero: vibration where supported and a short double beep. */
export function useRestAlarm(enabled: boolean, endsAt: number | undefined, left: number) {
  const firedFor = useRef<number | null>(null)
  useEffect(() => {
    if (!endsAt || left > 0 || firedFor.current === endsAt) return
    firedFor.current = endsAt
    // Only alarm for rests that ended a moment ago, not one that ended while the app was closed.
    if (Date.now() - endsAt > 5000) return
    navigator.vibrate?.([180, 90, 180])
    if (enabled) beep()
  }, [endsAt, left, enabled])
}

let ctx: AudioContext | null = null

/** iOS only lets a page play sound after a tap: open the audio context on the "done" tap. */
function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

function beep() {
  if (!ctx) return
  const t0 = ctx.currentTime
  for (const [at, freq] of [
    [0, 880],
    [0.22, 1320],
  ] as const) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t0 + at)
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.18)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0 + at)
    osc.stop(t0 + at + 0.2)
  }
}

export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
