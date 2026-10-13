"use client";

import { LazyMotion } from "framer-motion";

const loadFeatures = () => import("@/lib/motionFeatures").then((mod) => mod.default);

/** Landing components use the lightweight `m` instead of `motion`, which only
 * animates inside LazyMotion — the engine (~100 KiB) is fetched after
 * hydration instead of blocking the hero h1 (the mobile LCP element). Lives
 * in the root layout because Navbar/Footer are also used on blog and legal
 * pages: an `m` element outside LazyMotion never runs its animation, so
 * anything starting at opacity:0 would stay invisible. */
export function MotionFeatures({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
