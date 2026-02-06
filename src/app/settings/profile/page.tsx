"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ProfileSettings = {
  location: string;
  gardenEnvironment: string;
  hardinessZone: string;
  experienceLevel: string;
  notes: string;
};

const emptyProfile: ProfileSettings = {
  location: "",
  gardenEnvironment: "",
  hardinessZone: "",
  experienceLevel: "",
  notes: "",
};

const experienceOptions = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
];

export default function ProfileSettingsPage() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileSettings>(emptyProfile);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");

  const loadProfile = async () => {
    setIsProfileLoading(true);
    setProfileStatus("");
    try {
      const response = await fetch("/api/profile");
      if (!response.ok) {
        if (response.status === 401) {
          return;
        }
        throw new Error("Failed to load profile");
      }
      const data = (await response.json()) as {
        profile?: Partial<ProfileSettings>;
      };
      setProfile({ ...emptyProfile, ...(data.profile ?? {}) });
    } catch {
      setProfile(emptyProfile);
      setProfileStatus("Could not load profile settings.");
    } finally {
      setIsProfileLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthed) {
      void loadProfile();
      return;
    }
    if (status === "unauthenticated") {
      setProfile(emptyProfile);
      setProfileStatus("");
      router.replace("/");
    }
  }, [isAuthed, status, router]);

  const updateProfileField = (
    field: keyof ProfileSettings,
    value: string,
  ) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileSave = async () => {
    if (isProfileSaving || !isAuthed) return;
    setIsProfileSaving(true);
    setProfileStatus("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!response.ok) {
        throw new Error("Failed to save profile");
      }
      const data = (await response.json()) as {
        profile?: Partial<ProfileSettings>;
      };
      setProfile({ ...emptyProfile, ...(data.profile ?? {}) });
      setProfileStatus("Saved.");
    } catch {
      setProfileStatus("Save failed. Try again.");
    } finally {
      setIsProfileSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="shell">
        <header className="hero">
          <div className="heroTop">
            <span className="eyebrow">Settings / Profile</span>
            {isAuthed && (
              <Link className="authGhostButton" href="/settings">
                Back to settings
              </Link>
            )}
          </div>
          <h1>Profile settings.</h1>
          <p>
            Share your location and environment so Garden AI can tune guidance
            to your climate.
          </p>
        </header>

        {status === "loading" && (
          <section className="settingsPanel">
            <div className="profileBody">
              <div className="profileFooter">Checking session...</div>
            </div>
          </section>
        )}

        {status === "unauthenticated" && (
          <section className="authGate">
            <h2>Log in to update your profile.</h2>
            <p>
              Sign in to save your location and environment preferences.
            </p>
            <div className="authGateActions">
              <Link className="authButton" href="/login">
                Log in
              </Link>
              <Link className="authGhostButton" href="/signup">
                Sign up
              </Link>
            </div>
          </section>
        )}

        {isAuthed && (
          <section className="settingsPanel" aria-live="polite">
            <div className="profileHeader">
              <h3>Profile settings</h3>
              <div className="profileActions">
                <button
                  type="button"
                  className="profileSaveButton"
                  onClick={handleProfileSave}
                  disabled={isProfileSaving || isProfileLoading}
                >
                  {isProfileSaving ? "Saving" : "Save"}
                </button>
              </div>
            </div>
            <div className="profileBody">
              <div className="profileFields">
                <label>
                  Location
                  <input
                    type="text"
                    value={profile.location}
                    onChange={(event) =>
                      updateProfileField("location", event.target.value)
                    }
                    placeholder="City, region, or zone"
                    disabled={isProfileLoading}
                  />
                </label>
                <label>
                  Environment
                  <select
                    value={profile.gardenEnvironment}
                    onChange={(event) =>
                      updateProfileField(
                        "gardenEnvironment",
                        event.target.value,
                      )
                    }
                    disabled={isProfileLoading}
                  >
                    <option value="">Select</option>
                    <option value="Outdoor">Outdoor</option>
                    <option value="Indoor">Indoor</option>
                    <option value="Both">Both</option>
                  </select>
                </label>
                <label>
                  Experience level
                  <select
                    value={profile.experienceLevel}
                    onChange={(event) =>
                      updateProfileField(
                        "experienceLevel",
                        event.target.value,
                      )
                    }
                    disabled={isProfileLoading}
                  >
                    <option value="">Select</option>
                    {experienceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="profileNotes">
                  Other notes
                  <textarea
                    value={profile.notes}
                    onChange={(event) =>
                      updateProfileField("notes", event.target.value)
                    }
                    placeholder="Compost, soil mix, goals..."
                    rows={3}
                    disabled={isProfileLoading}
                  />
                </label>
              </div>
              {isProfileLoading && (
                <div className="profileFooter">Loading profile...</div>
              )}
              {profileStatus && (
                <div className="profileFooter">{profileStatus}</div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
