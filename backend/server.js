import app from "./src/app.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`KartMitra backend running on port ${PORT}`);
});