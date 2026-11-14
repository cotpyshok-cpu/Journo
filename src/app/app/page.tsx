import React, { Suspense } from "react";
import { JournoApp } from "@/components/app/JournoApp";

export const dynamic = "force-dynamic";

export default function AppWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F6F4EF] text-sm font-semibold text-[#2F453B]">
          Loading Journo Workspace...
        </div>
      }
    >
      <JournoApp />
    </Suspense>
  );
}
