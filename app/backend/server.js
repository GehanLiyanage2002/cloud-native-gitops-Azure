const express = require('express');
const cors = require('cors');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Kubernetes Liveness & Readiness Probe Endpoint
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: new Date().toISOString() });
});

// Main API Endpoint returning Azure AKS Pod Metadata
app.get('/api/info', (req, res) => {
  res.json({
    service: 'azure-aks-gitops-api',
    version: process.env.APP_VERSION || 'v1.0.0',
    cloudProvider: 'Microsoft Azure (AKS)',
    podHostname: os.hostname(), // Returns the exact AKS Pod name
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend API running on port ${PORT}`);
});