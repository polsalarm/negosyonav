import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function UploadTemplateButton({
  formId,
  formLabel,
  onUploaded,
}: {
  formId: string;
  formLabel: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = trpc.forms.uploadTemplate.useMutation();

  async function handleFile(file: File) {
    if (!file.type.includes("pdf")) {
      toast.error("Please pick a PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10 MB.");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const view = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < view.length; i += chunk) {
        const slice = view.subarray(i, i + chunk);
        for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j]);
      }
      const b64 = btoa(bin);
      await upload.mutateAsync({
        formId,
        label: formLabel,
        pdfBase64: b64,
      });
      toast.success("Uploaded! Detecting fields...");
      onUploaded();
    } catch (err) {
      toast.error((err as Error).message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        variant="outline"
        size="sm"
        className="rounded-xl border-teal/30 text-teal text-xs h-11 min-h-11"
      >
        {busy ? (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ) : (
          <Upload className="w-3 h-3 mr-1" />
        )}
        Mag-upload ng template
      </Button>
    </>
  );
}
