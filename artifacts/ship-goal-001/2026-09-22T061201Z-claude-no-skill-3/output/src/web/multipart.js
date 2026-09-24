// Just enough multipart/form-data to accept one photo per form. Written out
// rather than pulled in because the whole app has no runtime dependencies, and
// a file upload parser is a small, testable amount of code.
//
// Limits enforced here: one part per field name, size capped by the caller
// before we ever get the buffer, and file parts are only kept if their bytes
// actually start like a JPEG, PNG or WebP. A browser's Content-Type header is
// a claim, not evidence.

const SIGNATURES = [
  { extension: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { extension: 'png', mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  {
    extension: 'webp',
    mime: 'image/webp',
    test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

export function sniffImage(buffer) {
  if (!buffer || buffer.length < 12) return null;
  return SIGNATURES.find((signature) => signature.test(buffer)) ?? null;
}

export function boundaryOf(contentType = '') {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!match) return null;
  return (match[1] ?? match[2]).trim();
}

/**
 * @returns {{fields: Record<string,string>, files: Record<string,{filename:string, contentType:string, data:Buffer}>}}
 */
export function parseMultipart(buffer, contentType) {
  const boundary = boundaryOf(contentType);
  if (!boundary) throw new Error('multipart body has no boundary');

  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = {};

  let cursor = buffer.indexOf(delimiter);
  if (cursor < 0) throw new Error('multipart body has no opening boundary');
  cursor += delimiter.length;

  while (cursor < buffer.length) {
    if (buffer.subarray(cursor, cursor + 2).toString('latin1') === '--') break; // closing boundary
    if (buffer.subarray(cursor, cursor + 2).toString('latin1') === '\r\n') cursor += 2;

    const headerEnd = buffer.indexOf('\r\n\r\n', cursor, 'latin1');
    if (headerEnd < 0) break;
    const headers = parseHeaders(buffer.subarray(cursor, headerEnd).toString('utf8'));
    const bodyStart = headerEnd + 4;

    let bodyEnd = buffer.indexOf(delimiter, bodyStart);
    if (bodyEnd < 0) bodyEnd = buffer.length;
    const content = buffer.subarray(bodyStart, Math.max(bodyStart, bodyEnd - 2)); // drop trailing CRLF

    const disposition = headers['content-disposition'] ?? '';
    const name = valueOf(disposition, 'name');
    const filename = valueOf(disposition, 'filename');
    if (name) {
      if (filename != null) {
        if (content.length > 0) {
          files[name] = {
            filename,
            contentType: headers['content-type'] ?? 'application/octet-stream',
            data: content,
          };
        }
      } else if (!(name in fields)) {
        fields[name] = content.toString('utf8');
      }
    }
    cursor = bodyEnd + delimiter.length;
  }
  return { fields, files };
}

function parseHeaders(text) {
  const headers = {};
  for (const line of text.split('\r\n')) {
    const index = line.indexOf(':');
    if (index > 0) headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return headers;
}

function valueOf(header, key) {
  const match = new RegExp(`${key}="([^"]*)"`, 'i').exec(header);
  return match ? match[1] : null;
}
