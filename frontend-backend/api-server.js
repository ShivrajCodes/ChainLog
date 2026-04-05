import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Deletes all .json files in the data directory.
 */
function deleteAllLogs() {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    jsonFiles.forEach(file => {
      fs.unlinkSync(path.join(DATA_DIR, file));
    });
    
    console.log(`[Lifecycle] Cleared ${jsonFiles.length} log files from data/ directory.`);
  } catch (err) {
    console.error('[Lifecycle] Error clearing logs:', err.message);
  }
}

// Initial cleanup on server start disabled as per user request
// deleteAllLogs();

app.post('/save-log', (req, res) => {
  const { fileName, data } = req.body;

  if (!fileName || !data) {
    return res.status(400).json({ error: 'Missing fileName or data' });
  }

  const filePath = path.join(DATA_DIR, fileName);

  fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error('Error writing file:', err);
      return res.status(500).json({ error: 'Failed to save log' });
    }
    console.log(`Successfully saved log: ${fileName}`);
    res.json({ message: 'Log saved successfully', path: filePath });
  });
});

app.all("/api/clear-logs", (req, res) => {
  const dir = "./data";

  fs.readdir(dir, (err, files) => {
    if (err) return res.status(500).send("Error");

    files.forEach(file => {
      if (file.endsWith(".json")) {
        fs.unlinkSync(`${dir}/${file}`);
      }
    });

    res.send("Logs cleared");
  });
});

app.listen(PORT, () => {
  console.log(`Save-Server running at http://localhost:${PORT}`);
});
