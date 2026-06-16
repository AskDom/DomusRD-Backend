import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './src/routes/authRoutes.js'; // <-- Importamos tus nuevas rutas

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Enrutador principal de Autenticación
app.use('/api/auth', authRoutes); // <-- Tus rutas ahora viven en /api/auth/register y /api/auth/login

app.get('/', (req, res) => {
  res.send('Servidor corriendo de DomusRD');
});

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});