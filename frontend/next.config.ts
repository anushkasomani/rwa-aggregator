/** @type {import('next').NextConfig} */
const API =  "https://basket-46h1.onrender.com/";
const API2 = "http://localhost:8001";

module.exports = {
  async rewrites() {
    return [
      { source: "/api/health",   destination: `${API}/health` },
      { source: "/api/plan",     destination: `${API}/plan` },
      { source: "/api/backtest", destination: `${API2}/backtest` },
    ];
  },
};
