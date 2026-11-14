"use client";

import dynamic from "next/dynamic";

export const DynamicJournoMap = dynamic(
  () => import("./JournoMap").then((mod) => mod.JournoMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] lg:h-[540px] w-full items-center justify-center rounded-2xl border border-[#DFDBD0] bg-[#ECE9E1] text-sm font-medium text-[#5E766B]">
        Loading interactive Astana route map...
      </div>
    ),
  }
);
