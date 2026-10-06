import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Settings as AppSettings } from "@/lib/app-settings";
import { IMAMS } from "@/lib/nur-data";
import { PRAYER_KEYS, type PrayerTimings, toDateToday } from "@/lib/prayer-times";
import { resolveEffectiveReminder, ttsUrl } from "@/lib/reminder-data";

export interface NativePlatformStatus {
  isNativeAndroid: boolean;
  alarmManagerAvailable: boolean;
  sdkVersion: number;
  canScheduleExactAlarms: boolean;
  isIgnoringBatteryOptimizations: boolean;
}

export interface ScheduledAlarmInfo {
  eventId: string;
  type: "REMINDER_BEFORE_PRAYER" | "PRAYER_AZAN" | "reminder" | "adhan";
  prayerName: string;
  timestampMs: number;
  mode: string;
  title: string;
  notifText: string;
  message?: string;
  audioText: string;
  audioUrl: string;
  isArabic: boolean;
  vibrate: boolean;
}

export interface PrayerSchedulerPluginInterface {
  getNativePlatformStatus(): Promise<NativePlatformStatus>;
  requestNativePermissions(): Promise<{ canScheduleExactAlarms: boolean; canPostNotifications: boolean }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>; 
  scheduleReminder(options: {
    eventId: string;
    prayerName: string;
    timestamp: number;
    mode: "notification" | "audio" | "both";
    title: string;
    notifText: string;
    message?: string;
    audioText: string;
    audioUrl?: string;
    isArabic?: boolean;
    vibrate?: boolean;
  }): Promise<{ success: boolean; eventId: string; deprecated?: boolean }>; 
  scheduleAdhan(options: {
    eventId: string;
    prayerName: string;
    timestamp: number;
    imamId: string;
    title: string;
    message: string;
    audioUrl: string;
    vibrate?: boolean;
  }): Promise<{ success: boolean; eventId: string; deprecated?: boolean }>;
  syncSchedule(options: {
    times: string;
    notifications?: boolean;
    reminder?: number;
    reminderMode?: string;
    imamId?: string;
    origin?: string;
    settings?: string;
  }): Promise<{ success: boolean; scheduledCount: number; cancelled?: boolean; isNativeAndroid: boolean }>;
  scheduleTestAlarm(options: {
    delaySeconds: number;
    type: "reminder" | "adhan" | "REMINDER_BEFORE_PRAYER" | "PRAYER_AZAN";
    prayerName: string;
    mode: "notification" | "audio" | "both";
    title: string;
    notifText?: string;
    message?: string;
    audioText?: string;
    audioUrl?: string;
    isArabic?: boolean;
    vibrate?: boolean;
  }): Promise<{ success: boolean; eventId: string; timestampMs: number; delaySeconds: number }>;
  getPendingAlarms(): Promise<{ alarmsJson: string }>;
  cancelAll(): Promise<{ cancelled: boolean; count: number }>;
}

export const NativePrayerScheduler = registerPlugin<PrayerSchedulerPluginInterface>("PrayerScheduler");

