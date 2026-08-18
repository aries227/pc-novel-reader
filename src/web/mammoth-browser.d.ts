declare module 'mammoth/mammoth.browser' {
  const mammoth: {
    convertToHtml(opts: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>
  }
  export default mammoth
}
