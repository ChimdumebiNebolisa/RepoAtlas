const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`API listening on ${port}`);
  });
}

module.exports = app;
