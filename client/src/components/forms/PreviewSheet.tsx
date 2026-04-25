import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function PreviewSheet({
  open,
  onOpenChange,
  blobUrl,
  title,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  blobUrl: string | null;
  title: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0">
        <SheetHeader className="p-3 border-b border-border">
          <SheetTitle className="font-[var(--font-display)] text-sm">
            {title}
          </SheetTitle>
        </SheetHeader>
        {blobUrl && (
          <iframe
            src={blobUrl}
            title={title}
            className="w-full h-[calc(85vh-3rem)] border-0"
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
