import { escapeHtml } from "../js/utils/dom.js";

export function kpiCard(label, value, caption) { return `<article class="analytics-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(caption)}</small></article>`; }
export function rankingRows(rows, value, caption = "") { if (!rows.length) return '<li class="analytics-empty">該当データはありません。</li>'; return rows.map((row, index) => `<li><b>${index + 1}</b><div><strong>${escapeHtml(row.name || "名称未設定")}</strong><small>${escapeHtml(typeof caption === "function" ? caption(row) : caption)}</small></div><em>${escapeHtml(value(row))}</em></li>`).join(""); }
export function table(headers, rows) { if (!rows.length) return '<p class="analytics-empty">該当データはありません。</p>'; return `<table class="analytics-table"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`; }
export function yen(value) { return new Intl.NumberFormat("ja-JP", { style:"currency", currency:"JPY", maximumFractionDigits:0 }).format(Number(value) || 0); }
export function number(value) { return new Intl.NumberFormat("ja-JP").format(Number(value) || 0); }
export function setMessage(id, text, type = "") { const element = document.getElementById(id); if (!element) return; element.textContent = text; element.dataset.type = type; }
export function formatDate(value) { const text = String(value || "").slice(0, 10); const parts = text.split("-"); return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : text || "未設定"; }
export function escape(value) { return escapeHtml(String(value ?? "")); }
