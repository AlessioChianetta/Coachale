import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { requireRole } from "../middleware/auth";

const router = Router();
const SCRIPT_PATH = path.join(process.cwd(), "server", "ai", "sales-script-structure.json");

// Get the current sales script structure
router.get("/", async (req, res) => {
  try {
    const fileContent = await fs.readFile(SCRIPT_PATH, "utf-8");
    const scriptStructure = JSON.parse(fileContent);
    res.json(scriptStructure);
  } catch (error: any) {
    console.error("Error reading sales script structure:", error);
    res.status(500).json({ message: "Error reading script structure", error: error.message });
  }
});

// Update the sales script structure
router.post("/", requireRole("consultant"), async (req, res) => {
  try {
    const newScriptStructure = req.body;

    // Basic validation
    if (!newScriptStructure || !newScriptStructure.phases || !Array.isArray(newScriptStructure.phases)) {
        return res.status(400).json({ message: "Invalid script structure format" });
    }

    // Ensure version is updated or maintained properly
    // For now, we trust the client to send the updated structure, but we could add version bumping logic here
    // newScriptStructure.version = ...

    // Write to file
    await fs.writeFile(SCRIPT_PATH, JSON.stringify(newScriptStructure, null, 2), "utf-8");

    res.json({ message: "Script structure updated successfully", script: newScriptStructure });
  } catch (error: any) {
    console.error("Error saving sales script structure:", error);
    res.status(500).json({ message: "Error saving script structure", error: error.message });
  }
});

export default router;
