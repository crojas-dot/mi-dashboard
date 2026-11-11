import 'server-only'
import { inflateSync } from 'node:zlib'
import { MAX_FILE_BYTES } from '@/lib/constants/publicForms'
import { isUuid, PublicFormsInputError } from '@/lib/server/publicForms/validation'

const FORM_FIELDS = new Set(['file', 'uploadToken', 'uploadId'])
const FORMATS: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['pdf'], 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'],
}
const MAX_DECODED_BYTES = 64 * 1024 * 1024

function invalidFile(): never { throw new PublicFormsInputError(415, 'unsupported_public_file') }

function validateRasterSize(width: number, height: number): void {
  // Un archivo pequeño puede expandirse a un raster enorme al abrirlo en el visor.
  if (!width || !height || width * height * 4 > MAX_DECODED_BYTES) invalidFile()
}

export function sanitizePublicFilename(value: string): string {
  const basename = value.replace(/\\/g, '/').split('/').pop() ?? ''
  const cleaned = basename.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^\p{L}\p{N}._ ()-]/gu, '_').replace(/\.{2,}/g, '.').replace(/^\.+/, '').trim()
  if (!cleaned || cleaned.length > 150) {
    const extension = cleaned.split('.').pop()?.toLowerCase()
    return extension && ['pdf', 'jpg', 'jpeg', 'png'].includes(extension) ? 'evidencia.' + extension : 'evidencia'
  }
  return cleaned
}

export function validatePublicUploadForm(form: FormData): { file: File; uploadToken: string; uploadId: string } {
  const seen = new Set<string>()
  for (const [key] of form.entries()) {
    if (!FORM_FIELDS.has(key) || seen.has(key)) throw new PublicFormsInputError()
    seen.add(key)
  }
  if (seen.size !== FORM_FIELDS.size) throw new PublicFormsInputError()
  const file = form.get('file')
  const uploadToken = form.get('uploadToken')
  const uploadId = form.get('uploadId')
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function'
    || typeof uploadToken !== 'string' || !uploadToken || uploadToken.length > 2048 || !isUuid(uploadId)) {
    throw new PublicFormsInputError()
  }
  return { file, uploadToken, uploadId: uploadId.toLowerCase() }
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function validatePng(bytes: Buffer): void {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) invalidFile()
  let cursor = 8
  let width = 0, height = 0, depth = 0, channels = 0, interlace = 0
  let hasHeader = false, hasPalette = false, hasData = false, dataEnded = false, hasEnd = false
  const compressed: Buffer[] = []
  while (cursor < bytes.length) {
    if (cursor + 12 > bytes.length) invalidFile()
    const length = bytes.readUInt32BE(cursor)
    if (length > MAX_FILE_BYTES || cursor + length + 12 > bytes.length) invalidFile()
    const kind = bytes.toString('ascii', cursor + 4, cursor + 8)
    if (!/^[A-Za-z]{4}$/.test(kind)) invalidFile()
    const data = bytes.subarray(cursor + 8, cursor + 8 + length)
    if (crc32(bytes.subarray(cursor + 4, cursor + 8 + length)) !== bytes.readUInt32BE(cursor + 8 + length)) invalidFile()
    if (!hasHeader && kind !== 'IHDR') invalidFile()
    if (kind === 'IHDR') {
      if (hasHeader || length !== 13) invalidFile()
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; interlace = data[12]
      validateRasterSize(width, height)
      const color = data[9]
      const depths: Record<number, readonly number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }
      if (!width || !height || !depths[color]?.includes(depth) || data[10] !== 0 || data[11] !== 0 || interlace > 1) invalidFile()
      channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color]
      hasHeader = true
    } else if (kind === 'PLTE') {
      if (hasPalette || hasData || !length || length > 768 || length % 3) invalidFile()
      hasPalette = true
    } else if (kind === 'IDAT') {
      if (dataEnded || (bytes[25] === 3 && !hasPalette)) invalidFile()
      hasData = true
      compressed.push(data)
    } else if (kind === 'IEND') {
      if (length || !hasData || cursor + 12 !== bytes.length) invalidFile()
      hasEnd = true
    } else {
      if (hasData) dataEnded = true
      // No interpretar extensiones críticas desconocidas ni PNG animado en el canal público.
      if (kind[0] === kind[0].toUpperCase() || ['acTL', 'fcTL', 'fdAT'].includes(kind)) invalidFile()
    }
    cursor += length + 12
  }
  if (!hasEnd) invalidFile()
  const passes = interlace === 0 ? [[0, 0, 1, 1]] : [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]]
  const rows: { bytes: number; count: number }[] = []
  let expected = 0
  for (const [x, y, dx, dy] of passes) {
    const passWidth = Math.max(0, Math.ceil((width - x) / dx)), passHeight = Math.max(0, Math.ceil((height - y) / dy))
    if (!passWidth || !passHeight) continue
    const rowBytes = Math.ceil(passWidth * channels * depth / 8)
    expected += (rowBytes + 1) * passHeight
    if (!Number.isSafeInteger(expected) || expected > MAX_DECODED_BYTES) invalidFile()
    rows.push({ bytes: rowBytes, count: passHeight })
  }
  let decoded: Buffer
  try { decoded = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected }) }
  catch { invalidFile() }
  if (decoded.length !== expected) invalidFile()
  let offset = 0
  for (const row of rows) {
    for (let number = 0; number < row.count; number++) {
      if (decoded[offset] > 4) invalidFile()
      offset += row.bytes + 1
    }
  }
}

