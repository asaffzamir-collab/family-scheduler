"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Calendar, Shield, Bell, MessageSquare } from "lucide-react";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const error = searchParams.get("error");

  // Map NextAuth error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The sign in link is no longer valid.",
    OAuthSignin: "Error starting the sign-in process. Please try again.",
    OAuthCallback: "Error during sign-in. Please try again.",
    OAuthCreateAccount: "Could not create your account. Please contact support.",
    EmailCreateAccount: "Could not create your account. Please contact support.",
    Callback: "Error during sign-in. Please try again.",
    OAuthAccountNotLinked: "This email is already associated with another account.",
    EmailSignin: "The sign-in email could not be sent.",
    CredentialsSignin: "Sign in failed. Check your credentials.",
    SessionRequired: "Please sign in to access this page.",
    Default: "An error occurred during sign-in. Please try again.",
  };

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-4">
            <Calendar className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Family Scheduler
          </h1>
          <p className="text-gray-500 mt-2">
            Stay on top of your family&apos;s schedule
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-800">{errorMessage}</p>
          </div>
        )}

        {/* Features */}
        <div className="card mb-6">
          <div className="space-y-4">
            <Feature
              icon={<Calendar className="w-5 h-5 text-blue-600" />}
              title="Google Calendar Sync"
              desc="Read and write to your calendars"
            />
            <Feature
              icon={<Bell className="w-5 h-5 text-amber-500" />}
              title="Smart Reminders"
              desc="Tests, classes, and appointments — never miss one"
            />
            <Feature
              icon={<MessageSquare className="w-5 h-5 text-green-600" />}
              title="Quick Capture"
              desc="Send a Telegram/WhatsApp message to add events"
            />
            <Feature
              icon={<Shield className="w-5 h-5 text-purple-600" />}
              title="Conflict Alerts"
              desc="Get warned when schedules overlap"
            />
          </div>
        </div>

        {/* Sign-in button */}
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="btn btn-primary w-full text-base py-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          We only access your calendar. No data is shared with anyone.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="font-medium text-sm text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">{desc}</div>
      </div>
    </div>
  );
}
