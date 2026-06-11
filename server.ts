import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import 'dotenv/config';

import modelsRouter     from './backend/src/routes/models.js';
import predictRouter    from './backend/src/routes/predict.js';
import evaluateRouter   from './backend/src/routes/evaluate.js';
import datasetRouter    from './backend/src/routes/dataset.js';
import playgroundRouter from './backend/src/routes/playground.js';
import feedbackRouter   from './backend/src/routes/feedback.js';
import retrainRouter    from './backend/src/routes/retrain.js';
import uploadRouter     from './backend/src/routes/upload.js';
import adminRouter      from './backend/src/routes/admin.js';
import authRouter       from './backend/src/routes/auth.js';
import debugRouter      from './backend/src/routes/debug.js';
import { runMigrations } from './backend/src/db/database.js';

async function startServer() {
  const app  = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  try {
    await runMigrations();
    console.log('[server] DB ready');
  } catch (err) {
    console.error('[db] Migrasi GAGAL:', err.message);
    process.exit(1);
  }

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.text({ limit: '50mb' }));

  app.use('/api/auth',           authRouter);
  app.use('/api/models',         modelsRouter);
  app.use('/api/predict',        predictRouter);
  app.use('/api/train-evaluate', evaluateRouter);
  app.use('/api/dataset',        datasetRouter);
  app.use('/api/playground',     playgroundRouter);
  app.use('/api/feedback',       feedbackRouter);
  app.use('/api/retrain',        retrainRouter);
  app.use('/api/upload',         uploadRouter);
  app.use('/api/admin',          adminRouter);
  app.use('/api/debug',          debugRouter);  // sementara untuk diagnosa

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: ['predict.kii.lat'] },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
