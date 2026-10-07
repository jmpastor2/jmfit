import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

/** SVG markup of a QR for `text`: black on white, quiet zone of 2 modules. */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  })
}

export const svgDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

/** QR SVG markup for each text, keyed by text; empty until generated. */
export function useQrSvgs(texts: readonly string[]): Record<string, string> {
  const [out, setOut] = useState<Record<string, string>>({})
  const key = texts.join('\n')
  useEffect(() => {
    let cancelled = false
    const list = key ? key.split('\n') : []
    void Promise.all(list.map(async (t) => [t, await qrSvg(t)] as const)).then((pairs) => {
      if (!cancelled) setOut(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [key])
  return out
}

/**
 * Share the QR as an SVG file (the phone's share sheet: save to Photos, send to a printer…), or
 * download it where sharing files is not supported. Returns what happened.
 */
export async function shareOrDownloadSvg(
  svg: string,
  fileName: string,
  title: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([svg], fileName, { type: 'image/svg+xml' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
      // Fall through to a download when the share sheet fails for another reason.
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
