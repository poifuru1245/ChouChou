import {
  findCastForAuthenticatedUser as findCast,
  markAnnouncementRead as markRead,
  submitShiftRequest as submitShift,
  subscribeCastPortalData as subscribePortal,
  updateOwnCastProfile as updateProfile,
  uploadOwnProfilePhoto as uploadPhoto
} from "../js/services/castPortalService.js";
import { normalizeServiceError } from "./errors.js";
import { runServiceOperation } from "./serviceRuntime.js";

// キャスト本人用データServiceの正規入口。基盤実装の戻り値を維持して共通状態と例外を適用する。
export function findCastForAuthenticatedUser(user) { return runServiceOperation("findOwnCast", () => findCast(user), { resource:"castPortal" }); }
export function subscribeCastPortalData(input, onData, onError = console.error) {
  return subscribePortal(input, onData, (error, source) => onError(normalizeServiceError(error, { resource:`castPortal/${source}`, operation:"listen" }), source));
}
export function submitShiftRequest(input) { return runServiceOperation("submitShift", () => submitShift(input), { resource:"shiftRequests" }); }
export function markAnnouncementRead(user, announcementId) { return runServiceOperation("markRead", () => markRead(user, announcementId), { resource:"announcementReads" }); }
export function updateOwnCastProfile(input) { return runServiceOperation("updateProfile", () => updateProfile(input), { resource:`casts/${input.castId}` }); }
export function uploadOwnProfilePhoto(input) { return runServiceOperation("uploadProfilePhoto", () => uploadPhoto(input), { resource:`cast-profiles/${input.user?.uid || ""}` }); }
