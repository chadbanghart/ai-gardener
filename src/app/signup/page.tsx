"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Unable to create account.");
      setIsSubmitting(false);
      return;
    }

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("Account created, but login failed. Please log in.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="authPage">
      <div className="authCard">
        <div className="authHeader">
          <span className="eyebrow">Garden AI</span>
          <h1>Create your account</h1>
          <p>Start saving chats and personalize your garden profile.</p>
        </div>
        <form className="authForm" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@garden.ai"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <p className="authHint">Minimum 8 characters.</p>
          {error && <p className="authError">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Sign up"}
          </button>
        </form>
        <div className="authFooter">
          <span>Already have an account?</span>
          <Link href="/login">Log in</Link>
        </div>
        <div className="authFooter">
          <Link href="/">Back to homepage</Link>
        </div>
      </div>
    </div>
  );
}
