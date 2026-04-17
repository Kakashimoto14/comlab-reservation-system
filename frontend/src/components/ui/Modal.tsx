import { X } from "lucide-react";
import type { PropsWithChildren } from "react";

import { Button } from "./Button";

export const Modal = ({
  open,
  title,
  onClose,
  children
}: PropsWithChildren<{
  open: boolean;
  title: string;
  onClose: () => void;
}>) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-soft">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <Button variant="secondary" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
};