function validateJpeg(bytes: Buffer): void {
  if (bytes.length < 30 || bytes[0] !== 0xff || bytes[1] !== 0xd8) invalidFile()
  let cursor = 2, frame = false, scan = false, quantization = false, huffman = false
  while (cursor < bytes.length) {
    if (bytes[cursor++] !== 0xff) invalidFile()
    while (bytes[cursor] === 0xff) cursor++
    const marker = bytes[cursor++]
    if (marker === 0xd9) {
      if (!frame || !scan || !quantization || !huffman || cursor !== bytes.length) invalidFile()
      return
    }
    if (marker === 0xd8 || marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) invalidFile()
    if (cursor + 2 > bytes.length) invalidFile()
    const length = bytes.readUInt16BE(cursor)
    if (length < 2 || cursor + length > bytes.length) invalidFile()
    if (marker === 0xdb) {
      if (length < 67) invalidFile()
      let table = cursor + 2
      while (table < cursor + length) {
        const descriptor = bytes[table++]
        if ((descriptor >> 4) > 1 || (descriptor & 15) > 3) invalidFile()
        table += (descriptor >> 4) === 0 ? 64 : 128
      }
      if (table !== cursor + length) invalidFile()
      quantization = true
    } else if (marker === 0xc4) {
      if (length < 20) invalidFile()
      let table = cursor + 2
      while (table < cursor + length) {
        const descriptor = bytes[table++]
        if ((descriptor >> 4) > 1 || (descriptor & 15) > 3 || table + 16 > cursor + length) invalidFile()
        let symbols = 0, capacity = 1
        for (let bit = 0; bit < 16; bit++) {
          capacity = capacity * 2 - bytes[table + bit]
          if (capacity < 0) invalidFile()
          symbols += bytes[table + bit]
        }
        if (!symbols || symbols > 256) invalidFile()
        table += 16 + symbols
      }
      if (table !== cursor + length) invalidFile()
      huffman = true
    } else if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (frame || length < 11) invalidFile()
      const components = bytes[cursor + 7]
      if (![1, 3, 4].includes(components) || length !== 8 + components * 3
        || ![8, 12].includes(bytes[cursor + 2]) || !bytes.readUInt16BE(cursor + 3) || !bytes.readUInt16BE(cursor + 5)) invalidFile()
      validateRasterSize(bytes.readUInt16BE(cursor + 5), bytes.readUInt16BE(cursor + 3))
      frame = true
    } else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) invalidFile()
    if (marker === 0xda) {
      const components = bytes[cursor + 2]
      if (!frame || ![1, 3, 4].includes(components) || length !== 6 + components * 2) invalidFile()
      scan = true
      cursor += length
      let entropyBytes = 0
      while (cursor < bytes.length) {
        if (bytes[cursor] !== 0xff) { cursor++; entropyBytes++; continue }
        const next = bytes[cursor + 1]
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) { cursor += 2; entropyBytes++; continue }
        break
      }
      if (!entropyBytes) invalidFile()
    } else cursor += length
  }
  invalidFile()
}