export function isNativeAndroidPlatform(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function getNativeStatus(): Promise<NativePlatformStatus> {
  if (!isNativeAndroidPlatform()) {
    return {
      isNativeAndroid: false,
      alarmManagerAvailable: false,
      sdkVersion: 0,
      canScheduleExactAlarms: true,
      isIgnoringBatteryOptimizations: true,
    };
  }

  try {
    return await NativePrayerScheduler.getNativePlatformStatus();
  } catch {
    return {
      isNativeAndroid: true,
      alarmManagerAvailable: true,
      sdkVersion: 33,
      canScheduleExactAlarms: true,
      isIgnoringBatteryOptimizations: true,
    };
  }
}

export async function requestNativeExactAlarmPermissions(): Promise<boolean> {
  if (!isNativeAndroidPlatform()) return true;
  try {
    const res = await NativePrayerScheduler.requestNativePermissions();
    return Boolean(res.canScheduleExactAlarms);
  } catch {
    return true;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNativeAndroidPlatform()) return true;
  try {
    const res = await NativePrayerScheduler.requestNotificationPermission();
    return Boolean(res.granted);
  } catch {
    return true;
  }
}

export async function requestNativeBatteryExemption(): Promise<boolean> {
  if (!isNativeAndroidPlatform()) return true;
  try {
    const res = await NativePrayerScheduler.requestBatteryOptimizationExemption();
    return Boolean(res.requested);
  } catch {
    return false;
  }
}

export async function syncSchedule(
  timings: PrayerTimings,
  settings: AppSettings,
  t: (key: string) => string,
): Promise<{ nativeScheduledCount: number; isNative: boolean }> {
  const isNative = isNativeAndroidPlatform();

  if (!settings.notifications) {
    if (isNative) {
      try {
        await NativePrayerScheduler.cancelAll();
      } catch {
        // ignore
      }
    }
    return { nativeScheduledCount: 0, isNative };
  }

  if (!isNative) {
    return { nativeScheduledCount: 0, isNative: false };
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const settingsPayload = JSON.stringify({
    notifTemplate: settings.notifTemplate,
    customNotifText: settings.customNotifText,
    audioReminder: settings.audioReminder,
    customAudioText: settings.customAudioText,
    vibrateNotifications: settings.vibrateNotifications,
    vibrateAdhan: settings.vibrateAdhan,
  });

  try {
    const result = await NativePrayerScheduler.syncSchedule({
      times: JSON.stringify(timings),
      notifications: settings.notifications,
      reminder: settings.reminder ?? 0,
      reminderMode: settings.reminderMode ?? "notification",
      imamId: settings.imamId ?? "makkah",
      origin,
      settings: settingsPayload,
    });

    return {
      nativeScheduledCount: result?.scheduledCount ?? 0,
      isNative: true,
    };
  } catch (err) {
    console.warn("[NativePrayerBridge] syncSchedule failed:", err);
    return { nativeScheduledCount: 0, isNative: true };
  }
}

export const syncNativePrayerAlarms = syncSchedule;

export async function scheduleNativeTestDelay(options: {
  delaySeconds: number;
  type: "reminder" | "adhan" | "REMINDER_BEFORE_PRAYER" | "PRAYER_AZAN";
  prayerName: string;
  mode: "notification" | "audio" | "both";
  title: string;
  notifText?: string;
  message?: string;
  audioText?: string;
  audioUrl?: string;
  isArabic?: boolean;
  vibrate?: boolean;
}): Promise<{ success: boolean; eventId: string; timestampMs: number }> {
  if (isNativeAndroidPlatform()) {
    try {
      const res = await NativePrayerScheduler.scheduleTestAlarm(options);
      return { success: res.success, eventId: res.eventId, timestampMs: res.timestampMs };
    } catch (err) {
      console.warn("[NativePrayerBridge] Native test alarm error:", err);
    }
  }

  const targetMs = Date.now() + options.delaySeconds * 1000;
  return {
    success: true,
    eventId: `web_test_${Date.now()}`,
    timestampMs: targetMs,
  };
}

export async function getParsedScheduledAlarms(): Promise<ScheduledAlarmInfo[]> {
  if (!isNativeAndroidPlatform()) return [];
  try {
    const res = await NativePrayerScheduler.getPendingAlarms();
    if (!res?.alarmsJson) return [];
    const list = JSON.parse(res.alarmsJson);
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
  } catch (err) {
    console.warn("[NativePrayerBridge] Error fetching pending alarms:", err);
    return [];
  }
}

export async function cancelScheduledNativeAlarms(): Promise<boolean> {
  if (!isNativeAndroidPlatform()) return true;
  try {
    const res = await NativePrayerScheduler.cancelAll();
    return Boolean(res.cancelled);
  } catch {
    return false;
  }
}

export async function validateNativeScheduleState(): Promise<{ canScheduleExactAlarms: boolean; canPostNotifications: boolean }> {
  if (!isNativeAndroidPlatform()) {
    return { canScheduleExactAlarms: true, canPostNotifications: true };
  }

  try {
    const res = await NativePrayerScheduler.requestNativePermissions();
    return {
      canScheduleExactAlarms: Boolean(res.canScheduleExactAlarms),
      canPostNotifications: Boolean(res.canPostNotifications),
    };
  } catch {
    return { canScheduleExactAlarms: true, canPostNotifications: true };
  }
}

export function getPrayerScheduleSignature(timings: PrayerTimings, settings: AppSettings): string {
  return `${PRAYER_KEYS.map((key) => `${key}:${timings[key] ?? ""}`).join("|")}|${settings.imamId}|${settings.reminder}|${settings.reminderMode}|${settings.notifications}`;
}

export function getReminderLeadTime(settings: AppSettings): number {
  return settings.reminder ?? 0;
}

export function getSinglePrayerTime(timings: PrayerTimings, prayer: keyof PrayerTimings): string {
  return timings[prayer] ?? "00:00";
}

export function buildReminderTime(prayerTime: string, minutesBefore: number): number {
  const [hour, minute] = prayerTime.split(":").map(Number);
  const base = new Date();
  base.setHours(hour, minute, 0, 0);
  return base.getTime() - minutesBefore * 60_000;
}

export function createPrayerReminderWindow(
  timings: PrayerTimings,
  settings: AppSettings,
): Array<{ prayerName: string; prayerTime: Date; reminderTime: Date }> {
  return PRAYER_KEYS.map((key) => {
    const prayerTime = toDateToday(timings[key], new Date());
    const reminderTime = new Date(prayerTime.getTime() - (settings.reminder ?? 0) * 60_000);
    return { prayerName: key, prayerTime, reminderTime };
  }).filter((item) => !Number.isNaN(item.prayerTime.getTime()));
}

export function hasNativeSchedulingConflict(settings: AppSettings): boolean {
  return Boolean(settings.notifications && isNativeAndroidPlatform());
}
