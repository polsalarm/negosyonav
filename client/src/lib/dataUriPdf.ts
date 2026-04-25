export function base64PdfToBlobUrl(base64: string): { url: string; revoke: () => void } {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

export function triggerPdfDownload(base64: string, filename: string): void {
  const { url, revoke } = base64PdfToBlobUrl(base64);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  revoke();
}
