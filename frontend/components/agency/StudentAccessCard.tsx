"use client";

import { useState } from "react";
import { Copy, CheckCheck } from "lucide-react";

interface Props {
  name: string;
  email: string;
  link: string;
  // Null when the student already had an account and signs in with their own.
  password: string | null;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
        <span className="flex-1 text-sm text-gray-800 truncate font-mono">{value}</span>
        <button
          onClick={copy}
          aria-label={`Скопировать: ${label}`}
          className="shrink-0 text-blue-600 hover:text-blue-700 transition-colors"
        >
          {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  );
}

// What the agency sends the student to sign in: link, email and — for an
// account the platform just created — the generated password, shown once.
export function StudentAccessCard({ name, email, link, password }: Props) {
  const [copied, setCopied] = useState(false);
  const message = [
    `Здравствуйте, ${name}! Вас подключили к Vizora — там можно проверить уровень английского и потренироваться к визовому интервью.`,
    "",
    `Вход: ${link}`,
    `Email: ${email}`,
    password ? `Пароль: ${password}` : "Пароль: тот, с которым вы уже входили в Vizora",
  ].join("\n");

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <CopyRow label="Ссылка для входа" value={link} />
      <CopyRow label="Email" value={email} />
      {password ? (
        <>
          <CopyRow label="Пароль" value={password} />
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Пароль показывается только сейчас. Если потеряется, выдайте новый в карточке студента.
          </p>
        </>
      ) : (
        <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
          У студента уже есть аккаунт: он входит со своим паролем.
        </p>
      )}
      <button
        onClick={copyMessage}
        className="w-full py-2.5 rounded-xl border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition flex items-center justify-center gap-2"
      >
        {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
        {copied ? "Скопировано" : "Скопировать сообщение для студента"}
      </button>
    </div>
  );
}
