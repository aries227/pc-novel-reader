export function toReaderFileUrl(filePath: string): string {
  return `reader-file:///${encodeURI(filePath).replace(/%2F/gi, '/').replace(/%5C/gi, '/')}`
}
