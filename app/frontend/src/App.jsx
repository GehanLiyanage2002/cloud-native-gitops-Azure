import React, { useEffect, useState } from 'react';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPodInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/info');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setData({ error: 'Failed to reach AKS backend service' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPodInfo();
  }, []);

  return (
    <div style={{ maxWidth: '680px', margin: '60px auto', padding: '32px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
      <h1 style={{ marginTop: 0, color: '#38bdf8' }}>Azure AKS GitOps Status</h1>
      <p style={{ color: '#94a3b8' }}>Provisioned via Terraform & Deployed with GitHub Actions + ArgoCD</p>

      {loading ? (
        <p>Querying Azure Kubernetes Service...</p>
      ) : data?.error ? (
        <p style={{ color: '#f87171' }}>{data.error}</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px', marginTop: '24px' }}>
          <div style={{ padding: '16px', background: '#0f172a', borderRadius: '8px' }}>
            <strong style={{ color: '#94a3b8', display: 'block', fontSize: '12px' }}>SERVED BY AKS POD</strong>
            <span style={{ fontSize: '22px', color: '#4ade80', fontFamily: 'monospace' }}>{data.podHostname}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '16px', background: '#0f172a', borderRadius: '8px' }}>
              <strong style={{ color: '#94a3b8', display: 'block', fontSize: '12px' }}>APP VERSION</strong>
              <span style={{ fontSize: '18px' }}>{data.version}</span>
            </div>
            <div style={{ padding: '16px', background: '#0f172a', borderRadius: '8px' }}>
              <strong style={{ color: '#94a3b8', display: 'block', fontSize: '12px' }}>POD UPTIME</strong>
              <span style={{ fontSize: '18px' }}>{data.uptimeSeconds}s</span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={fetchPodInfo}
        style={{ marginTop: '24px', padding: '10px 20px', background: '#0078d4', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        Refresh Pod Load Balancer
      </button>
    </div>
  );
}