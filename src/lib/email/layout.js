// Turns a list of content blocks into an HTML email and a plain-text email.
// Email clients ignore stylesheets and classes, so the HTML uses inline styles (the one place the site does not use Tailwind).
// Colours match the site palette in src/styles/global.css.
import { location, phone, site } from '../../data/site.js'

const C = { navy: '#003049', red: '#c1121f', cream: '#fdf0d5', paper: '#fef8ee', muted: '#4a5a66', line: '#dfe3e6' }
const FONT = "'DM Sans', Helvetica, Arial, sans-serif"

const escape = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])

/**
 * Blocks: { h: 'Heading' } · { p: 'Paragraph' } · { note: 'Highlighted paragraph' } · { details: [[label, value], ...] }
 *         { list: ['item', ...] } · { button: { label, url } } · { small: 'Fine print' }
 */
function blockHtml(block) {
  if (block.h) return `<h2 style="margin:28px 0 10px;font:700 18px/1.3 ${FONT};color:${C.navy}">${escape(block.h)}</h2>`
  if (block.p) return `<p style="margin:0 0 14px;font:400 15px/1.6 ${FONT};color:${C.navy}">${escape(block.p)}</p>`
  if (block.small) return `<p style="margin:0 0 12px;font:400 13px/1.55 ${FONT};color:${C.muted}">${escape(block.small)}</p>`
  if (block.note) {
    return `<p style="margin:0 0 16px;padding:12px 16px;border-left:4px solid ${C.red};background:${C.cream};font:600 14px/1.55 ${FONT};color:${C.navy}">${escape(block.note)}</p>`
  }
  if (block.list) {
    const items = block.list.map((item) => `<li style="margin:0 0 6px">${escape(item)}</li>`).join('')
    return `<ul style="margin:0 0 16px;padding-left:20px;font:400 15px/1.55 ${FONT};color:${C.navy}">${items}</ul>`
  }
  if (block.details) {
    const rows = block.details
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(
        ([label, value]) =>
          `<tr><td style="padding:9px 12px 9px 0;border-bottom:1px solid ${C.line};font:400 13px/1.4 ${FONT};color:${C.muted};white-space:nowrap;vertical-align:top">${escape(label)}</td>` +
          `<td style="padding:9px 0;border-bottom:1px solid ${C.line};font:700 15px/1.4 ${FONT};color:${C.navy}">${escape(value)}</td></tr>`,
      )
      .join('')
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border-collapse:collapse">${rows}</table>`
  }
  if (block.button) {
    return `<p style="margin:6px 0 20px"><a href="${escape(block.button.url)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:${C.red};font:700 15px/1 ${FONT};color:#ffffff;text-decoration:none">${escape(block.button.label)}</a></p>`
  }
  return ''
}

function blockText(block) {
  if (block.h) return `\n${block.h.toUpperCase()}\n`
  if (block.p || block.small || block.note) return `${block.p ?? block.small ?? block.note}\n`
  if (block.list) return block.list.map((item) => `- ${item}`).join('\n') + '\n'
  if (block.details) {
    return block.details.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => `${label}: ${value}`).join('\n') + '\n'
  }
  if (block.button) return `${block.button.label}: ${block.button.url}\n`
  return ''
}

/** @returns {{ subject: string, html: string, text: string }} */
export function renderEmail({ subject, preheader = '', blocks }) {
  const footer = `${site.name} · ${location.name}, ${location.address} · ${phone.display}`
  const html = `<!doctype html>
<html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.paper}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:20px 28px;background:${C.navy};font:800 18px/1.2 ${FONT};color:${C.cream}">Firearms Academy <span style="color:#669bbc">Canada</span></td></tr>
<tr><td style="padding:28px">${blocks.map(blockHtml).join('\n')}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid ${C.line};font:400 12px/1.5 ${FONT};color:${C.muted}">${escape(footer)}</td></tr>
</table></td></tr></table></body></html>`
  const text = `${blocks.map(blockText).join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n\n--\n${footer}\n`
  return { subject, html, text }
}
