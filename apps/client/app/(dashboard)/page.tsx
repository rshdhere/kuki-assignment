import { Icon } from "@/components/icon";
import { DocumentsView } from "@/components/documents-view";
import { Topbar } from "@/components/topbar";
import { UploadButton } from "@/components/upload-button";
import { UploadProvider } from "@/components/upload-provider";

export default function DocumentsPage() {
  return (
    <UploadProvider>
      <Topbar
        crumbs={[{ label: "Documents" }]}
        actions={
          <>
            <UploadButton />
            <a href="/docs" className="btn btn-outline">
              <Icon name="doc" />
              Docs
            </a>
          </>
        }
      />
      <DocumentsView />
    </UploadProvider>
  );
}
