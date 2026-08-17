"use client";

interface Props {
  status: "completed" | "in_progress" | "pending";
}

export function RoadmapLine({ status }: Props) {
  return (
    <div className="flex justify-center w-10 shrink-0">
      <div
        className={`w-0.5 h-4 ${
          status === "completed"
            ? "bg-teal"
            : "border-l-2 border-dashed border-border"
        }`}
      />
    </div>
  );
}
