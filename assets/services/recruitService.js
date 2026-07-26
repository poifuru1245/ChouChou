import { addDocument, serverTimestamp } from "../js/services/firestoreService.js";
import { assertValid } from "./dataService.js";
import { getSiteSettings } from "./siteService.js";

const validateApplication = (input) => input.name && input.phone ? [] : ["お名前と電話番号を入力してください。"];
export function submitRecruitApplication(input) {
  assertValid(input, validateApplication, "recruitApplications");
  // 公開createのSecurity Rules契約に合わせ、updatedAtは付与しない。
  return addDocument("recruitApplications", { ...input, status:"新規", createdAt:serverTimestamp() });
}
export { getSiteSettings };
