// Server actions for Supabase authentication
'use server';

import { createClient } from './server';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';

/**
 * Helper function to create redirects with encoded parameters
 */
export async function encodedRedirect(
  type: "success" | "error",
  path: string,
  message: string
) {
  return redirect(`${path}?type=${type}&message=${encodeURIComponent(message)}`);
}

/**
 * Reset password action
 */
export async function forgotPasswordAction(formData: FormData) {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = await headers().then((h) => h.get("origin")) || "http://localhost:3000";
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password",
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password.",
  );
}

/**
 * Sign in action
 */
export async function signInAction(formData: FormData) {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const supabase = await createClient();

  if (!email || !password) {
    return encodedRedirect("error", "/sign-in", "Email and password are required");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/protected");
}

/**
 * Sign up action
 */
export async function signUpAction(formData: FormData) {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("fullName")?.toString() || "";

  const supabase = await createClient();
  const origin = await headers().then((h) => h.get("origin")) || "http://localhost:3000";

  if (!email || !password) {
    return encodedRedirect("error", "/sign-up", "Email and password are required");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return encodedRedirect("error", "/sign-up", error.message);
  }

  return encodedRedirect(
    "success",
    "/sign-in",
    "Check your email for a confirmation link."
  );
}

/**
 * Sign out action
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/");
}
