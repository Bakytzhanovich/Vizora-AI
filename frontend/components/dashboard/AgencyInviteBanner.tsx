"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";

import { apiGetAgencyInvites, apiRespondAgencyInvite } from "@/lib/api";
import type { AgencyInvite } from "@/lib/api";

/** An agency that added a student who already had an account sees nothing
 * until the student says yes here. Renders nothing when there are no invites. */
export function AgencyInviteBanner() {
  const { t } = useTranslation("dashboard");
  const [invites, setInvites] = useState<AgencyInvite[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiGetAgencyInvites().then(setInvites).catch(() => {});
  }, []);

  const respond = async (invite: AgencyInvite, accept: boolean) => {
    setBusyId(invite.id);
    setError(false);
    try {
      await apiRespondAgencyInvite(invite.id, accept);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
    } catch {
      setError(true);
    } finally {
      setBusyId(null);
    }
  };

  if (invites.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {invites.map((invite) => (
        <div key={invite.id} className="border border-accent/30 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Building2 size={18} className="text-accent-light shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-primary font-semibold text-sm mb-1">
                {t("agency_invite.title", { agency: invite.agency_name })}
              </p>
              <p className="text-secondary text-xs mb-3">{t("agency_invite.desc")}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => respond(invite, true)}
                  disabled={busyId !== null}
                  className="flex-1 bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {t("agency_invite.accept")}
                </button>
                <button
                  onClick={() => respond(invite, false)}
                  disabled={busyId !== null}
                  className="flex-1 bg-border hover:bg-border-hover text-secondary font-medium text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {t("agency_invite.decline")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {error && <p className="text-red-500 text-xs px-1">{t("agency_invite.error")}</p>}
    </div>
  );
}
