# Car Price Intelligence

A full-stack web application that predicts used car prices using Machine Learning models (KNN and Decision Tree).

## Project Structure

This project uses a unified structure for AI Studio:
- `server.ts`: Express backend and Vite middleware
- `backend/`: API routes, Python bridge, and Python scripts
- `src/`: React frontend

## Setup & Installation

1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Install Python dependencies (requires Python 3):
   ```bash
   pip install -r backend/src/scripts/requirements.txt
   ```

3. Place your trained model files in the `backend/src/models/` directory:
   - `car_price.knn_model.sav`
   - `car_price_DT_model.sav`
   - `preprocessor_DT.sav`

   Prediction only runs with real Python models. If model files are missing or Python dependencies are not installed, the API will return an error.

## Running the App

Start the development server (runs both Express and Vite):
```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Features
- **Dual Models**: Compare predictions between K-Nearest Neighbors and Decision Tree algorithms.
- **Python Integration**: Node.js spawns Python processes to run actual scikit-learn models.
- **Responsive UI**: Dark industrial dashboard built with Tailwind CSS and React.
