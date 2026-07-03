"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";

interface Props {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onUpload: (file: File) => Promise<{ logo_url: string }>;
}

export function LogoUpload({ currentUrl, onUploaded, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File) => {
    setError("");
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setError("Только PNG/JPG файлы");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Файл слишком большой (макс. 2MB)");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);
    try {
      const res = await onUpload(file);
      onUploaded(res.logo_url);
    } catch {
      setError("Ошибка загрузки. Попробуйте снова.");
      setPreview(currentUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const clear = () => {
    setPreview(null);
    onUploaded("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      {preview ? (
        <div className="flex items-center gap-3">
          <img
            src={preview}
            alt="Logo preview"
            className="w-16 h-16 rounded-xl object-cover border border-gray-200"
          />
          <div>
            <p className="text-sm text-gray-700 font-medium mb-1">Логотип загружен</p>
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition"
            >
              <X size={12} />
              Удалить
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl px-6 py-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
        >
          <Upload size={24} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-700">
            {uploading ? "Загружаем..." : "Нажмите или перетащите файл"}
          </p>
          <p className="text-xs text-gray-400 mt-1">PNG/JPG, макс. 2MB · рекомендуем 200×200px</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}
