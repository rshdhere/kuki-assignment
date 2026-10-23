import { DocumentsView } from "@/components/documents-view";
import { UploadProvider } from "@/components/upload-provider";

export default function DocumentsPage() {
  return (
    <UploadProvider>
      <DocumentsView />
    </UploadProvider>
  );
}
