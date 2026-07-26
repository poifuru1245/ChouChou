import { commitDocumentBatch, serverTimestamp } from "../js/services/firestoreService.js";
import { createDataService } from "./dataService.js";

const schedules = createDataService({ collectionName:"schedules", defaultSort:{ field:"date", direction:"asc" } });
export function listSchedules(options = {}) { return schedules.list(options); }
export function subscribeSchedules(onData, onError, options = {}) { return schedules.listen(onData, onError, options); }
export function createSchedule(input) { return schedules.create(input); }
export function updateSchedule(id, input) { return schedules.update(id, input); }
export function deleteSchedule(id) { return schedules.remove(id); }
export function saveScheduleOperations(operations = []) {
  return commitDocumentBatch(operations.map((operation) => ({
    ...operation,
    data:operation.type === "delete" ? undefined : { ...operation.data, updatedAt:serverTimestamp() }
  })));
}
