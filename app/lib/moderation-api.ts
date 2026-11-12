import { supabase } from './supabase';

export const REPORT_REASONS = ["Falsk profil", "Olämpliga bilder", "Trakasserier / hot", "Spam", "Annat"];

export async function blockUser(blockedId: string): Promise<{ success: boolean; refunded?: boolean; error_code?: string }> {
  const { data, error } = await supabase.rpc('block_user', { p_blocked_id: blockedId });
  if (error) return { success: false, error_code: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { success: row?.success ?? false, refunded: row?.refunded ?? false, error_code: row?.error_code };
}

export async function reportUser(reportedId: string, reason: string): Promise<{ success: boolean; error_code?: string }> {
  const { data, error } = await supabase.rpc('report_user', { p_reported_id: reportedId, p_reason: reason });
  if (error) return { success: false, error_code: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { success: row?.success ?? false, error_code: row?.error_code };
}
