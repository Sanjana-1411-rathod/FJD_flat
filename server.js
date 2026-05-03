const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./database');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes — registered ONCE each (fixed duplicate bug)
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Try to load auth routes if they exist
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
} catch (e) {
  console.log('Auth routes not found, skipping.');
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'AuthentiJob API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
