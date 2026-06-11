const HISTORY_KEY = 'prediction_history_v1';
const MAX_ITEMS = 50;

export function getPredictionHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addPredictionHistory(entry) {
  const current = getPredictionHistory();
  const next = [{ ...entry }, ...current].slice(0, MAX_ITEMS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearPredictionHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function removePredictionHistoryItem(id) {
  const current = getPredictionHistory();
  const next = current.filter((item) => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}
