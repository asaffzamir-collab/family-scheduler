import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";

/**
 * GET /api/debug/check — comprehensive system health check
 * 
 * This endpoint checks:
 * - Environment variables
 * - Supabase connection
 * - Database schema
 * 
 * IMPORTANT: Remove or protect this endpoint in production!
 */
export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    environment: {} as Record<string, string>,
    supabase: {} as Record<string, unknown>,
    database: {} as Record<string, unknown>,
  };

  // 1. Check environment variables
  const requiredEnvVars = [
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  for (const envVar of requiredEnvVars) {
    checks.environment[envVar] = process.env[envVar] ? "✅ set" : "❌ NOT SET";
  }

  // Add Vercel-specific env vars
  checks.environment.VERCEL = process.env.VERCEL ?? "not set";
  checks.environment.VERCEL_URL = process.env.VERCEL_URL ?? "not set";
  checks.environment.AUTH_TRUST_HOST = process.env.AUTH_TRUST_HOST ?? "not set";
  // Show Supabase URL (public value, not sensitive) for debugging
  checks.environment.SUPABASE_URL_VALUE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "not set";
  checks.environment.NEXTAUTH_URL_VALUE = process.env.NEXTAUTH_URL ?? "not set";

  // 2. Check Supabase connection
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id")
      .limit(1);

    if (error) {
      checks.supabase.connection = `❌ Failed: ${error.message}`;
      checks.supabase.errorCode = error.code;
      checks.supabase.errorDetails = error.details;
    } else {
      checks.supabase.connection = "✅ Connected";
      checks.supabase.userCount = data?.length || 0;
    }
  } catch (err) {
    checks.supabase.connection = `❌ Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 3. Check database tables
  const tables = ["users", "families", "family_members", "reminder_rules", "events"];
  const tableStatus: Record<string, string> = {};

  for (const table of tables) {
    try {
      const { error } = await supabaseAdmin.from(table).select("id").limit(1);
      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows (table exists but empty)
        tableStatus[table] = `❌ Error: ${error.message}`;
      } else {
        tableStatus[table] = "✅ Accessible";
      }
    } catch (err) {
      tableStatus[table] = `❌ Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  checks.database.tables = tableStatus;

  // 4. Overall health status
  const allEnvVarsSet = Object.values(checks.environment)
    .filter((v) => v !== "not set")
    .every((v) => v.includes("✅"));
  const supabaseOk = typeof checks.supabase.connection === "string" && 
    checks.supabase.connection.includes("✅");
  const allTablesOk = Object.values(tableStatus).every((v) => v.includes("✅"));

  const overallStatus = allEnvVarsSet && supabaseOk && allTablesOk ? "✅ HEALTHY" : "❌ ISSUES DETECTED";

  return NextResponse.json({
    status: overallStatus,
    ...checks,
    recommendations: getRecommendations(checks),
  });
}

function getRecommendations(checks: {
  environment: Record<string, string>;
  supabase: Record<string, unknown>;
  database: Record<string, unknown>;
}): string[] {
  const recommendations: string[] = [];

  // Check environment variables
  const missingEnvVars = Object.entries(checks.environment)
    .filter(([key, value]) => value.includes("❌") && key !== "VERCEL" && key !== "VERCEL_URL" && key !== "AUTH_TRUST_HOST")
    .map(([key]) => key);

  if (missingEnvVars.length > 0) {
    recommendations.push(
      `Set missing environment variables in Vercel: ${missingEnvVars.join(", ")}`
    );
  }

  // Check NEXTAUTH_URL
  if (checks.environment.NEXTAUTH_URL?.includes("✅")) {
    const vercelUrl = process.env.VERCEL_URL;
    const nextauthUrl = process.env.NEXTAUTH_URL;
    if (vercelUrl && nextauthUrl && !nextauthUrl.includes(vercelUrl)) {
      recommendations.push(
        `NEXTAUTH_URL (${nextauthUrl}) doesn't match VERCEL_URL (${vercelUrl}). This may cause issues.`
      );
    }
  }

  // Check Supabase connection
  if (typeof checks.supabase.connection === "string" && checks.supabase.connection.includes("❌")) {
    recommendations.push(
      "Supabase connection failed. Verify NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct."
    );
  }

  // Check database tables
  const failedTables = Object.entries(checks.database.tables as Record<string, string>)
    .filter(([, value]) => value.includes("❌"))
    .map(([key]) => key);

  if (failedTables.length > 0) {
    recommendations.push(
      `Database tables not accessible: ${failedTables.join(", ")}. Check Supabase RLS policies and table existence.`
    );
  }

  // Check Google OAuth
  if (
    checks.environment.GOOGLE_CLIENT_ID?.includes("❌") ||
    checks.environment.GOOGLE_CLIENT_SECRET?.includes("❌")
  ) {
    recommendations.push(
      "Google OAuth credentials missing. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("All checks passed! System is healthy.");
  }

  return recommendations;
}
