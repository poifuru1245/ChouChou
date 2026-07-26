import { increment, serverTimestamp, setDocument, subscribeCollection, updateDocument } from "../js/services/firestoreService.js";

// 公開ランキング専用の軽量Service。管理分析用Serviceを公開ページへ連鎖読込させない。
export function subscribeCastViews(onData, onError) { return subscribeCollection("castViews", onData, onError); }

export async function recordCastView(cast = {}, weekKey = "") {
  const castId = String(cast.id || "");
  if (!castId || !weekKey) return;
  await Promise.all([
    updateDocument("casts", castId, { viewCount:increment(1), lastViewedAt:serverTimestamp() }),
    setDocument("castViews", `${castId}_${weekKey}`, { castId, castName:cast.name || "", weekKey, count:increment(1), updatedAt:serverTimestamp() }, { merge:true })
  ]);
}
