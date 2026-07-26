"use client";

import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface Props {
  onSuccess: (idToken: string) => void;
  onError?: () => void;
}

export function GoogleAuthButton({ onSuccess, onError }: Props) {
  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale="ru">
      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-[#1E1E2E]" />
        <span className="text-[#8B8BA7] text-xs">или</span>
        <div className="h-px flex-1 bg-[#1E1E2E]" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            if (credentialResponse.credential) onSuccess(credentialResponse.credential);
          }}
          onError={onError}
          theme="outline"
          shape="pill"
          size="large"
          text="continue_with"
        />
      </div>
    </GoogleOAuthProvider>
  );
}
