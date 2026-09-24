const fs = require("fs");
const path = require("path");

const seedPath = path.resolve(__dirname, "../../data/seed.json");
const defaultDataPath = path.resolve(__dirname, "../../data/toolshed.local.json");
const dataPath = process.env.TOOLSHED_DATA_PATH
  ? path.resolve(process.env.TOOLSHED_DATA_PATH)
  : defaultDataPath;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureStore() {
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.copyFileSync(seedPath, dataPath);
  }
}

function readStore() {
  ensureStore();
  return readJson(dataPath);
}

function writeStore(data) {
  fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
}

function updateStore(mutator) {
  const data = readStore();
  const result = mutator(data);
  writeStore(data);
  return result;
}

function id(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  readStore,
  updateStore,
  id
};
