"use client";

import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

interface Props {
  onSuccess: (idToken: string) => void;
  onError?: () => void;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function GoogleAuthContent({ onSuccess, onError }: Props) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale="ru">
      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-border" />
        <span className="text-secondary text-xs">или</span>
        <div className="h-px flex-1 bg-border" />
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