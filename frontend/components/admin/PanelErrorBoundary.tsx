"use client";

import { Component, type ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Isolates one Analytics panel from the rest of the page: if a panel's data
 * shape doesn't match what it expects (e.g. the frontend rolled out on
 * Vercel before a backend field landed on Render — those deploy on separate
 * schedules), only this panel shows a fallback instead of taking down the
 * whole /admin/dashboard route with an uncaught render error. Class
 * component because React has no hook-based error boundary API. */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.title}] panel crashed:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-[#1E2130] bg-[#12141C] p-5">
          <h3 className="mb-1 text-sm font-medium text-white">{this.props.title}</h3>
          <p className="text-xs text-[#81889B]">
            Не удалось отобразить этот блок. Остальная аналитика не затронута — попробуй обновить страницу.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
