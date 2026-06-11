import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

// Inject JWT token ke setiap request kalau ada
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect ke login kalau 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname.startsWith('/admin')) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

const normalizeAlgorithm = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (['knn','k-nearest neighbors','knearestneighbors','k-nearest neighbors (kustom)'].some(k => text.includes(k))) return 'knn';
  if (['decision tree','decision-tree','decisiontree','decision tree (kustom)'].some(k => text.includes(k)) || text === 'dt') return 'dt';
  if (['random forest','random-forest','randomforest','random forest (kustom)'].some(k => text.includes(k)) || text === 'rf') return 'rf';
  return text;
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const adminLogin  = async (username, password) => (await api.post('/auth/login', { username, password })).data;
export const adminGetMe  = async () => (await api.get('/auth/me')).data;

// ── Models ────────────────────────────────────────────────────────────────────

export const getModels   = async () => (await api.get('/models')).data;
export const saveModel   = async (d) => (await api.post('/models', d)).data;
export const deleteModel = async (id) => (await api.delete(`/models/${id}`)).data;

// ── Predict ───────────────────────────────────────────────────────────────────

export const predict = async (model, features) => (await api.post('/predict', { model, features })).data;

// ── Evaluate / Playground ─────────────────────────────────────────────────────

export const evaluateModel = async (algorithm, hyperparameters, test_size, random_state) => {
  const alg = normalizeAlgorithm(algorithm);
  return (await api.post('/train-evaluate', {
    algorithm: alg, model: alg, hyperparameters, hyperparams: hyperparameters, test_size, testSize: test_size, random_state, randomState: random_state,
  })).data;
};

export const trainAndSaveModel = async (algorithm, hyperparameters, modelName) =>
  (await api.post('/playground/train-save', { algorithm: normalizeAlgorithm(algorithm), hyperparameters, name: modelName })).data;

// ── Dataset ───────────────────────────────────────────────────────────────────

export const getDatasetPreview  = async (page = 1, limit = 20) => (await api.get('/dataset', { params: { page, limit } })).data;
export const getActiveDataset   = async () => (await api.get('/dataset/active')).data;
export const getDatasetColumns  = async () => (await api.get('/dataset/columns')).data;
export const getDatasetCurrency = async () => (await api.get('/dataset/currency')).data;
export const uploadDataset      = async (csvContent, filename, currency) =>
  (await api.post('/dataset/upload', { csv_content: csvContent, filename, currency: currency || null })).data;
export const resetDataset       = async () => (await api.delete('/dataset/reset')).data;

// ── Feedback ──────────────────────────────────────────────────────────────────

export const submitFeedback  = async (features, actualPrice, predictedPrice, modelId, currency) =>
  (await api.post('/feedback', { features, actual_price: actualPrice||null, predicted_price: predictedPrice||null, model_id: modelId, currency: currency||null })).data;
export const getFeedbackStats = async () => (await api.get('/feedback/stats')).data;
export const getAllFeedback   = async () => (await api.get('/feedback')).data;

// ── Retrain (user-facing — tidak dipakai lagi, tapi tetap ada untuk kompatibilitas) ──

export const triggerRetrain  = async (algorithm, hyperparameters, name, strictLabel = false) =>
  (await api.post('/retrain', { algorithm: normalizeAlgorithm(algorithm), hyperparameters, name, strict_label: Boolean(strictLabel) })).data;
export const getRetrainStatus = async () => (await api.get('/retrain/status')).data;

// ── Upload CSV ────────────────────────────────────────────────────────────────

export const uploadCsvPredict = async (csvContent, modelId) =>
  (await api.post('/upload/predict', { csv_content: csvContent, model: modelId })).data;

// ── Admin (semua butuh JWT — interceptor inject otomatis) ────────────────────

export const getAdminStats          = async () => (await api.get('/admin/stats')).data;
export const getAdminPredictions    = async (params = {}) => (await api.get('/admin/predictions', { params })).data;
export const getAdminSelectedPreds  = async () => (await api.get('/admin/predictions/selected')).data;
export const setAdminPredSelection  = async (ids, selected) =>
  (await api.post('/admin/predictions/select', { ids, selected })).data;
export const previewAdminRetrain    = async (algorithm) =>
  (await api.post('/admin/preview-retrain', { algorithm })).data;
export const triggerAdminRetrain    = async (algorithm, hyperparameters = {}) =>
  (await api.post('/admin/retrain', { algorithm: normalizeAlgorithm(algorithm), hyperparameters })).data;
export const getAdminTrainingLogs   = async (params = {}) => (await api.get('/admin/training-logs', { params })).data;
export const getAdminRetrains       = async (params = {}) => (await api.get('/admin/retrains', { params })).data;

export default api;
