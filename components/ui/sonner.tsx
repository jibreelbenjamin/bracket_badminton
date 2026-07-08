"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "rounded-xl border border-court-100 bg-white shadow-lg shadow-court-900/5 font-sans text-sm",
          title: "text-ink-900 font-medium",
          description: "text-ink-500",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
