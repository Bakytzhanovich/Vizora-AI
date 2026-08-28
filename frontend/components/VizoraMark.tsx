import Image from "next/image";

interface VizoraMarkProps {
  className?: string;
  priority?: boolean;
}

export function VizoraMark({
  className = "h-7 w-7",
  priority = false,
}: VizoraMarkProps) {
  return (
    <Image
      src="/brand/vizora-mark.png"
      alt=""
      width={36}
      height={36}
      priority={priority}
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