function rejectPdfActions(source: string): void {
  const names = source.replace(/#([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
  let checked = 0
  for (const match of names.matchAll(/\/(JavaScript|JS|Launch|EmbeddedFile|Filespec|RichMedia|XFA|OpenAction|AA|GoToR|SubmitForm|ImportData|Encrypt)\b/g)) {
    if (++checked > 8192) invalidFile()
    if (match[1] === 'OpenAction' && isPdfOpenDestination(names, match.index + match[0].length)) continue
    invalidFile()
  }
}

interface PdfToken { value: string; start: number; end: number; kind: 'name' | 'word' | 'delimiter' | 'string' }

function isBinaryPdfFont(bytes: Buffer): boolean {
  if (bytes.length < 12 || ![0x00010000, 0x4f54544f].includes(bytes.readUInt32BE(0))) return false
  const count = bytes.readUInt16BE(4), directoryEnd = 12 + count * 16
  if (!count || count > 128 || directoryEnd > bytes.length) return false
  const tables = new Map<string, { offset: number; length: number }>()
  for (let index = 0; index < count; index++) {
    const cursor = 12 + index * 16, tag = bytes.toString('ascii', cursor, cursor + 4)
    const offset = bytes.readUInt32BE(cursor + 8), length = bytes.readUInt32BE(cursor + 12)
    if (tables.has(tag) || offset < directoryEnd || offset > bytes.length || length > bytes.length - offset) return false
    tables.set(tag, { offset, length })
  }
  const head = tables.get('head'), profile = tables.get('maxp')
  return !!head && head.length >= 54 && bytes.readUInt32BE(head.offset + 12) === 0x5f0f3cf5
    && !!profile && profile.length >= 6
}
const PDF_SPACE = /[\x00\x09\x0a\x0c\x0d\x20]/
const PDF_DELIMITER = /[\x00\x09\x0a\x0c\x0d\x20()[\]<>/%]/
function pdfToken(source: string, offset: number): PdfToken | null {
  let cursor = offset
  while (cursor < source.length) {
    if (PDF_SPACE.test(source[cursor])) { cursor++; continue }
    if (source[cursor] === '%') { while (cursor < source.length && !/[\r\n]/.test(source[cursor])) cursor++; continue }
    break
  }
  if (cursor >= source.length) return null
  const start = cursor, char = source[cursor++]
  if (char === '(') {
    let depth = 1
    while (cursor < source.length && depth) {
      const value = source[cursor++]
      if (value === '\\') { cursor++; continue }
      if (value === '(' && ++depth > 64) invalidFile()
      if (value === ')') depth--
    }
    if (depth) invalidFile()
    return { value: '', start, end: cursor, kind: 'string' }
  }
  if (char === '<' && source[cursor] !== '<') {
    while (cursor < source.length && source[cursor] !== '>') { if (!/[0-9a-f\s]/i.test(source[cursor])) invalidFile(); cursor++ }
    if (cursor >= source.length) invalidFile()
    return { value: '', start, end: cursor + 1, kind: 'string' }
  }
  if ((char === '<' || char === '>') && source[cursor] === char) return { value: char + char, start, end: cursor + 1, kind: 'delimiter' }
  if ('[]>)'.includes(char)) return { value: char, start, end: cursor, kind: 'delimiter' }
  while (cursor < source.length && !PDF_DELIMITER.test(source[cursor])) cursor++
  if (char === '/') {
    const raw = source.slice(start + 1, cursor)
    if (/#(?![0-9a-f]{2})/i.test(raw)) invalidFile()
    return { value: raw.replace(/#([0-9a-f]{2})/gi, (_all, hex: string) => String.fromCharCode(parseInt(hex,16))), start, end: cursor, kind: 'name' }
  }
  return { value: source.slice(start,cursor), start, end: cursor, kind: 'word' }
}

function isPdfOpenDestination(source: string, offset: number): boolean {
  // OpenAction admite un destino de página o una acción. Solo esta forma cerrada
  // de destino es inocua; diccionarios y referencias a acciones siguen rechazados.
  const value = source.slice(offset, offset + 512)
  let cursor = 0
  const next = () => { const token = pdfToken(value, cursor); if (token) cursor = token.end; return token }
  if (next()?.value !== '[') return false
  const page = next(), generation = next(), reference = next(), mode = next()
  if (page?.kind !== 'word' || !/^[1-9]\d{0,9}$/.test(page.value)
    || generation?.kind !== 'word' || !/^\d{1,5}$/.test(generation.value) || Number(generation.value) > 65535
    || reference?.kind !== 'word' || reference.value !== 'R' || mode?.kind !== 'name') return false
  const parameters: Record<string, number> = { XYZ: 3, Fit: 0, FitH: 1, FitV: 1, FitR: 4, FitB: 0, FitBH: 1, FitBV: 1 }
  if (!Object.hasOwn(parameters, mode.value)) return false
  for (let index = 0; index < parameters[mode.value]; index++) {
    const parameter = next()
    if (parameter?.kind !== 'word') return false
    if (parameter.value === 'null' && mode.value !== 'FitR') continue
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(parameter.value) || !Number.isFinite(Number(parameter.value))) return false
  }
  return next()?.value === ']'
}

function validatePdf(bytes: Buffer): void {
  const source = bytes.toString('latin1')
  if (!/^%PDF-(?:1\.[0-7]|2\.0)(?:\r\n|\n|\r)/.test(source)) invalidFile()
  const trailer = /startxref\s+(\d+)\s+%%EOF[\x00\x09\x0a\x0c\x0d\x20]*$/.exec(source)
  if (!trailer) invalidFile()
  const xref = Number(trailer[1])
  const xrefHeader = source.slice(xref,xref+2048).replace(/#([0-9a-f]{2})/gi, (_all,hex: string)=>String.fromCharCode(parseInt(hex,16)))
  if (!Number.isSafeInteger(xref) || xref < 9 || xref >= bytes.length
    || !/^\s*(?:xref\b|\d+\s+\d+\s+obj\b[\s\S]{0,2048}?\/Type\s*\/XRef\b)/.test(xrefHeader)) invalidFile()
  // Las referencias escalares se indexan una vez; nunca se vuelve a recorrer el prefijo por stream.
  const lengths = new Map<string,number>()
  const duplicateLengths = new Set<string>()
  for (const match of source.matchAll(/(?:^|[\r\n])(\d+)\s+(\d+)\s+obj\s+(\d+)\s+endobj\b/g)) {
    const key = match[1]+':'+match[2]
    if (lengths.has(key)) duplicateLengths.add(key)
    lengths.set(key,Number(match[3]))
    if (lengths.size > 8192) invalidFile()
  }
  let cursor=0, depth=0, arrays=0, objects=0, streams=0, tokens=0, decodedBytes=0, rootFound=false
  let dictionary: { length?: number; filter?: string; type?: string; subtype?: string } = {}
  let dictionaryKeys = new Set<string>()
  const forbidden = new Set(['JavaScript','JS','Launch','EmbeddedFile','Filespec','RichMedia','XFA','AA','GoToR','SubmitForm','ImportData','Encrypt'])
  while (cursor < source.length) {
    const token = pdfToken(source,cursor)
    if (!token) break
    cursor=token.end
    if (++tokens > 200000) invalidFile()
    if (token.kind === 'name' && forbidden.has(token.value)) invalidFile()
    if (token.kind === 'name' && token.value === 'OpenAction' && !isPdfOpenDestination(source, cursor)) invalidFile()
    if (token.value === 'obj') { if (++objects > 8192) invalidFile(); dictionary={} }
    if (token.value === '<<') { if (++depth > 64) invalidFile(); if (depth===1) { dictionary={}; dictionaryKeys=new Set() } }
    else if (token.value === '>>') { if (--depth < 0) invalidFile() }
    else if (token.value === '[') { if (++arrays > 64) invalidFile() }
    else if (token.value === ']') { if (--arrays < 0) invalidFile() }
    if (token.kind === 'name' && token.value === 'Root') rootFound=true
    if (token.kind === 'name' && depth === 1 && ['Length','Filter','Type','Subtype'].includes(token.value)) {
      if (dictionaryKeys.has(token.value)) invalidFile()
      dictionaryKeys.add(token.value)
      const next=pdfToken(source,cursor)
      if (!next) invalidFile()
      if (token.value==='Length') {
        if (!/^\d+$/.test(next.value)) invalidFile()
        const second=pdfToken(source,next.end), third=second?pdfToken(source,second.end):null
        if (second && /^\d+$/.test(second.value) && third?.value==='R') {
          const key=next.value+':'+second.value
          if (duplicateLengths.has(key) || !lengths.has(key)) invalidFile()
          dictionary.length=lengths.get(key)
        } else dictionary.length=Number(next.value)
      } else if (token.value==='Type' || token.value==='Subtype') {
        // No delegar la interpretación de tipos indirectos/ambiguos al visor.
        if (next.kind!=='name') invalidFile()
        if (token.value==='Type') dictionary.type=next.value
        else dictionary.subtype=next.value
      }
      else if (token.value==='Filter') {
        if (next.kind==='name') dictionary.filter=next.value
        else if (next.value==='[') {
          const filter=pdfToken(source,next.end), close=filter?pdfToken(source,filter.end):null
          dictionary.filter=filter?.kind==='name' && close?.value===']' ? filter.value : 'unsupported'
        } else invalidFile()
      }
    }
    if (token.kind==='word' && token.value==='stream') {
      if (depth!==0 || ++streams>2048 || !Number.isSafeInteger(dictionary.length) || dictionary.length!<0) invalidFile()
      const eol=/^(?:\r\n|\n|\r)/.exec(source.slice(cursor,cursor+2))
      if (!eol) invalidFile()
      const begin=cursor+eol[0].length, finish=begin+dictionary.length!
      if (finish>bytes.length) invalidFile()
      const close=pdfToken(source,finish)
      if (close?.value!=='endstream') invalidFile()
      // El cursor salta TODOS los bytes declarados, incluidos falsos delimitadores internos.
      cursor=close.end
      if (dictionary.type==='ObjStm' && dictionary.filter!=='FlateDecode') invalidFile()
      if (dictionary.filter && dictionary.filter!=='FlateDecode'
        && !(dictionary.type==='XObject' && dictionary.subtype==='Image' && ['DCTDecode','JPXDecode','CCITTFaxDecode','JBIG2Decode'].includes(dictionary.filter))) invalidFile()
      if (!dictionary.filter) rejectPdfActions(source.slice(begin,finish))
      if (dictionary.filter==='FlateDecode') {
        try {
          const decoded=inflateSync(bytes.subarray(begin,finish),{maxOutputLength:MAX_DECODED_BYTES-decodedBytes})
          decodedBytes+=decoded.length
          // Una fuente sfnt contiene bytes binarios que pueden coincidir con /AA.
          // ObjStm siempre se inspecciona: nunca tratar sus objetos como una fuente.
          if (dictionary.type === 'ObjStm' || !isBinaryPdfFont(decoded)) rejectPdfActions(decoded.toString('latin1'))
        } catch { invalidFile() }
      }
    }
  }
  if (depth || arrays || !rootFound || !objects) invalidFile()
}

export function validatePublicFile(file: Pick<File, 'name' | 'type' | 'size'>, bytes: Buffer): { filename: string; mimeType: string; size: number } {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || bytes.length !== file.size) throw new PublicFormsInputError()
  if (file.size > MAX_FILE_BYTES) throw new PublicFormsInputError(413, 'public_file_too_large')
  if (typeof file.name !== 'string' || !file.name || file.name.length > 255 || /[\u0000-\u001f\u007f]/.test(file.name)) invalidFile()
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!Object.hasOwn(FORMATS, file.type) || !FORMATS[file.type].includes(extension ?? '')) invalidFile()
  if (file.type === 'application/pdf') validatePdf(bytes)
  else if (file.type === 'image/png') validatePng(bytes)
  else validateJpeg(bytes)
  // Esto valida formato y estructura básica; no sustituye un servicio antimalware.
  return { filename: sanitizePublicFilename(file.name), mimeType: file.type, size: bytes.length }
}
