import { addDocument, serverTimestamp } from "../js/services/firestoreService.js";
import { assertValid } from "./dataService.js";

const validateContact = (input) => input.name && input.message ? [] : ["お名前とお問い合わせ内容を入力してください。"];
export function submitContact(input) {
  assertValid(input, validateContact, "contacts");
  // 公開createのSecurity Rules契約に合わせ、updatedAtは付与しない。
  return addDocument("contacts", { ...input, status:"新規", createdAt:serverTimestamp() });
}
